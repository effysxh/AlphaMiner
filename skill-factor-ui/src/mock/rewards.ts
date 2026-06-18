import type { RewardScores } from '../types/reward';

export const mockRewardSets: Record<string, RewardScores> = {
  F_MOM_001: { direction_accuracy: 0.08, ic: 0.045, rank_ic: 0.12, signal_return: 0.15, novelty: 0.9, redundancy: -0.15, family_diversity: 0.02, complexity: -0.01, total_reward: 0.84 },
  F_MOM_002: { direction_accuracy: 0.06, ic: 0.038, rank_ic: 0.09, signal_return: 0.12, novelty: 0.75, redundancy: -0.35, family_diversity: 0.0, complexity: 0.0, total_reward: 0.72 },
  F_MOM_005: { direction_accuracy: 0.09, ic: 0.052, rank_ic: 0.11, signal_return: 0.18, novelty: 0.85, redundancy: -0.10, family_diversity: 0.02, complexity: 0.0, total_reward: 0.82 },
  F_COR_007: { direction_accuracy: 0.07, ic: 0.042, rank_ic: 0.10, signal_return: 0.14, novelty: 0.8, redundancy: -0.20, family_diversity: 0.02, complexity: -0.01, total_reward: 0.78 },
  F_NRM_012: { direction_accuracy: 0.07, ic: 0.044, rank_ic: 0.10, signal_return: 0.13, novelty: 0.55, redundancy: -0.28, family_diversity: 0.0, complexity: 0.0, total_reward: 0.73 },
};
