"""因子 CRUD 端点，路径对齐前端 /api/v1/factors。"""

from typing import Optional

from fastapi import APIRouter, HTTPException

from app.models.factor import FactorRecord, FactorStatus
from app.services.factor_pool import get_pool

router = APIRouter(prefix="/factors", tags=["Factors"])


@router.get("")
def list_factors(status: Optional[str] = None):
    """列出因子，可按状态筛选。返回完整 FactorRecord 列表。"""
    pool = get_pool()
    if status:
        try:
            st = FactorStatus(status)
        except ValueError:
            raise HTTPException(400, f"Invalid status: {status}")
        ids = pool.list_status(st)
    else:
        ids = list(pool._by_id.keys())
    return [pool._by_id[fid].model_dump(mode="json") for fid in ids]


@router.get("/{factor_id}")
def get_factor(factor_id: str):
    """获取单个因子完整记录。"""
    record = get_pool().get(factor_id)
    if not record:
        raise HTTPException(404, f"Factor {factor_id} not found")
    return record.model_dump(mode="json")


@router.post("/generate")
def generate_factors(scenario: dict):
    """因子生成（占位，待实现 LLM 调用逻辑）。"""
    raise HTTPException(501, "Factor generation not implemented yet")
