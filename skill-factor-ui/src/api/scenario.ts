import type { Scenario } from '../types/scenario';
import { USE_MOCK, apiFetch, mockDelay } from './client';
import { mockScenarios, defaultScenario } from '../mock/scenarios';

export async function extractScenario(raw: string): Promise<Scenario> {
  if (USE_MOCK) {
    await mockDelay(800);
    return { ...defaultScenario, raw };
  }
  return apiFetch<Scenario>('/scenario/extract', { method: 'POST', body: JSON.stringify({ raw }) });
}

export async function getScenarioHistory(): Promise<Scenario[]> {
  if (USE_MOCK) {
    await mockDelay(300);
    return mockScenarios;
  }
  return apiFetch<Scenario[]>('/scenario/history');
}
