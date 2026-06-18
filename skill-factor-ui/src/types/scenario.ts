export type Market = 'equity' | 'futures' | 'crypto' | 'fx';
export type Target = 'direction' | 'ic' | 'rank_ic' | 'return';
export type FactorType = 'single_asset_timing' | 'cross_sectional';
export type IntentType =
  | 'novelty_boost'
  | 'redundancy_strict'
  | 'simplicity'
  | 'quality_first'
  | 'diversity_boost'
  | 'refinement';

export interface WeightBias {
  novelty?: number;
  redundancy?: number;
  complexity?: number;
  diversity?: number;
}

export interface Scenario {
  raw: string;
  market: Market;
  universe: string[];
  frequency: string;
  horizon: number;
  target: Target;
  factor_type: FactorType;
  fields: string[];
  constraints?: Record<string, string>;
  preferred_signals?: string[];
  weight_bias?: WeightBias;
  intent?: IntentType;
}

export const MARKET_OPTIONS: { value: Market; label: string }[] = [
  { value: 'equity', label: '股票' },
  { value: 'futures', label: '期货' },
  { value: 'crypto', label: '加密货币' },
  { value: 'fx', label: '外汇' },
];

export const TARGET_OPTIONS: { value: Target; label: string }[] = [
  { value: 'direction', label: '方向' },
  { value: 'ic', label: 'IC' },
  { value: 'rank_ic', label: 'Rank IC' },
  { value: 'return', label: '收益率' },
];

export const FACTOR_TYPE_OPTIONS: { value: FactorType; label: string }[] = [
  { value: 'single_asset_timing', label: '单资产择时' },
  { value: 'cross_sectional', label: '横截面' },
];

export const FIELD_OPTIONS = [
  'close', 'open', 'high', 'low', 'volume', 'returns', 'vwap',
];

export const FREQUENCY_OPTIONS = ['5min', '15min', '1h', '4h', '1d'];

export const INTENT_CONFIG: Record<IntentType, { label: string; description: string; icon: string; bias: WeightBias }> = {
  novelty_boost: {
    label: '追求新颖',
    description: '生成与已有因子差异较大的新因子',
    icon: 'Sparkles',
    bias: { novelty: 0.15 },
  },
  redundancy_strict: {
    label: '低冗余',
    description: '与已有核心因子低相关，互补性强',
    icon: 'Shield',
    bias: { redundancy: 0.10 },
  },
  simplicity: {
    label: '简单可解释',
    description: '结构简洁、易于理解的因子',
    icon: 'Minimize2',
    bias: { complexity: 0.10 },
  },
  quality_first: {
    label: '质量优先',
    description: '只要预测效果好的因子',
    icon: 'Target',
    bias: { novelty: -0.10 },
  },
  diversity_boost: {
    label: '结构多样',
    description: '探索不同类型的因子结构',
    icon: 'GitBranch',
    bias: { diversity: 0.10 },
  },
  refinement: {
    label: '精细优化',
    description: '改进现有因子而非探索新方向',
    icon: 'Wrench',
    bias: { novelty: -0.10, redundancy: -0.05 },
  },
};
