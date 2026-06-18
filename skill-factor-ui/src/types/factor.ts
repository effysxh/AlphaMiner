import type { Scenario } from './scenario';
import type { StaticCheckResult } from './staticCheck';
import type { RewardScores, WeightConfig, Phase } from './reward';

export type FactorStatus = 'Candidate' | 'Rejected' | 'LowScore';

export interface FactorMeta {
  factor_id: string;
  version: string;
  generated_at: string;
  generator_model: string;
}

export interface FactorDefinition {
  name: string;
  description: string;
  expression: string;
  code: string;
  dsl_ops_used: string[];
  data_path: string | null;
}

export interface Performance {
  ic_ir: number;
  win_rate: number;
  turnover: number;
  max_drawdown: number;
}

export interface FactorArchives {
  novelty_hash: string;
  embedding_path: string | null;
  novelty_max_sim: number;
  novelty_most_similar_factor: string;
  redundancy_top_factor: string;
  redundancy_max_corr: number;
  family_hash: string;
  family_count: number;
  is_new_family: boolean;
}

export interface Factor {
  meta: FactorMeta;
  scenario: Pick<Scenario, 'market' | 'universe' | 'frequency' | 'horizon' | 'target' | 'factor_type'>;
  definition: FactorDefinition;
  static_check: StaticCheckResult;
  reward_scores_raw: RewardScores | null;
  weight_config: WeightConfig | null;
  performance: Performance | null;
  archives: FactorArchives | null;
  status: FactorStatus;
  reject_reason?: string;
  notes?: string;
}

export interface FactorScenarioSummary {
  market: string;
  universe: string[];
  frequency: string;
  horizon: number;
  target: string;
  factor_type: string;
}
