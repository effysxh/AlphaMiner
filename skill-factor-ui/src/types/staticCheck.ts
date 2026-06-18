export interface StaticCheckResult {
  syntax_valid: boolean;
  unknown_ops: string[];
  depth: number;
  depth_safe_limit: number;
  future_leak: boolean;
  future_leak_details: FutureLeakDetail[] | null;
  field_compliant: boolean;
  passed: boolean;
}

export interface FutureLeakDetail {
  rule: 'negative_window' | 'negative_literal' | 'future_keyword' | 'zero_window';
  location: string;
  message: string;
}

export type CheckStatus = 'passed' | 'failed' | 'pending' | 'skipped';

export interface CheckStep {
  name: string;
  key: string;
  status: CheckStatus;
  detail?: string;
  items?: string[];
}
