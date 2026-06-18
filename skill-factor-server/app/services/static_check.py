"""静态校验管线 (Spec 4.3)。

检查顺序：语法 → 未来数据泄露 → 未知算子/类型违规 → 深度。
任一阶段失败即终止后续检查。
"""

from __future__ import annotations

import ast
from typing import Optional

from app.models.factor import StaticCheck
from app.models.dsl import (
    ALL_OPS, FIELD_ACCESSORS, OP_SIGNATURES,
    infer_type, collect_call_names, compute_ast_depth,
    is_window_position, TypeKind,
)


def run_static_check(
    expression: str,
    depth_safe_limit: int = 4,
    allowed_fields: Optional[list[str]] = None,
) -> StaticCheck:
    """运行完整静态校验管线。"""
    # 默认允许的字段
    if allowed_fields is None:
        allowed_fields = list(FIELD_ACCESSORS)

    # ── 4.3.1 语法检查 ──
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as e:
        return StaticCheck(
            syntax_valid=False,
            unknown_ops=[],
            depth=0,
            depth_safe_limit=depth_safe_limit,
            future_leak=False,
            future_leak_details=None,
            field_compliant=True,
            passed=False,
        )

    # ── 4.3.2 未来数据泄露检查 (在未知算子检查之前) ──
    leak, leak_detail = _check_future_leak(tree, expression)
    if leak:
        return StaticCheck(
            syntax_valid=True,
            unknown_ops=[],
            depth=0,
            depth_safe_limit=depth_safe_limit,
            future_leak=True,
            future_leak_details=leak_detail,
            field_compliant=True,
            passed=False,
        )

    # ── 4.3.3 未知算子检查 ──
    unknown = _check_unknown_ops(tree)
    # ── 字段合规检查 ──
    field_compliant = _check_field_compliance(tree, allowed_fields)
    # ── 类型约束检查 ──
    type_violations = _check_type_constraints(tree)

    # ── 4.3.4 深度检查 ──
    depth = compute_ast_depth(tree.body) if hasattr(tree, "body") else compute_ast_depth(tree)

    passed = (
        len(unknown) == 0
        and field_compliant
        and len(type_violations) == 0
        and depth <= depth_safe_limit
    )

    return StaticCheck(
        syntax_valid=True,
        unknown_ops=unknown,
        depth=depth,
        depth_safe_limit=depth_safe_limit,
        future_leak=False,
        future_leak_details=None,
        field_compliant=field_compliant,
        passed=passed,
    )


# ── 未来数据泄露检测 ──

_FUTURE_KEYWORDS = {"future", "lookahead", "peek"}


def _check_future_leak(tree: ast.AST, expression: str) -> tuple[bool, Optional[str]]:
    """检测所有可能导致使用未来数据的模式。"""

    # 1) 表达式中的保留关键字
    lower_expr = expression.lower()
    for kw in _FUTURE_KEYWORDS:
        if kw in lower_expr.split():  # 整词匹配
            return True, f"未来数据关键字: {kw}"

    # 2) 遍历 AST 检测
    for node in ast.walk(tree):
        # 检查函数调用中的窗口参数
        if isinstance(node, ast.Call):
            func_name = _call_name(node)
            for i, arg in enumerate(node.args):
                # 窗口参数位置必须 >= 1
                if is_window_position(node, i):
                    val = _extract_int_constant(arg)
                    if val is not None and val < 1:
                        return True, f"窗口参数 {val} < 1: {_call_name(node)}"

    # 3) UnaryOp USub 产生负数（出现在窗口参数位置）
    if _has_negative_in_window_position(tree):
        return True, "负数出现在窗口参数位置"

    return False, None


def _has_negative_in_window_position(tree: ast.AST) -> bool:
    """检测窗口参数位置的负数字面量。"""
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        for i, arg in enumerate(node.args):
            if is_window_position(node, i):
                if isinstance(arg, ast.UnaryOp) and isinstance(arg.op, ast.USub):
                    if isinstance(arg.operand, ast.Constant):
                        return True
    return False


def _extract_int_constant(node: ast.AST) -> Optional[int]:
    """从 AST 节点提取整数值，支持 UnaryOp(USub, Constant)。"""
    if isinstance(node, ast.Constant) and isinstance(node.value, int):
        return node.value
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        if isinstance(node.operand, ast.Constant) and isinstance(node.operand.value, int):
            return -node.operand.value
    return None


# ── 未知算子检查 ──

def _check_unknown_ops(tree: ast.AST) -> list[str]:
    """收集不在 ALL_OPS 中的函数调用名。"""
    names = collect_call_names(tree)
    return [n for n in names if n not in ALL_OPS]


def _check_field_compliance(tree: ast.AST, allowed_fields: list[str]) -> bool:
    """检查使用的字段名是否在允许列表中。"""
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            name = _call_name(node)
            if name in FIELD_ACCESSORS and name not in allowed_fields:
                return False
    return True


# ── 类型约束检查 ──

def _check_type_constraints(tree: ast.AST) -> list[str]:
    """检查算子参数的类型约束是否满足。"""
    violations = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func_name = _call_name(node)
        if func_name not in OP_SIGNATURES:
            continue
        sigs = OP_SIGNATURES[func_name]
        for i, (param_name, expected_type) in enumerate(sigs):
            if i >= len(node.args):
                violations.append(f"{func_name}: 缺少参数 {param_name}")
                continue
            if expected_type == "int_constant":
                val = _extract_int_constant(node.args[i])
                if val is None:
                    violations.append(f"{func_name}({param_name}): 期望整数常量")
            elif expected_type in ("Array", "Scalar"):
                actual = infer_type(node.args[i])
                if actual != expected_type and actual != TypeKind.Unknown.value:
                    violations.append(
                        f"{func_name}({param_name}): 期望 {expected_type}, 实际 {actual}"
                    )
    return violations


def _call_name(node: ast.Call) -> str:
    if isinstance(node.func, ast.Name):
        return node.func.id
    if isinstance(node.func, ast.Attribute):
        return node.func.attr
    return ""
