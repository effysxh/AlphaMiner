"""进化检索器 + 精炼服务 (Spec 4.5)。

实现启发式进化候选选择、进化 Trace 构建、LLM 精炼生成。
"""

from __future__ import annotations

import ast
import json
import math
from datetime import datetime
from typing import Optional

from app.models.factor import (
    FactorRecord, FactorMeta, FactorScenario, FactorDefinition,
    StaticCheck, Evolution, FactorStatus,
)
from app.models.dsl import collect_call_names, ALL_OPS, FIELD_ACCESSORS
from app.services.factor_pool import FactorPool
from app.services.factor_generator import (
    generate_factors, _format_reject_reason, collect_call_names_from_expr,
)
from app.services.llm_client import call_llm, parse_json_text
from app.services.static_check import run_static_check


# ── 默认参数 ──

DEPTH_LIMIT = 7
EXPLORE_LIMIT = 3
GAMMA = 0.15    # depth penalty 衰减因子
OMEGA = 0.30    # retrieval penalty 衰减因子


# ══════════════════════════════════════════════════════════════════
#  启发式进化检索器 (Spec 4.5.3 简化版)
# ══════════════════════════════════════════════════════════════════

def select_evolution_candidates(
    pool: FactorPool,
    top_k: int = 3,
    depth_limit: int = DEPTH_LIMIT,
    explore_limit: int = EXPLORE_LIMIT,
) -> list[str]:
    """启发式选择最具进化潜力的因子。

    评分公式:
    score = sigmoid(normalized_reward) × (1-γ)^depth × (1-ω)^exploration_count

    过滤规则:
    - Rejected 因子排除
    - depth >= depth_limit 排除
    - exploration_count >= explore_limit 且未改善的排除
    """
    candidates = []
    rewards = []

    for fid, record in pool._by_id.items():
        # 过滤
        if record.status == FactorStatus.rejected:
            continue
        evo = pool._evolution_dag.get(fid, {})
        depth = evo.get("depth", 0)
        exp_count = evo.get("exploration_count", 0)
        improved = evo.get("improved")

        if depth >= depth_limit:
            continue
        if exp_count >= explore_limit and not improved:
            continue

        # 质量分
        reward = record.reward_scores_raw.total_reward if record.reward_scores_raw else 0.0
        rewards.append(reward)
        candidates.append(fid)

    if not candidates:
        return []

    # 归一化 reward
    mu = sum(rewards) / len(rewards) if rewards else 0
    sigma = (sum((r - mu) ** 2 for r in rewards) / len(rewards)) ** 0.5 if len(rewards) > 1 else 1.0
    if sigma == 0:
        sigma = 1.0

    scored = []
    for fid, reward in zip(candidates, rewards):
        evo = pool._evolution_dag.get(fid, {})
        depth = evo.get("depth", 0)
        exp_count = evo.get("exploration_count", 0)

        # Sigmoid 归一化质量分
        norm_q = 1.0 / (1.0 + math.exp(-(reward - mu) / sigma))
        # 深度惩罚
        depth_penalty = (1 - GAMMA) ** depth
        # 检索惩罚
        retrieval_penalty = (1 - OMEGA) ** exp_count

        # 叶节点优先加成
        is_leaf = fid in pool._leaf_nodes
        leaf_bonus = 1.3 if is_leaf else 1.0

        score = norm_q * depth_penalty * retrieval_penalty * leaf_bonus
        scored.append((fid, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [fid for fid, _ in scored[:top_k]]


# ══════════════════════════════════════════════════════════════════
#  进化 Trace 构建 (Spec 4.5.4)
# ══════════════════════════════════════════════════════════════════

def build_evolution_trace_text(pool: FactorPool, factor_id: str) -> str:
    """构建进化路径的文本描述，用于注入 LLM prompt。"""
    trace = pool.build_evolution_trace(factor_id)
    if not trace:
        return ""

    lines = []
    for i, node in enumerate(trace):
        fid = node["factor_id"]
        expr = node.get("expression", "")
        reward = node.get("total_reward", 0.0)
        reject = node.get("reject_reason", "")
        feedback = node.get("llm_feedback", "")
        improved = node.get("improved")

        line = f"  [{i+1}] {fid}: {expr}"
        line += f"  (得分: {reward:.3f})"
        if improved is not None:
            line += f"  {'改善' if improved else '未改善'}"
        if reject:
            line += f"\n      失败原因: {reject}"
        if feedback:
            line += f"\n      优化建议: {feedback}"
        lines.append(line)

    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════
#  LLM 精炼生成 (Spec 4.5.5)
# ══════════════════════════════════════════════════════════════════

SYSTEM_PROMPT_REFINE = """你是一个量化因子优化助手。你将看到一个因子的进化历史和当前状态，需要生成改进版本。

规则:
1. 不要重复历史中已尝试的方向
2. 针对失败原因做出针对性修改
3. 保持与进化方向的一致性
4. 使用 DSL 算子，不得使用自定义算子
5. 嵌套深度不超过 4 层
6. 不得使用未来数据（负窗口、future 关键字等）

输出纯 JSON 数组，每个元素:
- name: 因子名称
- description: 因子描述
- expression: DSL 表达式
- code: Python 计算代码
- dsl_ops_used: 使用的算子列表
"""


async def refine_factor(
    pool: FactorPool,
    parent_id: str,
    generate_num: int = 5,
    scenario: Optional[dict] = None,
) -> list[FactorRecord]:
    """基于进化历史精炼一个因子。"""
    parent = pool.get(parent_id)
    if not parent:
        return []

    trace_text = build_evolution_trace_text(pool, parent_id)
    reject_reason = parent.reject_reason or ""
    reward = parent.reward_scores_raw.total_reward if parent.reward_scores_raw else 0.0

    user_msg = f"""你正在优化一个 Alpha 因子。以下是该因子的进化历史：

{trace_text}

当前因子: {parent.definition.expression}
当前得分: {reward:.3f}
失败原因: {reject_reason}

请基于进化历史，生成 {generate_num} 个改进因子。"""

    if scenario:
        user_msg += f"\n\n场景: 市场={scenario.get('market')}, 频率={scenario.get('frequency')}, 目标={scenario.get('target')}"

    messages = [{"role": "user", "content": user_msg}]

    text = await call_llm(
        messages=messages,
        system=SYSTEM_PROMPT_REFINE,
        temperature=0.8,
        max_tokens=4096,
    )

    # 解析
    try:
        factors_data = parse_json_text(text)
    except Exception:
        factors_data = []

    if isinstance(factors_data, dict):
        factors_data = [factors_data] if "expression" in factors_data else factors_data.get("factors", [])

    now = datetime.utcnow()
    records = []
    parent_depth = parent.evolution.depth

    for i, fd in enumerate(factors_data):
        if not isinstance(fd, dict) or "expression" not in fd:
            continue

        expr = fd.get("expression", "")
        ops = fd.get("dsl_ops_used", collect_call_names_from_expr(expr))

        # 生成子因子 ID
        child_id = f"{parent_id}_R{pool._evolution_dag.get(parent_id, {}).get('exploration_count', 0) + 1}"

        # 静态校验
        check = run_static_check(expr)

        if not check.passed:
            status = FactorStatus.rejected
            reject = _format_reject_reason(check)
            improved = False
        else:
            status = FactorStatus.low_score  # 待奖励计算
            reject = None
            improved = None  # 待奖励计算后确定

        record = FactorRecord(
            meta=FactorMeta(
                factor_id=child_id,
                version="1.0",
                generated_at=now,
                generator_model="glm-5.1",
            ),
            scenario=FactorScenario(
                market=parent.scenario.market,
                universe=parent.scenario.universe,
                frequency=parent.scenario.frequency,
                horizon=parent.scenario.horizon,
                target=parent.scenario.target,
                factor_type=parent.scenario.factor_type,
            ),
            definition=FactorDefinition(
                name=fd.get("name", f"Refined_{child_id}"),
                description=fd.get("description", ""),
                expression=expr,
                code=fd.get("code", ""),
                dsl_ops_used=ops,
            ),
            static_check=check,
            evolution=Evolution(
                parent_id=parent_id,
                depth=parent_depth + 1,
                improved=improved,
            ),
            status=status,
            reject_reason=reject,
        )
        records.append(record)

    return records


# ══════════════════════════════════════════════════════════════════
#  完整精炼周期 (Spec 4.5.5)
# ══════════════════════════════════════════════════════════════════

async def run_refinement_cycle(
    scenario: dict,
    pool: FactorPool,
    top_k: int = 3,
    generate_num: int = 5,
    search_time: int = 1,
) -> list[FactorRecord]:
    """执行一轮或多轮精炼循环。

    每轮:
    1. 选择 top_k 进化候选
    2. 对每个候选构建 Trace 并调用 LLM 生成改进因子
    3. 运行静态校验
    4. 返回新因子列表（待客户端评估后入库）
    """
    all_new = []

    for _ in range(search_time):
        candidates = select_evolution_candidates(pool, top_k)
        if not candidates:
            break

        for parent_id in candidates:
            new_factors = await refine_factor(pool, parent_id, generate_num, scenario)
            all_new.extend(new_factors)

            # 更新 exploration_count
            exp_count = pool._exploration_count.get(parent_id, 0) + 1
            pool._exploration_count[parent_id] = exp_count
            if parent_id in pool._evolution_dag:
                pool._evolution_dag[parent_id]["exploration_count"] = exp_count

    return all_new
