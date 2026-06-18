import type { LucideIcon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export default function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  const { isDark } = useTheme();

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Icon className={`w-12 h-12 mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
      <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{message}</p>
    </div>
  );
}
