import type { DAGNode, DAGGraph } from '../../types/factorPool';
import Badge from '../common/Badge';
import ScoreGauge from '../common/ScoreGauge';
import { useTheme } from '../../contexts/ThemeContext';
import { ChevronRight, X } from 'lucide-react';

interface DAGDetailPanelProps {
  node: DAGNode;
  graph: DAGGraph;
  onClose: () => void;
}

export default function DAGDetailPanel({ node, graph, onClose }: DAGDetailPanelProps) {
  const { isDark } = useTheme();

  const nodeMap = new Map<string, DAGNode>();
  graph.nodes.forEach(n => nodeMap.set(n.factor_id, n));

  const path: DAGNode[] = [];
  let current: DAGNode | null = node;
  while (current) {
    path.unshift(current);
    current = current.parent_id ? nodeMap.get(current.parent_id) ?? null : null;
  }

  // Rejected factors cannot derive children
  const canDerive = node.status !== 'Rejected';
  const children = canDerive ? graph.nodes.filter(n => n.parent_id === node.factor_id) : [];

  return (
    <div className={`rounded-xl border p-5 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>节点详情</h3>
        <button onClick={onClose} className={`p-1 rounded hover:bg-gray-800 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <ScoreGauge score={node.total_reward} size={64} />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-mono font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{node.factor_id}</span>
            <Badge variant={node.status} />
          </div>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>depth {node.depth} · {new Date(node.timestamp).toLocaleString()}</p>
        </div>
      </div>

      <div className="mb-4">
        <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>表达式</label>
        <div className={`mt-1 p-2.5 rounded-lg font-mono text-xs ${isDark ? 'bg-gray-800 text-blue-400' : 'bg-gray-50 text-blue-600'}`}>
          {node.expression}
        </div>
      </div>

      {path.length > 1 && (
        <div className="mb-4">
          <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>进化路径</label>
          <div className={`mt-1.5 flex items-center gap-1 flex-wrap`}>
            {path.map((p, i) => (
              <span key={p.factor_id} className="flex items-center gap-1">
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                  p.factor_id === node.factor_id
                    ? 'bg-blue-500/10 text-blue-400 font-semibold'
                    : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                }`}>
                  {p.factor_id.replace('F_', '')}
                </span>
                {i < path.length - 1 && <ChevronRight className="w-3 h-3 text-gray-600" />}
              </span>
            ))}
          </div>
        </div>
      )}

      {node.reject_reason && (
        <div className="mb-3">
          <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>拒绝原因</label>
          <p className={`mt-1 text-xs ${isDark ? 'text-red-400/80' : 'text-red-500'}`}>{node.reject_reason}</p>
        </div>
      )}

      {node.llm_feedback && (
        <div className="mb-3">
          <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>LLM 建议</label>
          <p className={`mt-1 text-xs ${isDark ? 'text-blue-400/80' : 'text-blue-500'}`}>{node.llm_feedback}</p>
        </div>
      )}

      {children.length > 0 && (
        <div>
          <label className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>衍生因子</label>
          <div className="mt-1.5 space-y-1">
            {children.map(child => (
              <div key={child.factor_id} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <span className={`font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{child.factor_id}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={child.status} />
                  <span className={`font-mono font-semibold ${child.total_reward >= 0.7 ? 'text-green-400' : 'text-amber-400'}`}>
                    {child.total_reward.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
