import type { RewardScores, WeightConfig } from '../types/reward';
import type { Scenario } from '../types/scenario';
import { USE_MOCK, apiFetch, mockDelay } from './client';
import { mockRewardSets } from '../mock/rewards';
import { PHASE_WEIGHTS } from '../types/reward';

export async function calculateReward(factorId: string, scenario: Scenario): Promise<RewardScores> {
  if (USE_MOCK) {
    await mockDelay(500);
    return mockRewardSets[factorId] || { direction_accuracy: 0.05, ic: 0.03, rank_ic: 0.06, signal_return: 0.08, novelty: 0.5, redundancy: -0.2, family_diversity: 0.0, complexity: -0.01, total_reward: 0.55 };
  }
  return apiFetch<RewardScores>(`/reward/calculate`, { method: 'POST', body: JSON.stringify({ factor_id: factorId, scenario }) });
}

export async function getWeightConfig(totalFactorCount: number, bias?: Record<string, number>): Promise<WeightConfig> {
  if (USE_MOCK) {
    await mockDelay(200);
    const phase = totalFactorCount < 50 ? 'early' : totalFactorCount < 200 ? 'mid' : 'late';
    return { phase, base_weights: PHASE_WEIGHTS[phase], weight_bias: bias || {} };
  }
  return apiFetch<WeightConfig>('/reward/weights', { method: 'POST', body: JSON.stringify({ total_factor_count: totalFactorCount, bias }) });
}
