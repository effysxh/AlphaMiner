"""奖励计算端点，路径对齐前端 /api/v1/reward/*。"""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/reward", tags=["Reward"])


# ── 阶段权重配置 ──

PHASE_WEIGHTS = {
    "early": {"w11": 0.10, "w12": 0.30, "w13": 0.30, "w14": 0.10, "w2": 0.05, "w3": 0.05, "w4": 0.05, "w5": 0.05},
    "mid":   {"w11": 0.10, "w12": 0.20, "w13": 0.20, "w14": 0.10, "w2": 0.12, "w3": 0.10, "w4": 0.10, "w5": 0.08},
    "late":  {"w11": 0.05, "w12": 0.15, "w13": 0.15, "w14": 0.05, "w2": 0.15, "w3": 0.15, "w4": 0.15, "w5": 0.15},
}


def _phase(total: int) -> str:
    if total < 50:
        return "early"
    elif total < 200:
        return "mid"
    return "late"


@router.post("/weights")
def get_weight_config(body: dict):
    """
    根据因子库大小和用户意图偏置返回权重配置。
    前端请求: { total_factor_count, bias? }
    前端期望: { phase, base_weights, weight_bias }
    """
    total = body.get("total_factor_count", 0)
    bias = body.get("bias") or {}
    phase = _phase(total)
    base = PHASE_WEIGHTS[phase]

    # 应用偏置后重新归一化
    adjusted = dict(base)
    for k, v in bias.items():
        if v is not None:
            adjusted[k] = adjusted.get(k, 0.0) + v
    total_w = sum(adjusted.values())
    if total_w != 0:
        adjusted = {k: v / total_w for k, v in adjusted.items()}

    return {
        "phase": phase,
        "base_weights": base,
        "weight_bias": bias,
    }


@router.post("/calculate")
def calculate_reward(body: dict):
    """奖励计算（占位，待实现实际计算逻辑）。"""
    raise HTTPException(501, "Reward calculation not implemented yet")
