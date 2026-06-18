import type { Scenario } from '../../types/scenario';
import { useTheme } from '../../contexts/ThemeContext';

export default function ScenarioPreview({ scenario }: { scenario: Scenario }) {
  const { isDark } = useTheme();

  return (
    <div className={`rounded-xl border p-4 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
      <h3 className={`text-xs font-medium uppercase tracking-wider mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>场景 JSON 预览</h3>
      <pre className={`text-xs font-mono whitespace-pre-wrap overflow-auto max-h-96 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
        {JSON.stringify(scenario, null, 2)}
      </pre>
    </div>
  );
}
