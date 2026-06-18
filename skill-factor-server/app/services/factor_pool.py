"""
FactorPool — 基于文件的因子库，启动时构建内存索引，add() 时增量更新。

存储结构:
  factor_pool/
  ├── factors/        # YAML 因子记录
  ├── data/           # parquet 因子值
  └── embeddings/     # npy 嵌入向量
"""

import hashlib
import math
from pathlib import Path
from typing import Optional

import numpy as np
import yaml

from app.models.factor import FactorRecord, FactorStatus

# ── 默认路径 ──

POOL_ROOT = Path(__file__).resolve().parent.parent / "data" / "factor_pool"
FACTORS_DIR = POOL_ROOT / "factors"
DATA_DIR = POOL_ROOT / "data"
EMBEDDINGS_DIR = POOL_ROOT / "embeddings"


def _ensure_dirs():
    for d in (FACTORS_DIR, DATA_DIR, EMBEDDINGS_DIR):
        d.mkdir(parents=True, exist_ok=True)


# ── YAML 序列化辅助 ──

def _yaml_dump(record: FactorRecord, path: Path):
    data = record.model_dump(mode="json")
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def _yaml_load(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


# ── 余弦相似度 ──

def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


# ══════════════════════════════════════════════════════════════════
#  FactorPool
# ══════════════════════════════════════════════════════════════════

class FactorPool:
    def __init__(self, root: Optional[Path] = None):
        self._root = root or POOL_ROOT
        self._factors_dir = self._root / "factors"
        self._data_dir = self._root / "data"
        self._embeddings_dir = self._root / "embeddings"

        # ── 内存索引 (Section 6.2) ──
        self._by_id: dict[str, FactorRecord] = {}
        self._novelty_hash_index: dict[str, str] = {}
        self._family_count_index: dict[str, int] = {}
        self._top10_cache: list[str] = []
        self._embedding_cache: dict[str, np.ndarray] = {}
        self._evolution_dag: dict[str, dict] = {}
        self._exploration_count: dict[str, int] = {}
        self._leaf_nodes: set[str] = set()

        self._rebuild_index()

    # ── 启动时全量扫描构建索引 ──

    def _rebuild_index(self):
        _ensure_dirs()
        self._by_id.clear()
        self._novelty_hash_index.clear()
        self._family_count_index.clear()
        self._embedding_cache.clear()
        self._evolution_dag.clear()
        self._exploration_count.clear()
        self._leaf_nodes.clear()

        for yaml_path in sorted(self._factors_dir.glob("*.yaml")):
            try:
                raw = _yaml_load(yaml_path)
                record = FactorRecord.model_validate(raw)
            except Exception:
                continue
            self._index_record(record)

        self._refresh_top10()
        self._refresh_leaf_nodes()

    def _index_record(self, record: FactorRecord):
        fid = record.factor_id
        self._by_id[fid] = record

        # novelty hash
        if record.archives and record.archives.novelty_hash:
            self._novelty_hash_index[record.archives.novelty_hash] = fid

        # family count
        if record.archives and record.archives.family_hash:
            fh = record.archives.family_hash
            self._family_count_index[fh] = self._family_count_index.get(fh, 0) + 1

        # embedding
        if record.archives and record.archives.embedding_path:
            emb_path = self._root.parent.parent / record.archives.embedding_path
            if emb_path.exists():
                self._embedding_cache[fid] = np.load(str(emb_path))

        # evolution dag
        self._evolution_dag[fid] = {
            "parent_id": record.evolution.parent_id,
            "children_ids": list(record.evolution.children_ids),
            "depth": record.evolution.depth,
            "exploration_count": record.evolution.exploration_count,
            "improved": record.evolution.improved,
        }
        self._exploration_count[fid] = record.evolution.exploration_count

    # ── Top10 刷新 (Section 6.3) ──

    def _refresh_top10(self):
        candidates = [
            (fid, r.reward_scores_raw.total_reward)
            for fid, r in self._by_id.items()
            if r.status == FactorStatus.candidate and r.reward_scores_raw
        ]
        candidates.sort(key=lambda x: x[1], reverse=True)
        self._top10_cache = [fid for fid, _ in candidates[:10]]

    # ── 叶子节点刷新 ──

    def _refresh_leaf_nodes(self):
        self._leaf_nodes = {
            fid for fid, node in self._evolution_dag.items()
            if not node["children_ids"]
            and self._by_id[fid].status != FactorStatus.rejected
        }

    # ════════════════════════════════════════════════
    #  核心操作 (Section 6.4)
    # ════════════════════════════════════════════════

    def add(self, record: FactorRecord, factor_values=None, embedding: Optional[np.ndarray] = None):
        """写 YAML + parquet + npy，增量更新所有索引。"""
        _ensure_dirs()
        fid = record.factor_id

        # ── 写 YAML ──
        _yaml_dump(record, self._factors_dir / f"{fid}.yaml")

        # ── 写 parquet ──
        if factor_values is not None:
            import pandas as pd
            data_path = self._data_dir / f"{fid}.parquet"
            if isinstance(factor_values, pd.Series):
                factor_values.to_frame(name="factor_value").to_parquet(str(data_path))
            elif isinstance(factor_values, pd.DataFrame):
                factor_values.to_parquet(str(data_path))
            record.definition.data_path = f"factors/data/{fid}.parquet"

        # ── 写 embedding npy ──
        if embedding is not None:
            emb_path = self._embeddings_dir / f"{fid}.npy"
            np.save(str(emb_path), embedding)
            if record.archives:
                record.archives.embedding_path = f"embeddings/{fid}.npy"
            self._embedding_cache[fid] = embedding

        # ── 增量更新索引 ──
        self._index_record(record)
        self._refresh_top10()
        self._refresh_leaf_nodes()

    def get(self, factor_id: str) -> Optional[FactorRecord]:
        return self._by_id.get(factor_id)

    def query_novelty(self, novelty_hash: str) -> Optional[str]:
        """哈希精确匹配，命中返回 factor_id。"""
        return self._novelty_hash_index.get(novelty_hash)

    def query_novelty_embedding(self, vec: np.ndarray) -> tuple[float, Optional[str]]:
        """遍历 embedding 缓存，返回 (max_sim, most_similar_id)。"""
        if not self._embedding_cache:
            return 0.0, None
        max_sim = 0.0
        best_id = None
        for fid, emb in self._embedding_cache.items():
            sim = _cosine_sim(vec, emb)
            if sim > max_sim:
                max_sim = sim
                best_id = fid
        return max_sim, best_id

    def query_family(self, family_hash: str) -> int:
        """返回该族已有因子数量。"""
        return self._family_count_index.get(family_hash, 0)

    def query_redundancy(self, new_values) -> tuple[float, Optional[str]]:
        """与 Top 10 计算相关性，返回 (max_corr, top_factor_id)。"""
        import pandas as pd

        if not self._top10_cache:
            return 0.0, None

        if isinstance(new_values, pd.Series):
            new_arr = new_values.values
        else:
            new_arr = np.asarray(new_values)

        max_corr = 0.0
        best_id = None
        for fid in self._top10_cache:
            record = self._by_id.get(fid)
            if not record or not record.definition.data_path:
                continue
            data_path = self._root.parent.parent / record.definition.data_path
            if not data_path.exists():
                continue
            try:
                df = pd.read_parquet(str(data_path))
                col = "factor_value" if "factor_value" in df.columns else df.columns[0]
                existing_arr = df[col].values
            except Exception:
                continue

            min_len = min(len(new_arr), len(existing_arr))
            if min_len < 2:
                continue
            corr = abs(float(np.corrcoef(new_arr[:min_len], existing_arr[:min_len])[0, 1]))
            if math.isnan(corr):
                continue
            if corr > max_corr:
                max_corr = corr
                best_id = fid

        return max_corr, best_id

    def list_status(self, status: FactorStatus) -> list[str]:
        return [fid for fid, r in self._by_id.items() if r.status == status]

    def get_top10(self) -> list[str]:
        return list(self._top10_cache)

    # ── DAG 进化操作 ──

    def build_evolution_trace(self, factor_id: str) -> list[dict]:
        """沿 DAG 回溯到根节点，构建完整进化路径。"""
        trace = []
        current = factor_id
        visited = set()
        while current and current not in visited:
            visited.add(current)
            record = self._by_id.get(current)
            if not record:
                break
            trace.insert(0, {
                "factor_id": current,
                "expression": record.definition.expression,
                "total_reward": record.reward_scores_raw.total_reward if record.reward_scores_raw else 0.0,
                "reject_reason": record.reject_reason,
                "llm_feedback": None,
                "improved": record.evolution.improved,
            })
            current = record.evolution.parent_id
        return trace

    def record_evolution(self, parent_id: str, child_id: str, improved: bool):
        """插入 DAG 边，更新索引。"""
        # 更新 parent
        parent = self._by_id.get(parent_id)
        if parent:
            if child_id not in parent.evolution.children_ids:
                parent.evolution.children_ids.append(child_id)
            self._evolution_dag[parent_id]["children_ids"].append(child_id)
            _yaml_dump(parent, self._factors_dir / f"{parent_id}.yaml")

        # 更新 child
        child = self._by_id.get(child_id)
        if child:
            child.evolution.parent_id = parent_id
            child.evolution.improved = improved
            _yaml_dump(child, self._factors_dir / f"{child_id}.yaml")
            self._evolution_dag[child_id]["parent_id"] = parent_id
            self._evolution_dag[child_id]["improved"] = improved

        # 更新 exploration count
        self._exploration_count[parent_id] = self._exploration_count.get(parent_id, 0) + 1
        if parent:
            parent.evolution.exploration_count = self._exploration_count[parent_id]
            self._evolution_dag[parent_id]["exploration_count"] = self._exploration_count[parent_id]

        self._refresh_leaf_nodes()

    # ── 概览 ──

    def summary(self) -> dict:
        total = len(self._by_id)
        by_status = {}
        for st in FactorStatus:
            by_status[st.value] = len(self.list_status(st))
        families = len(self._family_count_index)
        return {
            "total": total,
            "by_status": by_status,
            "families": families,
            "top10": self._top10_cache,
        }


# ── 全局单例 ──

_pool: Optional[FactorPool] = None


def get_pool() -> FactorPool:
    global _pool
    if _pool is None:
        _pool = FactorPool()
    return _pool
