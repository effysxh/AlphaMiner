import type { ReactNode } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

export default function PageContainer({ title, children }: { title: string; children: ReactNode }) {
  const { isDark } = useTheme();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <h2 className={`text-xl font-semibold mb-6 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
