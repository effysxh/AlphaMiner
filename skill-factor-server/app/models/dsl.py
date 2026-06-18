"""DSL 算子注册表，来自 DSL参考.md。"""

from __future__ import annotations

import ast
from enum import Enum
from typing import Literal

# ── 算子分类 ──

FIELD_ACCESSORS = frozenset(["close", "open", "high", "low", "volume", "returns", "vwap"])

ARRAY_TO_ARRAY = frozenset([
    "diff", "log_arr", "normalize", "ema_arr", "slice_arr",
    "add_arr", "sub_arr", "mul_arr", "div_arr",
])

ARRAY_TO_SCALAR = frozenset([
    "ts_mean", "ts_std", "ts_max", "ts_min", "ts_sum",
    "ts_skew", "ts_kurt", "last", "first", "corr", "cov",
])

SCALAR_UNARY = frozenset(["neg", "abs_s", "log_s", "tanh_s", "sign_s"])

SCALAR_BINARY = frozenset(["add", "sub", "mul", "div"])

MIXED_OPS = frozenset(["zscore", "rank"])

ALL_OPS = FIELD_ACCESSORS | ARRAY_TO_ARRAY | ARRAY_TO_SCALAR | SCALAR_UNARY | SCALAR_BINARY | MIXED_OPS

# ── 算子签名：参数名 → 期望类型 ──
# "Array" = numpy 一维数组, "Scalar" = float, "int_constant" = 正整数常量

OP_SIGNATURES: dict[str, list[tuple[str, str]]] = {
    # 字段访问器
    "close":   [("w", "int_constant")],
    "open":    [("w", "int_constant")],
    "high":    [("w", "int_constant")],
    "low":     [("w", "int_constant")],
    "volume":  [("w", "int_constant")],
    "returns": [("w", "int_constant")],
    "vwap":    [("w", "int_constant")],
    # Array → Array
    "diff":      [("arr", "Array")],
    "log_arr":   [("arr", "Array")],
    "normalize": [("arr", "Array")],
    "ema_arr":   [("arr", "Array"), ("span", "int_constant")],
    "slice_arr": [("arr", "Array"), ("w", "int_constant")],
    "add_arr":   [("a", "Array"), ("b", "Array")],
    "sub_arr":   [("a", "Array"), ("b", "Array")],
    "mul_arr":   [("a", "Array"), ("b", "Array")],
    "div_arr":   [("a", "Array"), ("b", "Array")],
    # Array → Scalar
    "ts_mean": [("arr", "Array")],
    "ts_std":  [("arr", "Array")],
    "ts_max":  [("arr", "Array")],
    "ts_min":  [("arr", "Array")],
    "ts_sum":  [("arr", "Array")],
    "ts_skew": [("arr", "Array")],
    "ts_kurt": [("arr", "Array")],
    "last":    [("arr", "Array")],
    "first":   [("arr", "Array")],
    "corr":    [("a", "Array"), ("b", "Array")],
    "cov":     [("a", "Array"), ("b", "Array")],
    # Scalar → Scalar (一元)
    "neg":    [("s", "Scalar")],
    "abs_s":  [("s", "Scalar")],
    "log_s":  [("s", "Scalar")],
    "tanh_s": [("s", "Scalar")],
    "sign_s": [("s", "Scalar")],
    # Scalar → Scalar (二元)
    "add": [("a", "Scalar"), ("b", "Scalar")],
    "sub": [("a", "Scalar"), ("b", "Scalar")],
    "mul": [("a", "Scalar"), ("b", "Scalar")],
    "div": [("a", "Scalar"), ("b", "Scalar")],
    # 混合类型
    "zscore": [("scalar", "Scalar"), ("arr", "Array")],
    "rank":   [("scalar", "Scalar"), ("arr", "Array")],
}

# ── 算子返回类型 ──

def op_return_type(op_name: str) -> str:
    if op_name in FIELD_ACCESSORS:
        return "Array" if op_name != "vwap" else "Scalar"
    if op_name in ARRAY_TO_ARRAY:
        return "Scalar" if op_name == "ema_arr" else "Array"
    if op_name in ARRAY_TO_SCALAR:
        return "Scalar"
    if op_name in SCALAR_UNARY or op_name in SCALAR_BINARY:
        return "Scalar"
    if op_name in MIXED_OPS:
        return "Scalar"
    return "Unknown"


# ── 窗口分桶 (Section 3.3 / 3.5) ──

def window_bucket(value: int | float) -> str:
    """将数值常量映射到桶标签。"""
    v = abs(value)
    if v <= 5:
        return "W_1_5"
    elif v <= 20:
        return "W_6_20"
    elif v <= 60:
        return "W_21_60"
    elif v <= 120:
        return "W_61_120"
    elif v <= 240:
        return "W_121_240"
    else:
        return "W_241_480"


# ── AST 类型推断 ──

class TypeKind(str, Enum):
    Array = "Array"
    Scalar = "Scalar"
    Unknown = "Unknown"


def infer_type(node: ast.AST) -> str:
    """递归推断 AST 节点的返回类型 (Array / Scalar / Unknown)。"""
    if isinstance(node, ast.Constant):
        return TypeKind.Scalar.value

    if isinstance(node, ast.UnaryOp):
        return infer_type(node.operand)

    if isinstance(node, ast.BinOp):
        left_t = infer_type(node.left)
        right_t = infer_type(node.right)
        # 中缀运算符 +, -, *, / 等价于 add/sub/mul/div (Scalar)
        if left_t == TypeKind.Array.value or right_t == TypeKind.Array.value:
            return TypeKind.Array.value
        return TypeKind.Scalar.value

    if isinstance(node, ast.Call):
        func_name = _get_call_name(node)
        if func_name in ALL_OPS:
            return op_return_type(func_name)
        return TypeKind.Unknown.value

    if isinstance(node, ast.Name):
        return TypeKind.Scalar.value

    return TypeKind.Unknown.value


def _get_call_name(node: ast.Call) -> str:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return ""


# ── AST 工具函数 ──

def collect_call_names(node: ast.AST) -> list[str]:
    """收集 AST 中所有函数调用名。"""
    names = []
    for child in ast.walk(node):
        if isinstance(child, ast.Call):
            names.append(_get_call_name(child))
    return names


def compute_ast_depth(node: ast.AST) -> int:
    """计算 AST 最大嵌套深度。"""
    if isinstance(node, ast.Constant) or isinstance(node, ast.Name):
        return 0
    children = list(ast.iter_child_nodes(node))
    if not children:
        return 0
    return 1 + max(compute_ast_depth(c) for c in children)


def is_window_position(node: ast.AST, arg_index: int) -> bool:
    """判断某参数位置是否为窗口参数（需为正整数常量）。"""
    if not isinstance(node, ast.Call):
        return False
    func_name = _get_call_name(node)
    if func_name not in OP_SIGNATURES:
        return False
    sigs = OP_SIGNATURES[func_name]
    if arg_index >= len(sigs):
        return False
    return sigs[arg_index][1] == "int_constant"
