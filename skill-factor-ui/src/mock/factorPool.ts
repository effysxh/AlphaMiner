import type { CorrelationEntry, FamilyGroup, FactorPoolSummary } from '../types/factorPool';

export const mockFactorPoolSummary: FactorPoolSummary = {
  total_factors: 12,
  candidate_count: 5,
  rejected_count: 3,
  low_score_count: 4,
  current_phase: 'early',
  top10_factor_ids: ['F_MOM_001', 'F_MOM_005', 'F_COR_007', 'F_MOM_002', 'F_NRM_012'],
};

export const mockCorrelations: CorrelationEntry[] = [
  { factor_id_a: 'F_MOM_001', factor_id_b: 'F_MOM_002', pearson_corr: 0.75 },
  { factor_id_a: 'F_MOM_001', factor_id_b: 'F_MOM_005', pearson_corr: 0.38 },
  { factor_id_a: 'F_MOM_001', factor_id_b: 'F_COR_007', pearson_corr: 0.45 },
  { factor_id_a: 'F_MOM_001', factor_id_b: 'F_NRM_012', pearson_corr: 0.52 },
  { factor_id_a: 'F_MOM_002', factor_id_b: 'F_MOM_005', pearson_corr: 0.32 },
  { factor_id_a: 'F_MOM_002', factor_id_b: 'F_COR_007', pearson_corr: 0.55 },
  { factor_id_a: 'F_MOM_002', factor_id_b: 'F_NRM_012', pearson_corr: 0.58 },
  { factor_id_a: 'F_MOM_005', factor_id_b: 'F_COR_007', pearson_corr: 0.52 },
  { factor_id_a: 'F_MOM_005', factor_id_b: 'F_NRM_012', pearson_corr: 0.35 },
  { factor_id_a: 'F_COR_007', factor_id_b: 'F_NRM_012', pearson_corr: 0.48 },
];

export const mockFamilyGroups: FamilyGroup[] = [
  { family_hash: 'f9e8d7c6b5a4', representative_ops: ['sub', 'mul'], member_count: 1, factor_ids: ['F_MOM_001'] },
  { family_hash: 'e7d6c5b4a3f2', representative_ops: ['ts_mean', 'ts_std', 'div'], member_count: 4, factor_ids: ['F_MOM_002', 'F_NRM_012', 'F_REV_004', 'F_ZSC_008'] },
  { family_hash: 'c3d4e5f6a7b8', representative_ops: ['last', 'vwap', 'sub', 'div'], member_count: 1, factor_ids: ['F_MOM_005'] },
  { family_hash: 'b4c5d6e7f8a9', representative_ops: ['corr', 'log_arr'], member_count: 2, factor_ids: ['F_COR_007', 'F_SKW_009'] },
  { family_hash: '1a2b3c4d5e6f', representative_ops: ['ts_skew'], member_count: 1, factor_ids: ['F_SKW_009'] },
  { family_hash: 'd5e6f7a8b9c0', representative_ops: ['zscore', 'last', 'sub'], member_count: 5, factor_ids: ['F_ZSC_008', 'F_MLT_011'] },
];
