"""LLM 因子生成服务 (Spec 4.2)。

调用 LLM 生成因子表达式和 Python 计算代码，注入 DSL 算子参考作为上下文。
"""

from __future__ import annotations

import ast
import json
import re
from datetime import datetime
from typing import Optional

from app.models.factor import (
    FactorRecord, FactorMeta, FactorScenario, FactorDefinition,
    StaticCheck, Evolution, FactorStatus,
)
from app.models.dsl import ALL_OPS, FIELD_ACCESSORS, collect_call_names
from app.services.llm_client import call_llm, parse_json_text
from app.services.static_check import run_static_check


# ── DSL 参考上下文 (来自 DSL参考.md) ──

DSL_REFERENCE = """
## DSL 算子参考

### 类型约定
- Array: numpy 一维数组
- Scalar: 单个 float 值
- w: 窗口参数，必须为正整数常量
- 所有除法均含 +1e-8 除零保护

### 字段访问器 (→ Array，vwap 例外 → Scalar)
close(w), open(w), high(w), low(w), volume(w), returns(w), vwap(w)

### 数组→数组 (Array → Array)
diff(arr), log_arr(arr), normalize(arr), ema_arr(arr, span), slice_arr(arr, w)
add_arr(a, b), sub_arr(a, b), mul_arr(a, b), div_arr(a, b)

注意: ema_arr 名字带 _arr，但实际返回 Scalar

### 数组→标量 (Array → Scalar)
ts_mean(arr), ts_std(arr), ts_max(arr), ts_min(arr), ts_sum(arr)
ts_skew(arr), ts_kurt(arr), last(arr), first(arr)
corr(a, b), cov(a, b)

### 标量→标量 一元
neg(s), abs_s(s), log_s(s), tanh_s(s), sign_s(s)

### 标量→标量 二元
add(a, b), sub(a, b), mul(a, b), div(a, b)

注意: +, -, *, / 中缀运算符也可直接使用，编译器自动处理

### 混合类型
zscore(scalar, arr): 将标量在数组分布中标准化
rank(scalar, arr): 计算标量在数组中的百分位排名

### 类型约束
- 字段访问器必须传窗口 w
- diff/log_arr/normalize/slice_arr 只接受 Array
- ts_mean/ts_std/ts_max/ts_min/ts_sum/ts_skew/ts_kurt/last/first 只接受 Array
- corr/cov 两个参数都必须是 Array
- neg/abs_s/log_s/tanh_s/sign_s 只接受 Scalar
- add/sub/mul/div 两个参数都必须是 Scalar (Array 运算用 add_arr 等)
- zscore: 第一个 Scalar，第二个 Array
- rank: 第一个 Scalar，第二个 Array
- ema_arr(arr, span) 的 span 必须是整数常量
- slice_arr(arr, w) 的 w 必须是整数常量

### 典型因子表达式示例
- Sharpe-like: div(ts_mean(returns(60)), ts_std(returns(60)))
- Z-score偏离: zscore(last(close(120)), close(120))
- 量价相关: corr(returns(60), log_arr(volume(60)))
- 多尺度均值回归: sub(zscore(last(close(60)), close(60)), zscore(last(close(240)), close(240)))
- 偏度因子: ts_skew(returns(120))
- VWAP偏离: div(sub(last(close(1)), vwap(60)), ts_std(close(60)))
- 标准化动量: ts_mean(normalize(returns(120)))
"""

SYSTEM_PROMPT_GENERATE = f"""你是一个专业的量化因子挖掘助手。你需要根据给定的场景，生成多个 Alpha 因子表达式。

你必须严格遵循以下 DSL 算子定义和类型约束来生成表达式：

{DSL_REFERENCE}

### 生成规则
1. 每个因子必须使用上述 DSL 算子，不得使用自定义算子
2. 表达式必须是合法的 Python 表达式语法
3. 窗口参数必须为正整数常量
4. 不得使用任何可能导致未来数据泄露的模式（负窗口、future 关键字等）
5. 尽量生成结构多样化、不同算子组合的因子
6. 每个因子嵌套深度不超过 4 层

### 输出格式
输出纯 JSON 数组，不要任何解释文字，不要 markdown 代码块标记。
每个元素包含以下字段：
- name: 因子名称（英文，驼峰命名）
- description: 因子描述（中文）
- expression: DSL 表达式字符串
- code: 等价的 Python 计算代码
- dsl_ops_used: 使用的 DSL 算子列表

示例输出：
[
  {{
    "name": "ShortTermMomentum",
    "description": "短期动量因子",
    "expression": "sub(last(close(5)), last(close(20)))",
    "code": "df['factor'] = df['close'].shift(4) - df['close'].shift(19)",
    "dsl_ops_used": ["sub", "last", "close"]
  }}
]
"""


def _assign_factor_id(ops: list[str], index: int) -> str:
    """根据算子类别分配因子 ID。"""
    if any(op in FIELD_ACCESSORS for op in ops):
        cat = "MOM"
    elif any(op in ("corr", "cov") for op in ops):
        cat = "CORR"
    elif any(op in ("ts_skew", "ts_kurt") for op in ops):
        cat = "DIST"
    elif any(op in ("zscore", "rank") for op in ops):
        cat = "STD"
    elif any(op in ("ts_std",) for op in ops):
        cat = "VOL"
    else:
        cat = "GEN"
    return f"F_{cat}_{index:03d}"


async def generate_factors(
    scenario: dict,
    generate_num: int = 5,
    model: Optional[str] = None,
) -> list[FactorRecord]:
    """通过 LLM 生成因子候选。

    Steps:
    1. 构建含 DSL 参考 + 场景的 prompt
    2. 调用 LLM
    3. 解析 JSON 响应
    4. 对每个因子运行静态校验
    5. 返回 FactorRecord 列表
    """
    user_message = _build_user_message(scenario, generate_num)
    messages = [{"role": "user", "content": user_message}]

    text = await call_llm(
        messages=messages,
        system=SYSTEM_PROMPT_GENERATE,
        model=model,
        temperature=0.8,
        max_tokens=4096,
    )

    # 解析 LLM 输出
    try:
        factors_data = _parse_factors_response(text)
    except Exception:
        # 尝试宽松解析
        factors_data = _parse_factors_response_lenient(text)

    now = datetime.utcnow()
    records = []
    for i, fd in enumerate(factors_data):
        expr = fd.get("expression", "")
        ops = fd.get("dsl_ops_used", collect_call_names_from_expr(expr))
        fid = _assign_factor_id(ops, i + 1)

        # 运行静态校验
        check = run_static_check(expr)

        # 确定状态
        if not check.passed:
            status = FactorStatus.rejected
            reject_reason = _format_reject_reason(check)
        else:
            status = FactorStatus.low_score  # 等待奖励计算后可能升级为 Candidate
            reject_reason = None

        record = FactorRecord(
            meta=FactorMeta(
                factor_id=fid,
                version="1.0",
                generated_at=now,
                generator_model=model or "glm-5.1",
            ),
            scenario=FactorScenario(
                market=scenario.get("market", "equity"),
                universe=scenario.get("universe", ["zz1000"]),
                frequency=scenario.get("frequency", "5min"),
                horizon=scenario.get("horizon", 1),
                target=scenario.get("target", "direction"),
                factor_type=scenario.get("factor_type", "single_asset_timing"),
            ),
            definition=FactorDefinition(
                name=fd.get("name", f"Factor_{fid}"),
                description=fd.get("description", ""),
                expression=expr,
                code=fd.get("code", ""),
                dsl_ops_used=ops,
            ),
            static_check=check,
            evolution=Evolution(),
            status=status,
            reject_reason=reject_reason,
        )
        records.append(record)

    return records


def _build_user_message(scenario: dict, generate_num: int) -> str:
    parts = [f"请生成 {generate_num} 个 Alpha 因子。"]
    parts.append(f"市场: {scenario.get('market', 'equity')}")
    parts.append(f"标的池: {scenario.get('universe', ['zz1000'])}")
    parts.append(f"频率: {scenario.get('frequency', '5min')}")
    parts.append(f"预测窗口: {scenario.get('horizon', 1)} bar")
    parts.append(f"目标: {scenario.get('target', 'direction')}")
    parts.append(f"因子类型: {scenario.get('factor_type', 'single_asset_timing')}")
    fields = scenario.get("fields", ["close", "open", "high", "low", "volume", "returns", "vwap"])
    parts.append(f"可用字段: {fields}")
    constraints = scenario.get("constraints")
    if constraints:
        parts.append(f"约束: {constraints}")
    signals = scenario.get("preferred_signals")
    if signals:
        parts.append(f"偏好信号族: {signals}")
    return "\n".join(parts)


def _parse_factors_response(text: str) -> list[dict]:
    """解析 LLM 输出为因子列表。"""
    data = parse_json_text(text)
    if isinstance(data, dict):
        # 可能是单个因子包裹在对象中
        if "factors" in data:
            return data["factors"]
        return [data]
    if isinstance(data, list):
        return data
    return []


def _parse_factors_response_lenient(text: str) -> list[dict]:
    """宽松解析：尝试从文本中提取 JSON 数组。"""
    # 查找最外层的 [...]
    depth = 0
    start = -1
    for i, ch in enumerate(text):
        if ch == '[' and depth == 0:
            start = i
        if ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0 and start >= 0:
                try:
                    return json.loads(text[start:i+1])
                except json.JSONDecodeError:
                    continue
    return []


def collect_call_names_from_expr(expression: str) -> list[str]:
    """从表达式中收集函数调用名。"""
    try:
        tree = ast.parse(expression, mode="eval")
        return [n for n in collect_call_names(tree) if n in ALL_OPS]
    except SyntaxError:
        return []


def _format_reject_reason(check: StaticCheck) -> str:
    parts = []
    if not check.syntax_valid:
        parts.append("invalid_syntax")
    if check.future_leak:
        parts.append(f"future_leak: {check.future_leak_details}")
    if check.unknown_ops:
        parts.append(f"unknown_ops: {', '.join(check.unknown_ops)}")
    if not check.field_compliant:
        parts.append("field_not_compliant")
    if check.depth > check.depth_safe_limit:
        parts.append(f"depth_exceeded: {check.depth} > {check.depth_safe_limit}")
    return "; ".join(parts) if parts else "static_check_failed"
