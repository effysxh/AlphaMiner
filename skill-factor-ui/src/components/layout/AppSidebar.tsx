import { useLocation, useNavigate } from 'react-router-dom';
import { Settings, Sparkles, ShieldCheck, BarChart3, Database, RefreshCw } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const STEPS = [
  { path: '/scenario', label: '场景配置', icon: Settings },
  { path: '/generation', label: '因子生成', icon: Sparkles },
  { path: '/reward', label: '奖励评分', icon: ShieldCheck },
  { path: '/pool', label: '因子库', icon: Database },
  { path: '/refinement', label: '优化迭代', icon: RefreshCw },
];

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  return (
    <aside className={`w-56 shrink-0 border-r ${isDark ? 'border-gray-800' : 'border-gray-200'} py-4 flex flex-col`}>
      <div className="px-4 mb-4">
        <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>工作流</p>
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {STEPS.map((step, idx) => {
          const isActive = location.pathname === step.path;
          const Icon = step.icon;
          return (
            <button
              key={step.path}
              onClick={() => navigate(step.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? isDark
                    ? 'bg-blue-500/10 text-blue-400 font-medium'
                    : 'bg-blue-50 text-blue-600 font-medium'
                  : isDark
                    ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isActive
                  ? 'bg-blue-500 text-white'
                  : isDark
                    ? 'bg-gray-800 text-gray-500'
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {idx + 1}
              </div>
              <Icon className="w-4 h-4 shrink-0" />
              <span>{step.label}</span>
            </button>
          );
        })}
      </nav>
      <div className={`px-4 py-3 mx-3 rounded-lg ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <div className="flex items-center gap-1.5 mb-1">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>因子库统计</span>
        </div>
        <p>5 Candidate / 4 LowScore / 3 Rejected</p>
      </div>
    </aside>
  );
}
