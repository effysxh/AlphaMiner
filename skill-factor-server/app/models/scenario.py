from enum import Enum
from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class Market(str, Enum):
    equity = "equity"
    futures = "futures"
    crypto = "crypto"
    fx = "fx"


class Target(str, Enum):
    direction = "direction"
    ic = "ic"
    rank_ic = "rank_ic"
    return_ = "return"


class FactorType(str, Enum):
    single_asset_timing = "single_asset_timing"
    cross_sectional = "cross_sectional"


class IntentType(str, Enum):
    novelty_boost = "novelty_boost"
    redundancy_strict = "redundancy_strict"
    simplicity = "simplicity"
    quality_first = "quality_first"
    diversity_boost = "diversity_boost"
    refinement = "refinement"


class WeightBias(BaseModel):
    novelty: Optional[float] = None
    redundancy: Optional[float] = None
    complexity: Optional[float] = None
    diversity: Optional[float] = None


class Scenario(BaseModel):
    raw: str
    market: Market = Market.equity
    universe: List[str] = Field(default_factory=lambda: ["zz1000"])
    frequency: str = "5min"
    horizon: int = 1
    target: Target = Target.direction
    factor_type: FactorType = FactorType.single_asset_timing
    fields: List[str] = Field(default_factory=lambda: ["close", "open", "high", "low", "volume", "returns", "vwap"])
    constraints: Optional[Dict[str, str]] = None
    preferred_signals: Optional[List[str]] = None
    weight_bias: Optional[WeightBias] = None
    intent: Optional[IntentType] = None


class ExtractRequest(BaseModel):
    raw: str
