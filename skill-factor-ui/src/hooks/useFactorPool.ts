import { useState, useEffect, useCallback } from 'react';
import type { Factor } from '../types/factor';
import type { FactorPoolSummary, CorrelationEntry, FamilyGroup, RefinementCycle } from '../types/factorPool';
import { listFactors } from '../api/factor';
import { getPoolSummary, getCorrelationMatrix, getFamilyGroups, getRefinementCycles } from '../api/factorPool';

export function useFactorPool() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [summary, setSummary] = useState<FactorPoolSummary | null>(null);
  const [correlations, setCorrelations] = useState<CorrelationEntry[]>([]);
  const [families, setFamilies] = useState<FamilyGroup[]>([]);
  const [refinements, setRefinements] = useState<RefinementCycle[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [f, s, c, fam, r] = await Promise.all([
        listFactors(),
        getPoolSummary(),
        getCorrelationMatrix(),
        getFamilyGroups(),
        getRefinementCycles(),
      ]);
      setFactors(f);
      setSummary(s);
      setCorrelations(c);
      setFamilies(fam);
      setRefinements(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { factors, summary, correlations, families, refinements, loading, refresh };
}
