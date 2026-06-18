import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Factor } from '../../types/factor';
import Badge from '../common/Badge';
import CodeBlock from '../common/CodeBlock';
import ExpressionDisplay from './ExpressionDisplay';
import AstDepthIndicator from './AstDepthIndicator';
import StaticCheckPanel from '../check/StaticCheckPanel';
import { useTheme } from '../../contexts/ThemeContext';

export default function FactorCard({ factor, index }: { factor: Factor; index: number }) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`animate-fade-in rounded-xl border overflow-hidden ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 cursor-pointer ${isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`} onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{factor.meta.factor_id}</span>
          <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{factor.definition.name}</span>
          <Badge variant={factor.status} />
        </div>
        <div className="flex items-center gap-3">
          {factor.reward_scores_raw && (
            <span className={`text-sm font-mono font-semibold ${factor.reward_scores_raw.total_reward >= 0.7 ? 'text-green-400' : 'text-amber-400'}`}>
              {factor.reward_scores_raw.total_reward.toFixed(2)}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </div>

      {/* Collapsed: expression */}
      {!expanded && (
        <div className={`px-4 pb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <ExpressionDisplay expression={factor.definition.expression} />
        </div>
      )}

      {/* Expanded */}
      {expanded && (
        <div className={`px-4 pb-4 space-y-3 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
          <p className={`pt-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{factor.definition.description}</p>

          {/* Expression */}
          <div>
            <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>表达式</label>
            <div className={`mt-1 p-2.5 rounded-lg font-mono text-xs ${isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
              <ExpressionDisplay expression={factor.definition.expression} />
            </div>
          </div>

          {/* Code */}
          <CodeBlock code={factor.definition.code} language="python" />

          {/* DSL ops */}
          <div className="flex flex-wrap gap-1">
            {factor.definition.dsl_ops_used.map(op => (
              <span key={op} className={`px-2 py-0.5 rounded text-xs font-mono ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>{op}</span>
            ))}
          </div>

          {/* AST Depth */}
          <AstDepthIndicator depth={factor.static_check.depth} safeLimit={factor.static_check.depth_safe_limit} />

          {/* Static Check */}
          <StaticCheckPanel check={factor.static_check} />

          {/* Reject reason */}
          {factor.reject_reason && (
            <div className={`p-2.5 rounded-lg text-xs ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
              {factor.reject_reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
