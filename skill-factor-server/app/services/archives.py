"""Novelty / FamilyDiversity / Embedding 计算服务 (Spec 3.3, 3.5)。

实现表达式规范化、窗口分桶、哈希计算、语义嵌入、新颖性评分和族多样性评分。
"""

from __future__ import annotations

import ast
import hashlib
import re
from pathlib import Path
from typing import Optional

import numpy as np

from app.models.dsl import (
    ALL_OPS, FIELD_ACCESSORS, ARRAY_TO_ARRAY, ARRAY_TO_SCALAR,
    SCALAR_UNARY, SCALAR_BINARY, MIXED_OPS,
    window_bucket, op_return_type,
)
from app.models.factor import Archives
from app.services.llm_client import call_embedding
from app.services.factor_pool import FactorPool


# ══════════════════════════════════════════════════════════════════
#  表达式规范化 (Canonicalization)
# ══════════════════════════════════════════════════════════════════

# 交换律算子：参数可以按字典序排列
_COMMUTATIVE_OPS = {"add", "add_arr", "mul", "mul_arr"}

# 运算符归一化映射
_OP_NORMALIZE = {
    "sma": "mean",
    "lag": "shift",
}


class _Canonicalizer(ast.NodeTransformer):
    """AST 规范化变换器。"""

    def visit_BinOp(self, node: ast.BinOp) -> ast.AST:
        self.generic_visit(node)
        # 交换律排序：+ 和 * 按序列化结果字典序排列
        if isinstance(node.op, (ast.Add, ast.Mult)):
            left_str = ast.dump(node.left)
            right_str = ast.dump(node.right)
            if left_str > right_str:
                node.left, node.right = node.right, node.left
        return node

    def visit_Call(self, node: ast.Call) -> ast.AST:
        self.generic_visit(node)
        func_name = _call_name(node)
        # 函数名归一化
        if func_name in _OP_NORMALIZE:
            if isinstance(node.func, ast.Name):
                node.func.id = _OP_NORMALIZE[func_name]
            func_name = _OP_NORMALIZE[func_name]
        # 交换律函数排序
        if func_name in _COMMUTATIVE_OPS and len(node.args) == 2:
            left_str = ast.dump(node.args[0])
            right_str = ast.dump(node.args[1])
            if left_str > right_str:
                node.args[0], node.args[1] = node.args[1], node.args[0]
        return node


def canonicalize_expression(expression: str) -> str:
    """表达式规范化：交换律排序 + 运算符归一化。"""
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError:
        return expression
    canonicalized = _Canonicalizer().visit(tree)
    ast.fix_missing_locations(canonicalized)
    return ast.unparse(canonicalized.body) if hasattr(canonicalized, 'body') else ast.unparse(canonicalized)


# ══════════════════════════════════════════════════════════════════
#  窗口分桶 + AST 序列化
# ══════════════════════════════════════════════════════════════════

class _WindowBucketer(ast.NodeTransformer):
    """将数值常量替换为窗口桶标签。"""

    def visit_Constant(self, node: ast.Constant) -> ast.AST:
        if isinstance(node.value, (int, float)):
            bucket = window_bucket(node.value)
            return ast.Name(id=bucket, ctx=ast.Load())
        return node


def _bucket_ast(expression: str) -> ast.AST:
    """解析表达式并替换常量为桶标签。"""
    tree = ast.parse(expression, mode="eval")
    bucketer = _WindowBucketer()
    tree = bucketer.visit(tree)
    ast.fix_missing_locations(tree)
    return tree


def serialize_ast(expression: str) -> str:
    """窗口分桶后 DFS 序列化为 S-expression。

    规则:
    - 二元运算: (op left right)
    - 函数调用: (func arg1 arg2 ...)
    - 叶子节点: token
    """
    tree = _bucket_ast(expression)
    return _serialize_node(tree.body if hasattr(tree, 'body') else tree)


def _serialize_node(node: ast.AST) -> str:
    if isinstance(node, ast.Constant):
        return str(node.value)
    if isinstance(node, ast.Name):
        return node.id

    if isinstance(node, ast.BinOp):
        op_map = {
            ast.Add: "+", ast.Sub: "-", ast.Mult: "*", ast.Div: "/",
            ast.FloorDiv: "//", ast.Mod: "%", ast.Pow: "**",
        }
        op_str = op_map.get(type(node.op), "?")
        left = _serialize_node(node.left)
        right = _serialize_node(node.right)
        return f"({op_str} {left} {right})"

    if isinstance(node, ast.UnaryOp):
        if isinstance(node.op, ast.USub):
            return f"(- {_serialize_node(node.operand)})"
        if isinstance(node.op, ast.UAdd):
            return _serialize_node(node.operand)
        if isinstance(node.op, ast.Not):
            return f"(not {_serialize_node(node.operand)})"

    if isinstance(node, ast.Call):
        func_name = _call_name(node)
        args = " ".join(_serialize_node(a) for a in node.args)
        if args:
            return f"({func_name} {args})"
        return f"({func_name})"

    return ast.dump(node)


# ══════════════════════════════════════════════════════════════════
#  哈希计算
# ══════════════════════════════════════════════════════════════════

def compute_novelty_hash(expression: str) -> str:
    """Novelty 哈希: 规范化 + 分桶序列化后 SHA256。"""
    canonical = canonicalize_expression(expression)
    serialized = serialize_ast(canonical)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def compute_family_hash(expression: str) -> str:
    """Family 哈希: 分桶后 ast.dump 序列化，SHA1 前 16 位。"""
    tree = _bucket_ast(expression)
    dumped = ast.dump(tree, annotate_fields=False)
    return hashlib.sha1(dumped.encode("utf-8")).hexdigest()[:16]


# ══════════════════════════════════════════════════════════════════
#  Novelty 评分 (Spec 3.3)
# ══════════════════════════════════════════════════════════════════

async def compute_novelty_score(
    expression: str,
    pool: FactorPool,
    embedding: Optional[np.ndarray] = None,
) -> tuple[float, str, float, Optional[str]]:
    """完整 Novelty 评分。

    Returns:
        (novelty_score, novelty_hash, max_sim, most_similar_id)
        - 哈希精确匹配: novelty = -1.0
        - 有 embedding: novelty = 1 - max_cosine_similarity
        - 无 embedding: novelty = 0.5 (中性)
    """
    n_hash = compute_novelty_hash(expression)

    # Step 3: 哈希硬去重
    dup_id = pool.query_novelty(n_hash)
    if dup_id is not None:
        return -1.0, n_hash, 1.0, dup_id

    # Step 4: 语义软评分
    if embedding is not None and len(pool._embedding_cache) > 0:
        max_sim, best_id = pool.query_novelty_embedding(embedding)
        novelty = 1.0 - max_sim
        return novelty, n_hash, max_sim, best_id

    # 无 embedding 数据，返回中性评分
    return 0.5, n_hash, 0.0, None


# ══════════════════════════════════════════════════════════════════
#  FamilyDiversity 评分 (Spec 3.5)
# ══════════════════════════════════════════════════════════════════

def compute_family_diversity(
    expression: str,
    pool: FactorPool,
    reward_score: float,
    family_free_quota: int = 8,
    family_good_new_threshold: float = 0.10,
    family_new_bonus: float = 0.02,
    family_repeat_penalty: float = 0.02,
    family_low_quality_threshold: float = 0.08,
) -> tuple[float, str, int, bool]:
    """计算族多样性评分。

    Returns:
        (score, family_hash, family_count, is_new_family)
    """
    f_hash = compute_family_hash(expression)
    family_count = pool.query_family(f_hash)
    is_new = family_count == 0

    if is_new and reward_score >= family_good_new_threshold:
        score = family_new_bonus
    elif family_count > family_free_quota and reward_score < family_low_quality_threshold:
        score = -family_repeat_penalty
    else:
        score = 0.0

    return score, f_hash, family_count, is_new


# ══════════════════════════════════════════════════════════════════
#  完整 Archives 计算
# ══════════════════════════════════════════════════════════════════

async def compute_archives(
    expression: str,
    pool: FactorPool,
    reward_score: float = 0.0,
    factor_id: str = "",
) -> tuple[Archives, Optional[np.ndarray]]:
    """计算完整 Archives 模型。

    Returns:
        (archives_model, embedding_array_or_None)
    """
    # 获取 embedding
    embedding = await call_embedding(expression)

    # Novelty
    novelty_score, novelty_hash, max_sim, most_similar_id = await compute_novelty_score(
        expression, pool, embedding
    )

    # Family
    family_score, family_hash, family_count, is_new_family = compute_family_diversity(
        expression, pool, reward_score
    )

    # Redundancy (需要因子值，此处仅初始化占位)
    archives = Archives(
        novelty_hash=novelty_hash,
        embedding_path=f"embeddings/{factor_id}.npy" if embedding is not None else None,
        novelty_max_sim=max_sim,
        novelty_most_similar_factor=most_similar_id,
        redundancy_top_factor=None,
        redundancy_max_corr=0.0,
        family_hash=family_hash,
        family_count=family_count,
        is_new_family=is_new_family,
    )

    return archives, embedding


# ── 工具函数 ──

def _call_name(node: ast.Call) -> str:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return ""
