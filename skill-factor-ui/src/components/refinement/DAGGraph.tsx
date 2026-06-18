import { useState, useMemo, useCallback } from 'react';
import type { DAGGraph, DAGNode } from '../../types/factorPool';
import { useTheme } from '../../contexts/ThemeContext';

const NODE_W = 180;
const NODE_H = 72;
const LAYER_GAP = 100;
const NODE_GAP = 40;

const statusColors = {
  Candidate: { fill: '#22c55e', fillDark: '#16a34a', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.4)' },
  LowScore: { fill: '#f59e0b', fillDark: '#d97706', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.4)' },
  Rejected: { fill: '#ef4444', fillDark: '#dc2626', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.4)' },
};

// Rejected factors cannot derive children; Candidate and LowScore can
function canDeriveChildren(status: string): boolean {
  return status !== 'Rejected';
}

interface LayoutNode extends DAGNode {
  x: number;
  y: number;
}

function layoutGraph(graph: DAGGraph): { nodes: LayoutNode[]; width: number; height: number } {
  const nodeMap = new Map<string, DAGNode>();
  graph.nodes.forEach(n => nodeMap.set(n.factor_id, n));

  const maxDepth = Math.max(...graph.nodes.map(n => n.depth));
  const layers: DAGNode[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    layers.push(graph.nodes.filter(n => n.depth === d));
  }

  const totalWidth = Math.max(...layers.map(l => l.length)) * (NODE_W + NODE_GAP) - NODE_GAP;
  const totalHeight = (maxDepth + 1) * (NODE_H + LAYER_GAP) - LAYER_GAP + 40;

  const layoutNodes: LayoutNode[] = [];
  layers.forEach((layer, d) => {
    const layerWidth = layer.length * (NODE_W + NODE_GAP) - NODE_GAP;
    const startX = (totalWidth - layerWidth) / 2;
    layer.forEach((node, i) => {
      layoutNodes.push({
        ...node,
        x: startX + i * (NODE_W + NODE_GAP),
        y: d * (NODE_H + LAYER_GAP) + 20,
      });
    });
  });

  return { nodes: layoutNodes, width: totalWidth + 40, height: totalHeight + 20 };
}

interface DAGGraphProps {
  graph: DAGGraph;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function DAGGraphView({ graph, selectedId, onSelect }: DAGGraphProps) {
  const { isDark } = useTheme();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { nodes: layoutNodes, width, height } = useMemo(() => layoutGraph(graph), [graph]);
  const nodeMap = useMemo(() => {
    const m = new Map<string, LayoutNode>();
    layoutNodes.forEach(n => m.set(n.factor_id, n));
    return m;
  }, [layoutNodes]);

  const handleNodeClick = useCallback((id: string) => {
    onSelect(selectedId === id ? null : id);
  }, [selectedId, onSelect]);

  const activeId = hoveredId || selectedId;
  const activeRelated = useMemo(() => {
    if (!activeId) return new Set<string>();
    const related = new Set<string>();
    related.add(activeId);
    graph.edges.forEach(e => {
      if (e.from === activeId) related.add(e.to);
      if (e.to === activeId) related.add(e.from);
    });
    return related;
  }, [activeId, graph.edges]);

  return (
    <div className={`rounded-xl border overflow-auto ${isDark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50/50'}`} style={{ maxHeight: 'calc(100vh - 240px)' }}>
      <svg width={width} height={height} className="block">
        <defs>
          <marker id="arrow-green" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
          </marker>
          <marker id="arrow-gray" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <polygon points="0 0, 10 3.5, 0 7" fill={isDark ? '#6b7280' : '#9ca3af'} />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {graph.edges.map(edge => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;

          const x1 = from.x + NODE_W / 2;
          const y1 = from.y + NODE_H;
          const x2 = to.x + NODE_W / 2;
          const y2 = to.y;

          const isRelated = activeRelated.has(edge.from) && activeRelated.has(edge.to);
          const opacity = activeId ? (isRelated ? 1 : 0.2) : 0.7;

          const midY = (y1 + y2) / 2;
          const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={path}
              fill="none"
              stroke={edge.improved ? '#22c55e' : isDark ? '#6b7280' : '#9ca3af'}
              strokeWidth={isRelated ? 2.5 : 1.5}
              strokeDasharray={edge.improved ? undefined : '6 3'}
              opacity={opacity}
              markerEnd={edge.improved ? 'url(#arrow-green)' : 'url(#arrow-gray)'}
              className="transition-opacity duration-200"
            />
          );
        })}

        {layoutNodes.map(node => {
          const sc = statusColors[node.status];
          const isSelected = selectedId === node.factor_id;
          const isHovered = hoveredId === node.factor_id;
          const isRelated = activeRelated.has(node.factor_id);
          const opacity = activeId ? (isRelated ? 1 : 0.3) : 1;

          const shortId = node.factor_id.replace('F_', '').replace('_004', '.4').replace('_008', '.8').replace('_001', '.1');
          const displayId = shortId.length > 12 ? shortId.slice(0, 12) : shortId;

          return (
            <g
              key={node.factor_id}
              transform={`translate(${node.x}, ${node.y})`}
              opacity={opacity}
              className="cursor-pointer transition-opacity duration-200"
              onClick={() => handleNodeClick(node.factor_id)}
              onMouseEnter={() => setHoveredId(node.factor_id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {isSelected && (
                <rect x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6} rx={12} fill="none" stroke={sc.fill} strokeWidth={2} filter="url(#glow)" />
              )}

              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={isDark ? (isHovered || isSelected ? '#1f2937' : '#111827') : (isHovered || isSelected ? '#f9fafb' : '#ffffff')}
                stroke={sc.border}
                strokeWidth={isSelected ? 2 : 1}
              />

              <circle cx={14} cy={16} r={5} fill={sc.fill} opacity={0.9} />

              <text x={26} y={19} fill={isDark ? '#e5e7eb' : '#1f2937'} fontSize={11} fontWeight={600} fontFamily="monospace">
                {displayId}
              </text>

              <text x={14} y={40} fill={isDark ? '#9ca3af' : '#6b7280'} fontSize={9} fontFamily="monospace">
                {node.expression.length > 22 ? node.expression.slice(0, 22) + '...' : node.expression}
              </text>

              <text x={14} y={58} fill={sc.fill} fontSize={12} fontWeight={700}>
                {node.total_reward.toFixed(2)}
              </text>
              <text x={50} y={58} fill={isDark ? '#6b7280' : '#9ca3af'} fontSize={9}>
                reward · depth {node.depth}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
