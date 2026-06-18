import { useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import ScoreGauge from '../components/common/ScoreGauge';
import MetricCard from '../components/common/MetricCard';
import PhaseIndicator from '../components/common/PhaseIndicator';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { mockFactors } from '../mock/factors';
import { REWARD_DIMENSIONS } from '../types/reward';
import type { Factor } from '../types/factor';
import { useTheme } from '../contexts/ThemeContext';

export default function RewardPage() {
  const { isDark } = useTheme();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(false);

  const scoredFactors = factors.filter(f => f.reward_scores_raw);

  const handleLoad = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setFactors(mockFactors);
    setLoading(false);
  };

  return (
    <PageContainer title="奖励评分">
      <div className="mb-4">
        <button
          onClick={handleLoad}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          加载评分
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>计算奖励分数中...</span>
        </div>
      )}

      {!loading && scoredFactors.length === 0 && (
        <EmptyState icon={ShieldCheck} message="生成因子后可查看奖励评分" />
      )}

      {!loading && scoredFactors.length > 0 && (
        <div className="space-y-6">
          {scoredFactors.map(factor => {
            const scores = factor.reward_scores_raw!;
            const weightConfig = factor.weight_config;
            return (
              <div key={factor.meta.factor_id} className={`rounded-xl border p-5 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start gap-6">
                  <div className="shrink-0">
                    <ScoreGauge score={scores.total_reward} size={100} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-sm font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{factor.meta.factor_id}</span>
                      <span className={`text-base font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{factor.definition.name}</span>
                      <Badge variant={factor.status} />
                      {weightConfig && <PhaseIndicator phase={weightConfig.phase} />}
                    </div>
                    <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{factor.definition.description}</p>

                    <div className="grid grid-cols-4 gap-3">
                      {REWARD_DIMENSIONS.map(dim => {
                        const raw = scores[dim.key as keyof typeof scores];
                        const value = typeof raw === 'number' ? raw : 0;
                        return (
                          <MetricCard
                            key={dim.key}
                            label={dim.label}
                            value={value.toFixed(3)}
                            color={value >= 0 ? 'green' : 'red'}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
