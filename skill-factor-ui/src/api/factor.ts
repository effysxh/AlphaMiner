import type { Factor } from '../types/factor';
import type { Scenario } from '../types/scenario';
import { USE_MOCK, apiFetch, mockDelay } from './client';
import { mockFactors } from '../mock/factors';

export async function generateFactors(scenario: Scenario): Promise<Factor[]> {
  if (USE_MOCK) {
    await mockDelay(1500);
    return mockFactors;
  }
  return apiFetch<Factor[]>('/factors/generate', { method: 'POST', body: JSON.stringify(scenario) });
}

export async function getFactor(factorId: string): Promise<Factor> {
  if (USE_MOCK) {
    await mockDelay(200);
    const f = mockFactors.find(f => f.meta.factor_id === factorId);
    if (!f) throw new Error(`因子 ${factorId} 不存在`);
    return f;
  }
  return apiFetch<Factor>(`/factors/${factorId}`);
}

export async function listFactors(status?: string): Promise<Factor[]> {
  if (USE_MOCK) {
    await mockDelay(300);
    if (status) return mockFactors.filter(f => f.status === status);
    return mockFactors;
  }
  const query = status ? `?status=${status}` : '';
  return apiFetch<Factor[]>(`/factors${query}`);
}
