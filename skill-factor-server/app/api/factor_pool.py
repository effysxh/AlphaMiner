"""因子库 Pool 端点，路径对齐前端 /api/v1/pool/*。"""

from typing import Optional

from fastapi import APIRouter, HTTPException

from app.models.factor import FactorRecord, FactorStatus
from app.services.factor_pool import get_pool

router = APIRouter(prefix="/pool", tags=["Factor Pool"])


def _current_phase(total: int) -> str:
    if total < 50:
        return "early"
    elif total < 200:
        return "mid"
    return "late"


# ── Summary ──

@router.get("/summary")
def pool_summary():
    """
    因子库概览。
    前端期望: { total_factors, candidate_count, rejected_count,
                low_score_count, current_phase, top10_factor_ids }
    """
    pool = get_pool()
    total = len(pool._by_id)
    return {
        "total_factors": total,
        "candidate_count": len(pool.list_status(FactorStatus.candidate)),
        "rejected_count": len(pool.list_status(FactorStatus.rejected)),
        "low_score_count": len(pool.list_status(FactorStatus.low_score)),
        "current_phase": _current_phase(total),
        "top10_factor_ids": pool.get_top10(),
    }


# ── Correlation ──

@router.get("/correlation")
def correlation_matrix():
    """
    全量相关矩阵（候选因子之间）。
    前端期望: CorrelationEntry[] { factor_id_a, factor_id_b, pearson_corr }
    """
    import numpy as np
    import pandas as pd

    pool = get_pool()
    candidates = [
        fid for fid in pool._by_id
        if pool._by_id[fid].status == FactorStatus.candidate
        and pool._by_id[fid].definition.data_path
    ]

    # 读取所有候选因子的值
    values: dict[str, np.ndarray] = {}
    for fid in candidates:
        record = pool._by_id[fid]
        data_path = pool._root.parent.parent / record.definition.data_path
        if not data_path.exists():
            continue
        try:
            df = pd.read_parquet(str(data_path))
            col = "factor_value" if "factor_value" in df.columns else df.columns[0]
            values[fid] = df[col].values
        except Exception:
            continue

    ids = list(values.keys())
    entries = []
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a, b = values[ids[i]], values[ids[j]]
            min_len = min(len(a), len(b))
            if min_len < 2:
                continue
            corr = float(np.corrcoef(a[:min_len], b[:min_len])[0, 1])
            if np.isnan(corr):
                continue
            entries.append({
                "factor_id_a": ids[i],
                "factor_id_b": ids[j],
                "pearson_corr": round(corr, 4),
            })
    return entries


# ── Families ──

@router.get("/families")
def family_groups():
    """
    族分组列表。
    前端期望: FamilyGroup[] { family_hash, representative_ops, member_count, factor_ids }
    """
    pool = get_pool()
    groups: dict[str, dict] = {}
    for fid, record in pool._by_id.items():
        if not record.archives or not record.archives.family_hash:
            continue
        fh = record.archives.family_hash
        if fh not in groups:
            groups[fh] = {
                "family_hash": fh,
                "representative_ops": list(record.definition.dsl_ops_used[:5]),
                "member_count": 0,
                "factor_ids": [],
            }
        groups[fh]["member_count"] += 1
        groups[fh]["factor_ids"].append(fid)
    return list(groups.values())


# ── Refinement ──

@router.get("/refinements")
def refinement_cycles():
    """精炼历史（占位，待实现）。"""
    # TODO: 从因子库中提取有 parent_id 的进化记录
    pool = get_pool()
    cycles = []
    for fid, record in pool._by_id.items():
        if record.evolution.parent_id:
            parent = pool.get(record.evolution.parent_id)
            cycles.append({
                "id": f"ref_{fid}",
                "original_factor_id": record.evolution.parent_id,
                "original_expression": parent.definition.expression if parent else "",
                "original_total_reward": parent.reward_scores_raw.total_reward if parent and parent.reward_scores_raw else 0.0,
                "reject_reason": parent.reject_reason if parent else "",
                "llm_feedback": "",
                "refined_factor_id": fid,
                "refined_expression": record.definition.expression,
                "refined_total_reward": record.reward_scores_raw.total_reward if record.reward_scores_raw else 0.0,
                "improved": record.evolution.improved or False,
                "timestamp": record.meta.generated_at.isoformat() if record.meta.generated_at else "",
            })
    return cycles


@router.post("/refine")
def submit_refinement(body: dict):
    """提交精炼请求（占位，待实现 LLM 改写逻辑）。"""
    raise HTTPException(501, "Refinement not implemented yet")


# ── DAG ──

@router.get("/dag")
def dag_graph():
    """
    DAG 进化图谱。
    前端期望: { nodes: [...], edges: [...] }
    """
    pool = get_pool()
    nodes = []
    edges = []
    for fid, record in pool._by_id.items():
        nodes.append({
            "factor_id": fid,
            "expression": record.definition.expression,
            "total_reward": record.reward_scores_raw.total_reward if record.reward_scores_raw else 0.0,
            "status": record.status.value,
            "depth": record.evolution.depth,
            "parent_id": record.evolution.parent_id,
            "children_ids": record.evolution.children_ids,
            "reject_reason": record.reject_reason,
            "improved": record.evolution.improved,
            "timestamp": record.meta.generated_at.isoformat() if record.meta.generated_at else "",
        })
        if record.evolution.parent_id:
            edges.append({
                "from": record.evolution.parent_id,
                "to": fid,
                "improved": record.evolution.improved or False,
            })
    return {"nodes": nodes, "edges": edges}


# ── Evolution Trace ──

@router.get("/evolution/trace/{factor_id}")
def evolution_trace(factor_id: str):
    pool = get_pool()
    if not pool.get(factor_id):
        raise HTTPException(404, f"Factor {factor_id} not found")
    return pool.build_evolution_trace(factor_id)


# ── Leaves ──

@router.get("/evolution/leaves")
def leaf_nodes():
    return list(get_pool()._leaf_nodes)


# ── Add Factor ──

@router.post("/factors")
def add_factor(record: FactorRecord):
    pool = get_pool()
    if pool.get(record.factor_id):
        raise HTTPException(409, f"Factor {record.factor_id} already exists")
    pool.add(record)
    return {"status": "ok", "factor_id": record.factor_id}
