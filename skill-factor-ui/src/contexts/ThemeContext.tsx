import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleDark: () => void;
  surface: string;
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  hover: string;
  accent: string;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('skill_dark_mode');
    return saved !== null ? saved === '1' : true;
  });

  useEffect(() => {
    localStorage.setItem('skill_dark_mode', isDark ? '1' : '0');
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleDark = () => setIsDark(d => !d);

  const value: ThemeContextType = {
    isDark,
    toggleDark,
    surface: isDark ? 'bg-gray-950' : 'bg-gray-50',
    card: isDark ? 'bg-gray-900' : 'bg-white',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    textPrimary: isDark ? 'text-gray-100' : 'text-gray-900',
    textSecondary: isDark ? 'text-gray-300' : 'text-gray-600',
    textMuted: isDark ? 'text-gray-500' : 'text-gray-400',
    hover: isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100',
    accent: isDark ? 'text-blue-400' : 'text-blue-600',
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
