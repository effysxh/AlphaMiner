import { useTheme } from '../../contexts/ThemeContext';

export default function ScoreGauge({ score, size = 80 }: { score: number; size?: number }) {
  const { isDark } = useTheme();
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - score * c;
  const color = score >= 0.7 ? '#22c55e' : score >= 0.5 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={isDark ? '#374151' : '#e5e7eb'} strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className={`absolute text-sm font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{score.toFixed(2)}</span>
    </div>
  );
}
