import { useTheme } from '../../contexts/ThemeContext';

type Variant = 'Candidate' | 'Rejected' | 'LowScore' | 'novelty_boost' | 'redundancy_strict' | 'simplicity' | 'quality_first' | 'diversity_boost' | 'refinement' | 'early' | 'mid' | 'late';

const colorMap: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  Candidate: { bg: 'bg-green-50', text: 'text-green-700', darkBg: 'bg-green-500/10', darkText: 'text-green-400' },
  Rejected: { bg: 'bg-red-50', text: 'text-red-700', darkBg: 'bg-red-500/10', darkText: 'text-red-400' },
  LowScore: { bg: 'bg-amber-50', text: 'text-amber-700', darkBg: 'bg-amber-500/10', darkText: 'text-amber-400' },
  early: { bg: 'bg-green-50', text: 'text-green-700', darkBg: 'bg-green-500/10', darkText: 'text-green-400' },
  mid: { bg: 'bg-amber-50', text: 'text-amber-700', darkBg: 'bg-amber-500/10', darkText: 'text-amber-400' },
  late: { bg: 'bg-red-50', text: 'text-red-700', darkBg: 'bg-red-500/10', darkText: 'text-red-400' },
  novelty_boost: { bg: 'bg-purple-50', text: 'text-purple-700', darkBg: 'bg-purple-500/10', darkText: 'text-purple-400' },
  redundancy_strict: { bg: 'bg-cyan-50', text: 'text-cyan-700', darkBg: 'bg-cyan-500/10', darkText: 'text-cyan-400' },
  simplicity: { bg: 'bg-teal-50', text: 'text-teal-700', darkBg: 'bg-teal-500/10', darkText: 'text-teal-400' },
  quality_first: { bg: 'bg-blue-50', text: 'text-blue-700', darkBg: 'bg-blue-500/10', darkText: 'text-blue-400' },
  diversity_boost: { bg: 'bg-orange-50', text: 'text-orange-700', darkBg: 'bg-orange-500/10', darkText: 'text-orange-400' },
  refinement: { bg: 'bg-gray-50', text: 'text-gray-700', darkBg: 'bg-gray-500/10', darkText: 'text-gray-400' },
};

export default function Badge({ variant, label }: { variant: Variant; label?: string }) {
  const { isDark } = useTheme();
  const c = colorMap[variant] || colorMap.Candidate;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isDark ? c.darkBg + ' ' + c.darkText : c.bg + ' ' + c.text}`}>
      {label || variant}
    </span>
  );
}
