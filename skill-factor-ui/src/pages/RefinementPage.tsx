import { useState, useCallback } from 'react';
import { RefreshCw, Loader2, Download } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import EmptyState from '../components/common/EmptyState';
import DAGGraphView from '../components/refinement/DAGGraph';
import DAGDetailPanel from '../components/refinement/DAGDetailPanel';
import { mockDAGGraph } from '../mock/refinement';
import type { DAGGraph, DAGNode, DAGEdge } from '../types/factorPool';
import { useTheme } from '../contexts/ThemeContext';
import { buildInteractiveHTML } from '../utils/exportDAG';

export default function RefinementPage() {
  const { isDark } = useTheme();
  const [graph, setGraph] = useState<DAGGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleLoad = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setGraph(mockDAGGraph);
    setSelectedId(null);
    setLoading(false);
  };

  const handleExport = useCallback(() => {
    if (!graph) return;
    const html = buildInteractiveHTML(graph, isDark);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factor-dag-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [graph, isDark]);

  const selectedNode = graph && selectedId
    ? graph.nodes.find(n => n.factor_id === selectedId) ?? null
    : null;

  return (
    <PageContainer title="优化迭代">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleLoad}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          加载迭代记录
        </button>
        {graph && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Download className="w-4 h-4" />
            导出 HTML
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>加载迭代数据...</span>
        </div>
      )}

      {!loading && !graph && (
        <EmptyState icon={RefreshCw} message="点击加载优化迭代记录" />
      )}

      {!loading && graph && (
        <div className="flex gap-5">
          <div className="flex-1 min-w-0">
            <DAGGraphView graph={graph} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <div className="w-80 shrink-0">
            {selectedNode ? (
              <DAGDetailPanel node={selectedNode} graph={graph} onClose={() => setSelectedId(null)} />
            ) : (
              <div className={`rounded-xl border p-5 text-center ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>点击节点查看详情</p>
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
