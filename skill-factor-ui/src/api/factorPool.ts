import type { CorrelationEntry, FamilyGroup, FactorPoolSummary, RefinementCycle } from '../types/factorPool';
import { USE_MOCK, apiFetch, mockDelay } from './client';
import { mockCorrelations, mockFamilyGroups, mockFactorPoolSummary } from '../mock/factorPool';
import { mockRefinementCycles } from '../mock/refinement';

export async function getPoolSummary(): Promise<FactorPoolSummary> {
  if (USE_MOCK) {
    await mockDelay(200);
    return mockFactorPoolSummary;
  }
  return apiFetch<FactorPoolSummary>('/pool/summary');
}

export async function getCorrelationMatrix(): Promise<CorrelationEntry[]> {
  if (USE_MOCK) {
    await mockDelay(300);
    return mockCorrelations;
  }
  return apiFetch<CorrelationEntry[]>('/pool/correlation');
}

export async function getFamilyGroups(): Promise<FamilyGroup[]> {
  if (USE_MOCK) {
    await mockDelay(300);
    return mockFamilyGroups;
  }
  return apiFetch<FamilyGroup[]>('/pool/families');
}

export async function getRefinementCycles(): Promise<RefinementCycle[]> {
  if (USE_MOCK) {
    await mockDelay(300);
    return mockRefinementCycles;
  }
  return apiFetch<RefinementCycle[]>('/pool/refinements');
}

export async function submitRefinement(factorId: string, feedback: string): Promise<RefinementCycle> {
  if (USE_MOCK) {
    await mockDelay(1000);
    const cycle = mockRefinementCycles.find(c => c.original_factor_id === factorId);
    if (cycle) return cycle;
    return mockRefinementCycles[0];
  }
  return apiFetch<RefinementCycle>('/pool/refine', { method: 'POST', body: JSON.stringify({ factor_id: factorId, feedback }) });
}
