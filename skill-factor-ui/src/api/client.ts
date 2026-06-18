const USE_MOCK = true;
const API_BASE = '/api/v1';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `请求失败 (${res.status})`);
  }
  return res.json();
}

export function mockDelay(ms = 600): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { USE_MOCK };
