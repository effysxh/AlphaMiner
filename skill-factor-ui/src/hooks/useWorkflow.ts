import { useState, useCallback } from 'react';
import type { Scenario } from '../types/scenario';
import type { Factor } from '../types/factor';
import { generateFactors } from '../api/factor';

export type WorkflowStep = 'idle' | 'scenario_set' | 'generating' | 'checking' | 'rewarding' | 'complete';

export function useWorkflow() {
  const [step, setStep] = useState<WorkflowStep>('idle');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGeneration = useCallback(async (sc: Scenario) => {
    setScenario(sc);
    setStep('scenario_set');
    setLoading(true);
    setError(null);
    setFactors([]);

    try {
      setStep('generating');
      const result = await generateFactors(sc);
      setFactors(result);
      setStep('checking');

      await new Promise(r => setTimeout(r, 800));
      setStep('rewarding');

      await new Promise(r => setTimeout(r, 600));
      setStep('complete');
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
      setStep('idle');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setStep('idle');
    setScenario(null);
    setFactors([]);
    setLoading(false);
    setError(null);
  }, []);

  return { step, scenario, factors, loading, error, startGeneration, reset };
}
