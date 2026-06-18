import { useTheme } from '../../contexts/ThemeContext';

export default function AstDepthIndicator({ depth, safeLimit }: { depth: number; safeLimit: number }) {
  const { isDark } = useTheme();
  const pct = Math.min(100, (depth / safeLimit) * 100);
  const over = depth > safeLimit;
  const color = over ? 'bg-red-500' : depth >= safeLimit - 1 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>深度</span>
      <div className={`flex-1 h-1.5 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono ${over ? 'text-red-400' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {depth}/{safeLimit}
      </span>
    </div>
  );
}
