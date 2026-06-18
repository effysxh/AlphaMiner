import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export default function SearchInput({ value, onChange, placeholder = '搜索...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { isDark } = useTheme();
  const [local, setLocal] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => onChange(local), 300);
    return () => clearTimeout(t);
  }, [local, onChange]);

  return (
    <div className="relative">
      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
      <input
        value={local}
        onChange={e => setLocal(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
          isDark ? 'border-gray-700 bg-gray-800 text-gray-100 placeholder:text-gray-500' : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400'
        }`}
      />
    </div>
  );
}
