import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export default function CodeBlock({ code, language }: { code: string; language?: string }) {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative rounded-lg border overflow-hidden ${isDark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{language || 'python'}</span>
        <button onClick={handleCopy} className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-200 text-gray-400'}`}>
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="p-3 text-xs overflow-x-auto">
        <code className={`font-mono ${isDark ? 'text-green-400' : 'text-green-700'}`}>{code}</code>
      </pre>
    </div>
  );
}
