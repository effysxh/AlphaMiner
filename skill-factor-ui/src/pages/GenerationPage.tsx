import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Play, RotateCcw, Loader2 } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import FactorStreamList from '../components/generation/FactorStreamList';
import EmptyState from '../components/common/EmptyState';
import { mockFactors } from '../mock/factors';
import type { Factor } from '../types/factor';
import { useTheme } from '../contexts/ThemeContext';

export default function GenerationPage() {
  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setFactors(mockFactors);
    setLoading(false);
  };

  return (
    <PageContainer title="因子生成">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? '生成中...' : '生成因子'}
        </button>
        {factors.length > 0 && (
          <button
            onClick={() => setFactors([])}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-colors ${isDark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>正在生成因子，请稍候...</span>
        </div>
      )}

      {!loading && factors.length === 0 && (
        <EmptyState icon={Play} message="配置场景后点击生成因子" />
      )}

      {!loading && factors.length > 0 && <FactorStreamList factors={factors} />}
    </PageContainer>
  );
}
