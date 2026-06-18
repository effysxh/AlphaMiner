import { useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import MetricCard from '../components/common/MetricCard';
import PhaseIndicator from '../components/common/PhaseIndicator';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { useTheme } from '../contexts/ThemeContext';
import { getPoolSummary, getFamilyGroups, getCorrelationMatrix } from '../api/factorPool';

interface PoolSummary {
  total_factors: number;
  candidate_count: number;
  rejected_count: number;
  low_score_count: number;
  current_phase: 'early' | 'mid' | 'late';
  top10_factor_ids: string[];
}

interface FamilyGroup {
  family_hash: string;
  representative_ops: string[];
  member_count: number;
  factor_ids: string[];
}

interface CorrelationEntry {
  factor_id_a: string;
  factor_id_b: string;
  pearson_corr: number;
}

export default function PoolPage() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [summary, setSummary] = useState<PoolSummary | null>(null);
  const [families, setFamilies] = useState<FamilyGroup[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, fam, corr] = await Promise.all([
        getPoolSummary(),
        getFamilyGroups(),
        getCorrelationMatrix(),
      ]);
      setSummary(sum as PoolSummary);
      setFamilies(fam as FamilyGroup[]);
      setCorrelations(corr as CorrelationEntry[]);
      setLoaded(true);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer title="因子库">
      <div className="mb-4">
        <button
          onClick={handleLoad}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          加载因子库
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>加载因子库数据...</span>
        </div>
      )}

      {error && (
        <div className="py-4 text-sm text-red-400">{error}</div>
      )}

      {!loading && !loaded && !error && (
        <EmptyState icon={Database} message="点击加载因子库概览" />
      )}

      {!loading && loaded && summary && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <PhaseIndicator phase={summary.current_phase} />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="总因子数" value={summary.total_factors} color="blue" />
            <MetricCard label="Candidate" value={summary.candidate_count} color="green" />
            <MetricCard label="LowScore" value={summary.low_score_count} color="amber" />
            <MetricCard label="Rejected" value={summary.rejected_count} color="red" />
          </div>

          {summary.top10_factor_ids.length > 0 && (
            <div>
              <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Top 10 核心因子</h3>
              <div className="flex flex-wrap gap-2">
                {summary.top10_factor_ids.map(id => (
                  <span key={id} className={`px-3 py-1 rounded-lg text-xs font-mono ${isDark ? 'bg-gray-800 text-green-400' : 'bg-green-50 text-green-700'}`}>{id}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>因子族</h3>
            {families.length === 0 ? (
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无因子族数据</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {families.map(fg => (
                  <div key={fg.family_hash} className={`rounded-xl border p-4 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{fg.family_hash.slice(0, 8)}</span>
                      <Badge variant="early" label={`${fg.member_count} 因子`} />
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {fg.representative_ops.map(op => (
                        <span key={op} className={`px-2 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-gray-800 text-blue-400' : 'bg-gray-100 text-blue-600'}`}>{op}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {fg.factor_ids.map(id => (
                        <span key={id} className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{id}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>相关性矩阵（高相关对）</h3>
            {correlations.length === 0 ? (
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>暂无相关性数据（需至少2个 Candidate 因子有 parquet 数据）</p>
            ) : (
              <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                      <th className={`px-4 py-2 text-left ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>因子 A</th>
                      <th className={`px-4 py-2 text-left ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>因子 B</th>
                      <th className={`px-4 py-2 text-right ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Pearson 相关</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correlations
                      .filter(c => Math.abs(c.pearson_corr) >= 0.5)
                      .map((c, i) => (
                        <tr key={i} className={`border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                          <td className={`px-4 py-2 font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.factor_id_a}</td>
                          <td className={`px-4 py-2 font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.factor_id_b}</td>
                          <td className={`px-4 py-2 text-right font-mono font-medium ${Math.abs(c.pearson_corr) >= 0.7 ? 'text-red-400' : 'text-amber-400'}`}>
                            {c.pearson_corr.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
