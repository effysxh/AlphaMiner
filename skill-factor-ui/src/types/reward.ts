export type Phase = 'early' | 'mid' | 'late';

export interface RewardScores {
  direction_accuracy: number;
  ic: number;
  rank_ic: number;
  signal_return: number;
  novelty: number;
  redundancy: number;
  family_diversity: number;
  complexity: number;
  total_reward: number;
}

export interface BaseWeights {
  w11: number;
  w12: number;
  w13: number;
  w14: number;
  w2: number;
  w3: number;
  w4: number;
  w5: number;
}

export interface WeightConfig {
  phase: Phase;
  base_weights: BaseWeights;
  weight_bias: Partial<Record<keyof BaseWeights, number>>;
}

export interface NormalizedReward {
  direction_accuracy: number;
  ic: number;
  rank_ic: number;
  signal_return: number;
  novelty: number;
  redundancy: number;
  family_diversity: number;
  complexity: number;
}

export const PHASE_THRESHOLDS = {
  early: { label: '初期', desc: '< 50 因子', color: '#22c55e', maxFactors: 50 },
  mid: { label: '中期', desc: '50~200 因子', color: '#f59e0b', maxFactors: 200 },
  late: { label: '后期', desc: '> 200 因子', color: '#ef4444', maxFactors: Infinity },
};

export const PHASE_WEIGHTS: Record<Phase, BaseWeights> = {
  early: { w11: 0.10, w12: 0.30, w13: 0.30, w14: 0.10, w2: 0.05, w3: 0.05, w4: 0.05, w5: 0.05 },
  mid:   { w11: 0.10, w12: 0.20, w13: 0.20, w14: 0.10, w2: 0.12, w3: 0.10, w4: 0.10, w5: 0.08 },
  late:  { w11: 0.05, w12: 0.15, w13: 0.15, w14: 0.05, w2: 0.15, w3: 0.15, w4: 0.15, w5: 0.15 },
};

export const REWARD_DIMENSIONS = [
  { key: 'direction_accuracy', label: '方向准确率', formula: '(sign(f) == sign(r)) 准确率 - 0.5', normalize: (x: number) => 2 * x + 1 },
  { key: 'ic', label: 'IC', formula: 'Pearson 相关 |IC|', normalize: (x: number) => Math.min(1, Math.abs(x) / 0.10) },
  { key: 'rank_ic', label: 'Rank IC', formula: 'Spearman 秩相关 |RankIC|', normalize: (x: number) => Math.min(1, Math.abs(x) / 0.10) },
  { key: 'signal_return', label: '信号收益', formula: 'tanh(α × sign(f)·r)', normalize: (x: number) => (x + 1) / 2 },
  { key: 'novelty', label: '新颖性', formula: '1 - max cos_sim(e_new, e_i)', normalize: (x: number) => x },
  { key: 'redundancy', label: '冗余性', formula: '-(|ρ| - ρ_threshold)', normalize: (x: number) => 1 / (1 + Math.exp(-x)) },
  { key: 'family_diversity', label: '族多样性', formula: '新族+0.02 / 重复-0.02', normalize: (x: number) => Math.min(1, Math.abs(x) / 0.02) },
  { key: 'complexity', label: '复杂性', formula: '-(Depth - Depth_safe)', normalize: (x: number) => Math.min(1, Math.abs(x) / 0.05) },
] as const;
