import type { Phase } from './reward';
import type { FactorStatus } from './factor';

export interface CorrelationEntry {
  factor_id_a: string;
  factor_id_b: string;
  pearson_corr: number;
}

export interface DAGNode {
  factor_id: string;
  expression: string;
  total_reward: number;
  status: FactorStatus;
  depth: number;
  parent_id: string | null;
  children_ids: string[];
  reject_reason?: string;
  llm_feedback?: string;
  improved?: boolean;
  timestamp: string;
}

export interface DAGEdge {
  from: string;
  to: string;
  improved: boolean;
}

export interface DAGGraph {
  nodes: DAGNode[];
  edges: DAGEdge[];
}

export interface FamilyGroup {
  family_hash: string;
  representative_ops: string[];
  member_count: number;
  factor_ids: string[];
}

export interface FactorPoolSummary {
  total_factors: number;
  candidate_count: number;
  rejected_count: number;
  low_score_count: number;
  current_phase: Phase;
  top10_factor_ids: string[];
}

export interface RefinementCycle {
  id: string;
  original_factor_id: string;
  original_expression: string;
  original_total_reward: number;
  reject_reason: string;
  llm_feedback: string;
  refined_factor_id: string;
  refined_expression: string;
  refined_total_reward: number;
  improved: boolean;
  timestamp: string;
}
