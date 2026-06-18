import json
import os
import re
from dotenv import load_dotenv
import httpx
from app.models.scenario import Scenario

load_dotenv()

API_BASE = os.getenv("ANTHROPIC_BASE_URL")
API_KEY = os.getenv("ANTHROPIC_AUTH_TOKEN")
MODEL = os.getenv("ANTHROPIC_MODEL", "glm-5.1")

SYSTEM_PROMPT = """你是一个量化因子挖掘的场景提取助手。用户会输入一段自然语言描述，你需要将其解析为结构化的 JSON 场景配置。

严格遵循以下枚举约束：
- market: "equity" | "futures" | "crypto" | "fx"
- target: "direction" | "ic" | "rank_ic" | "return"
- factor_type: "single_asset_timing" | "cross_sectional"
- frequency: "5min" | "15min" | "1h" | "4h" | "1d"
- fields 可选值: "close", "open", "high", "low", "volume", "returns", "vwap"
- intent 可选值: "novelty_boost" | "redundancy_strict" | "simplicity" | "quality_first" | "diversity_boost" | "refinement"

标的池映射规则：
- "沪深300" / "hs300" → ["hs300"]
- "中证500" / "zz500" → ["zz500"]
- "中证1000" / "zz1000" → ["zz1000"]
- "比特币" / "BTC" → ["BTCUSDT"]
- "以太坊" / "ETH" → ["ETHUSDT"]

intent 推断规则：
- 提到"新颖"/"不同"/"探索" → novelty_boost
- 提到"低相关"/"互补"/"不重复" → redundancy_strict
- 提到"简单"/"可解释" → simplicity
- 提到"质量"/"效果好" → quality_first
- 提到"多样"/"不同类型" → diversity_boost
- 提到"改进"/"优化"/"调整" → refinement

当用户选择某个 intent 时，自动填充对应的 weight_bias：
- novelty_boost: {"novelty": 0.15}
- redundancy_strict: {"redundancy": 0.10}
- simplicity: {"complexity": 0.10}
- quality_first: {"novelty": -0.10}
- diversity_boost: {"diversity": 0.10}
- refinement: {"novelty": -0.10, "redundancy": -0.05}

输出格式：纯 JSON，不要任何解释文字，不要 markdown 代码块标记。
JSON 必须包含以下字段：raw, market, universe, frequency, horizon, target, factor_type, fields, constraints, preferred_signals, weight_bias, intent。
如果用户没有提到某个字段，使用合理的默认值。"""

FEW_SHOTS = [
    {
        "input": "寻找中证1000上的短期动量因子，5分钟频率，预测下一根K线方向",
        "output": {
            "raw": "寻找中证1000上的短期动量因子，5分钟频率，预测下一根K线方向",
            "market": "equity",
            "universe": ["zz1000"],
            "frequency": "5min",
            "horizon": 1,
            "target": "direction",
            "factor_type": "single_asset_timing",
            "fields": ["close", "open", "high", "low", "volume", "returns", "vwap"],
            "constraints": {"max_depth": "4"},
            "preferred_signals": ["momentum", "volume_price"],
        }
    },
    {
        "input": "生成和已有因子低相关的横截面因子，日频，预测5日收益排名",
        "output": {
            "raw": "生成和已有因子低相关的横截面因子，日频，预测5日收益排名",
            "market": "equity",
            "universe": ["hs300", "zz500"],
            "frequency": "1d",
            "horizon": 5,
            "target": "rank_ic",
            "factor_type": "cross_sectional",
            "fields": ["close", "volume", "returns", "vwap"],
            "weight_bias": {"redundancy": 0.10},
            "intent": "redundancy_strict",
        }
    },
    {
        "input": "探索加密货币的波动率因子，1小时频率，简单可解释的结构",
        "output": {
            "raw": "探索加密货币的波动率因子，1小时频率，简单可解释的结构",
            "market": "crypto",
            "universe": ["BTCUSDT", "ETHUSDT"],
            "frequency": "1h",
            "horizon": 1,
            "target": "ic",
            "factor_type": "single_asset_timing",
            "fields": ["close", "high", "low", "volume", "returns"],
            "weight_bias": {"complexity": 0.10},
            "intent": "simplicity",
        }
    },
]


def build_messages(raw: str) -> list[dict]:
    messages = []
    for shot in FEW_SHOTS:
        messages.append({"role": "user", "content": shot["input"]})
        messages.append({"role": "assistant", "content": json.dumps(shot["output"], ensure_ascii=False)})
    messages.append({"role": "user", "content": raw})
    return messages


def _extract_text(data: dict) -> str:
    """Extract text content from API response."""
    for block in data.get("content", []):
        if block.get("type") == "text":
            return block["text"]
    raise ValueError("No text block in response")


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output, handling markdown code blocks."""
    m = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if m:
        return json.loads(m.group(1).strip())
    return json.loads(text.strip())


async def extract_scenario(raw: str) -> Scenario:
    messages = build_messages(raw)
    payload = {
        "model": MODEL,
        "max_tokens": 1024,
        "system": SYSTEM_PROMPT,
        "messages": messages,
        "temperature": 0.1,
    }
    async with httpx.AsyncClient(timeout=30) as http:
        r = await http.post(
            f"{API_BASE}/v1/messages",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
            },
            json=payload,
        )
        r.raise_for_status()
    data = r.json()
    text = _extract_text(data)
    parsed = _parse_json(text)
    parsed["raw"] = raw
    return Scenario.model_validate(parsed)
