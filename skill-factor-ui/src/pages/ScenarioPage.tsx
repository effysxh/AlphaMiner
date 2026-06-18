import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Eye } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import ScenarioForm from '../components/scenario/ScenarioForm';
import ScenarioPreview from '../components/scenario/ScenarioPreview';
import { defaultScenario } from '../mock/scenarios';
import type { Scenario } from '../types/scenario';
import { useTheme } from '../contexts/ThemeContext';

export default function ScenarioPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [scenario, setScenario] = useState<Scenario>(defaultScenario);

  const handleStart = () => {
    navigate('/generation', { state: { scenario } });
  };

  return (
    <PageContainer title="场景配置">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className={`rounded-xl border p-5 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
            <ScenarioForm scenario={scenario} onChange={setScenario} />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                开始生成
              </button>
            </div>
          </div>
        </div>
        <div>
          <ScenarioPreview scenario={scenario} />
        </div>
      </div>
    </PageContainer>
  );
}
