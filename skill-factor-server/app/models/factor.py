from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ── Status ──

class FactorStatus(str, Enum):
    candidate = "Candidate"
    rejected = "Rejected"
    low_score = "LowScore"


# ── Meta ──

class FactorMeta(BaseModel):
    factor_id: str
    version: str = "1.0"
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    generator_model: str = ""


# ── Scenario (inline, reused from scenario.py conceptually) ──

class FactorScenario(BaseModel):
    market: str
    universe: List[str]
    frequency: str
    horizon: int
    target: str
    factor_type: str


# ── Definition ──

class FactorDefinition(BaseModel):
    name: str
    description: str = ""
    expression: str
    code: str
    dsl_ops_used: List[str] = Field(default_factory=list)
    data_path: Optional[str] = None


# ── Static Check ──

class StaticCheck(BaseModel):
    syntax_valid: bool
    unknown_ops: List[str] = Field(default_factory=list)
    depth: int = 0
    depth_safe_limit: int = 4
    future_leak: bool = False
    future_leak_details: Optional[str] = None
    field_compliant: bool = True
    passed: bool


# ── Reward Scores (raw) ──

class RewardScoresRaw(BaseModel):
    direction_accuracy: float = 0.0
    ic: float = 0.0
    rank_ic: float = 0.0
    signal_return: float = 0.0
    novelty: float = 0.0
    redundancy: float = 0.0
    family_diversity: float = 0.0
    complexity: float = 0.0
    total_reward: float = 0.0


# ── Weight Config ──

class WeightConfig(BaseModel):
    phase: str = "early"
    base_weights: Dict[str, float] = {}
    weight_bias: Dict[str, float] = Field(default_factory=dict)


# ── Performance ──

class Performance(BaseModel):
    ic_ir: float = 0.0
    win_rate: float = 0.0
    turnover: float = 0.0
    max_drawdown: float = 0.0


# ── Archives ──

class Archives(BaseModel):
    novelty_hash: str = ""
    embedding_path: Optional[str] = None
    novelty_max_sim: float = 0.0
    novelty_most_similar_factor: Optional[str] = None
    redundancy_top_factor: Optional[str] = None
    redundancy_max_corr: float = 0.0
    family_hash: str = ""
    family_count: int = 0
    is_new_family: bool = False


# ── Evolution ──

class TraceNode(BaseModel):
    factor_id: str
    expression: str
    total_reward: float
    reject_reason: Optional[str] = None
    llm_feedback: Optional[str] = None
    improved: Optional[bool] = None


class Evolution(BaseModel):
    parent_id: Optional[str] = None
    children_ids: List[str] = Field(default_factory=list)
    depth: int = 0
    improved: Optional[bool] = None
    exploration_count: int = 0
    trace: List[TraceNode] = Field(default_factory=list)


# ── Factor Record (complete) ──

class FactorRecord(BaseModel):
    meta: FactorMeta
    scenario: FactorScenario
    definition: FactorDefinition
    static_check: StaticCheck
    reward_scores_raw: Optional[RewardScoresRaw] = None
    weight_config: Optional[WeightConfig] = None
    performance: Optional[Performance] = None
    archives: Optional[Archives] = None
    evolution: Evolution = Field(default_factory=Evolution)
    status: FactorStatus
    reject_reason: Optional[str] = None
    notes: Optional[str] = None

    @property
    def factor_id(self) -> str:
        return self.meta.factor_id


# ── Request / Response Models ──

class GenerateRequest(BaseModel):
    """POST /factors/generate 请求体。"""
    scenario: dict
    generate_num: int = 5


class GenerateResponse(BaseModel):
    """POST /factors/generate 响应体。"""
    factors: list[dict]


class RewardCalculateRequest(BaseModel):
    """POST /reward/calculate 请求体。"""
    factor_values: list[float]
    future_returns: list[float]
    expression: str
    scenario: Optional[dict] = None
    weight_bias: Optional[Dict[str, float]] = None
    ast_depth: int = 0
    depth_safe_limit: int = 4


class RefineRequest(BaseModel):
    """POST /pool/refine 请求体。"""
    scenario: dict
    top_k: int = 3
    generate_num: int = 5
    search_time: int = 1
