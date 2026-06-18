import { useTheme } from '../../contexts/ThemeContext';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'default' | 'green' | 'red' | 'amber' | 'blue';
}

const colorClasses = {
  default: { light: 'text-gray-900', dark: 'text-gray-100' },
  green: { light: 'text-green-600', dark: 'text-green-400' },
  red: { light: 'text-red-600', dark: 'text-red-400' },
  amber: { light: 'text-amber-600', dark: 'text-amber-400' },
  blue: { light: 'text-blue-600', dark: 'text-blue-400' },
};

export default function MetricCard({ label, value, sub, color = 'default' }: MetricCardProps) {
  const { isDark } = useTheme();
  const cc = colorClasses[color];

  return (
    <div className={`rounded-xl border p-4 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-xl font-semibold mt-1 ${isDark ? cc.dark : cc.light}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  );
}
