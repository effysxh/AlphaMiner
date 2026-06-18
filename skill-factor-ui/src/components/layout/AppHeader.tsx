import { Moon, Sun, Activity } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export default function AppHeader() {
  const { isDark, toggleDark } = useTheme();

  return (
    <header className="h-14 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <Activity className="w-5 h-5 text-blue-500" />
        <h1 className="text-lg font-semibold tracking-tight">TQ因子挖掘</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">v1.0</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleDark}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
          title={isDark ? '切换浅色' : '切换深色'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold">
            X
          </div>
          <span className="text-sm text-gray-300">xiaohui</span>
        </div>
      </div>
    </header>
  );
}
