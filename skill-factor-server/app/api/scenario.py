import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from app.models.scenario import Scenario, ExtractRequest
from app.services.scenario_extractor import extract_scenario

router = APIRouter(tags=["scenario"])

HISTORY_FILE = Path(__file__).resolve().parent.parent / "data" / "scenario_history.json"


def _load_history() -> list[dict]:
    if HISTORY_FILE.exists():
        return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    return []


def _save_history(history: list[dict]):
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


@router.post("/scenario/extract", response_model=Scenario)
async def extract(req: ExtractRequest):
    if not req.raw.strip():
        raise HTTPException(status_code=400, detail="raw 字段不能为空")
    try:
        scenario = await extract_scenario(req.raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 调用失败: {str(e)}")
    history = _load_history()
    history.append(scenario.model_dump())
    _save_history(history)
    return scenario


@router.get("/scenario/history", response_model=list[Scenario])
async def history():
    return _load_history()
