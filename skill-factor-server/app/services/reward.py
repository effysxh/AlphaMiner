"""奖励计算服务 (Spec Section 3)。

实现八维评分、归一化、权重分配和总奖励计算。
"""

from __future__ import annotations

import math
from typing import Optional

import numpy as np
from scipy import stats as sp_stats

from app.models.factor import (
    RewardScoresRaw, WeightConfig, Archives,
    FactorScenario, FactorStatus,
)
from app.services.archives import compute_archives, compute_novelty_score, compute_family_diversity
from app.services.factor_pool import FactorPool

# ── 阶段调度权重 (Spec 3.7.2) ──

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


# ══════════════════════════════════════════════════════════════════
#  反馈奖励计算 (Spec 3.2)
# ══════════════════════════════════════════════════════════════════

def _compute_direction_accuracy(factor_values: np.ndarray, future_returns: np.ndarray) -> float:
    """DirectionAccuracyReward = accuracy - 0.5 (Spec 3.2.1)。"""
    if len(factor_values) == 0:
        return 0.0
    pred_sign = np.sign(factor_values)
    label_sign = np.sign(future_returns)
    mask = pred_sign != 0
    if not mask.any():
        return 0.0
    accuracy = float(np.mean(pred_sign[mask] == label_sign[mask]))
    return accuracy - 0.5


def _compute_ic(factor_values: np.ndarray, future_returns: np.ndarray) -> float:
    """ICReward = |Pearson corr| (Spec 3.2.2)。"""
    if len(factor_values) < 2:
        return 0.0
    corr = np.corrcoef(factor_values, future_returns)[0, 1]
    return float(abs(corr)) if np.isfinite(corr) else 0.0


def _compute_rank_ic(factor_values: np.ndarray, future_returns: np.ndarray) -> float:
    """RankICReward = |Spearman corr| (Spec 3.2.3)。"""
    if len(factor_values) < 2:
        return 0.0
    corr, _ = sp_stats.spearmanr(factor_values, future_returns)
    return float(abs(corr)) if np.isfinite(corr) else 0.0


def _compute_signal_return(factor_values: np.ndarray, future_returns: np.ndarray) -> float:
    """SignalReturnReward = tanh(10 * mean(sign(factor) * return)) (Spec 3.2.4)。"""
    if len(factor_values) == 0:
        return 0.0
    signal_ret = float(np.mean(np.sign(factor_values) * future_returns))
    return float(np.tanh(10 * signal_ret))


# ══════════════════════════════════════════════════════════════════
#  归一化 (Spec 3.7.1)
# ══════════════════════════════════════════════════════════════════

def _norm_direction_accuracy(raw: float) -> float:
    """2x + 1 → [0, 1]，raw 在 [-0.5, 0.5]。"""
    return max(0.0, min(1.0, 2 * raw + 1))


def _norm_ic(raw: float) -> float:
    """min(1, x / 0.10) → [0, 1]。"""
    return min(1.0, raw / 0.10)


def _norm_rank_ic(raw: float) -> float:
    """min(1, x / 0.10) → [0, 1]。"""
    return min(1.0, raw / 0.10)


def _norm_signal_return(raw: float) -> float:
    """(x + 1) / 2 → [0, 1]，raw 在 [-1, 1] (tanh 后)。"""
    return (raw + 1) / 2


def _norm_novelty(raw: float) -> float:
    """clamp to [0, 1]。"""
    return max(0.0, min(1.0, raw))


def _norm_redundancy(max_corr: float, threshold: float = 0.6) -> float:
    """sigmoid 映射 → [0, 1]，高冗余→接近1。

    Redundancy = -(max_corr - threshold)，归一化为 sigmoid。
    """
    raw = -(max_corr - threshold)
    # sigmoid centered at 0 (which means max_corr == threshold)
    return 1.0 / (1.0 + math.exp(-10 * raw))


def _norm_family_diversity(raw: float) -> float:
    """min(1, x / 0.02) → [0, 1]。"""
    return min(1.0, abs(raw) / 0.02)


def _norm_complexity(depth: int, depth_safe: int) -> float:
    """Complexity = -(depth - depth_safe)，归一化: min(1, |x| / 0.05) → [0, 1]。"""
    raw = -(depth - depth_safe)
    return min(1.0, abs(raw) / 0.05)


# ══════════════════════════════════════════════════════════════════
#  权重分配
# ══════════════════════════════════════════════════════════════════

def resolve_weights(
    total_factor_count: int,
    weight_bias: Optional[dict[str, float]] = None,
) -> WeightConfig:
    """根据阶段和用户意图偏置返回权重配置。"""
    phase = _phase(total_factor_count)
    base = dict(PHASE_WEIGHTS[phase])
    bias = dict(weight_bias) if weight_bias else {}

    # 应用偏置后重新归一化
    adjusted = dict(base)
    for k, v in bias.items():
        if v is not None:
            adjusted[k] = adjusted.get(k, 0.0) + v
    total_w = sum(adjusted.values())
    if total_w != 0:
        adjusted = {k: v / total_w for k, v in adjusted.items()}

    return WeightConfig(phase=phase, base_weights=base, weight_bias=bias)


# ══════════════════════════════════════════════════════════════════
#  完整奖励计算
# ══════════════════════════════════════════════════════════════════

async def calculate_reward(
    factor_values: list[float],
    future_returns: list[float],
    expression: str,
    total_factor_count: int,
    weight_bias: Optional[dict[str, float]] = None,
    ast_depth: int = 0,
    depth_safe_limit: int = 4,
    pool: Optional[FactorPool] = None,
    factor_id: str = "",
) -> tuple[RewardScoresRaw, WeightConfig, Optional[Archives], Optional[np.ndarray]]:
    """完整奖励计算管线。

    Returns:
        (reward_scores_raw, weight_config, archives, embedding_array)
    """
    fv = np.array(factor_values, dtype=np.float64)
    fr = np.array(future_returns, dtype=np.float64)
    min_len = min(len(fv), len(fr))
    if min_len < len(fv):
        fv = fv[:min_len]
        fr = fr[:min_len]

    # ── 反馈奖励 (原始值) ──
    direction_accuracy = _compute_direction_accuracy(fv, fr)
    ic = _compute_ic(fv, fr)
    rank_ic = _compute_rank_ic(fv, fr)
    signal_return = _compute_signal_return(fv, fr)

    # ── 结构性评分 (原始值) ──
    novelty = 0.5  # 默认中性
    novelty_hash = ""
    max_sim = 0.0
    most_similar_id = None
    embedding = None
    archives = None

    redundancy_max_corr = 0.0
    redundancy_top_id = None
    family_diversity = 0.0
    family_hash = ""
    family_count = 0
    is_new_family = False

    if pool is not None:
        # Novelty
        novelty, novelty_hash, max_sim, most_similar_id = await compute_novelty_score(
            expression, pool, embedding=None  # embedding 在 archives 中计算
        )

        # Redundancy (与 Top 10 的相关系数)
        if pool._top10_cache and min_len > 1:
            redundancy_max_corr, redundancy_top_id = pool.query_redundancy(fv)

        # Family Diversity
        family_diversity, family_hash, family_count, is_new_family = compute_family_diversity(
            expression, pool, 0.0  # reward_score 暂用 0，后面会更新
        )

    # Complexity
    complexity_raw = -(ast_depth - depth_safe_limit) if ast_depth > depth_safe_limit else 0.0

    # ── 归一化 ──
    n_da = _norm_direction_accuracy(direction_accuracy)
    n_ic = _norm_ic(ic)
    n_ric = _norm_rank_ic(rank_ic)
    n_sr = _norm_signal_return(signal_return)
    n_novelty = _norm_novelty(novelty)
    n_redundancy = _norm_redundancy(redundancy_max_corr)
    n_fd = _norm_family_diversity(family_diversity)
    n_complexity = _norm_complexity(ast_depth, depth_safe_limit)

    # ── 权重分配 ──
    weight_config = resolve_weights(total_factor_count, weight_bias)
    w = weight_config.base_weights.copy()
    if weight_bias:
        for k, v in weight_bias.items():
            if v is not None:
                w[k] = w.get(k, 0.0) + v
        total_w = sum(w.values())
        if total_w != 0:
            w = {k: v / total_w for k, v in w.items()}

    # ── 总奖励 ──
    total_reward = (
        w.get("w11", 0) * n_da
        + w.get("w12", 0) * n_ic
        + w.get("w13", 0) * n_ric
        + w.get("w14", 0) * n_sr
        + w.get("w2", 0) * n_novelty
        + w.get("w3", 0) * n_redundancy
        + w.get("w4", 0) * n_fd
        + w.get("w5", 0) * n_complexity
    )

    reward_scores = RewardScoresRaw(
        direction_accuracy=direction_accuracy,
        ic=ic,
        rank_ic=rank_ic,
        signal_return=signal_return,
        novelty=novelty,
        redundancy=-redundancy_max_corr if redundancy_max_corr > 0.6 else 0.0,
        family_diversity=family_diversity,
        complexity=complexity_raw,
        total_reward=round(total_reward, 6),
    )

    # ── Archives (如果有 pool) ──
    if pool is not None:
        archives, embedding = await compute_archives(
            expression, pool, total_reward, factor_id
        )
        # 更新 redundancy 信息
        if archives:
            archives.redundancy_max_corr = redundancy_max_corr
            archives.redundancy_top_factor = redundancy_top_id
        # Family diversity 可能需要用实际 reward 更新
        family_diversity_updated, _, _, _ = compute_family_diversity(
            expression, pool, total_reward
        )
        reward_scores.family_diversity = family_diversity_updated

    return reward_scores, weight_config, archives, embedding
