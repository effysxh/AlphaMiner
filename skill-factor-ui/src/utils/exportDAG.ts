import type { DAGGraph, DAGNode } from '../types/factorPool';

const NODE_W = 180;
const NODE_H = 72;
const LAYER_GAP = 100;
const NODE_GAP = 40;

const statusColors: Record<string, { fill: string; border: string; badgeBg: string; badgeText: string }> = {
  Candidate: { fill: '#22c55e', border: 'rgba(34,197,94,0.4)', badgeBg: 'rgba(34,197,94,0.12)', badgeText: '#22c55e' },
  LowScore: { fill: '#f59e0b', border: 'rgba(245,158,11,0.4)', badgeBg: 'rgba(245,158,11,0.12)', badgeText: '#f59e0b' },
  Rejected: { fill: '#ef4444', border: 'rgba(239,68,68,0.4)', badgeBg: 'rgba(239,68,68,0.12)', badgeText: '#ef4444' },
};

export function buildInteractiveHTML(graph: DAGGraph, isDark: boolean): string {
  const bg = isDark ? '#0a0f1a' : '#f3f4f6';
  const cardBg = isDark ? '#111827' : '#ffffff';
  const cardHoverBg = isDark ? '#1f2937' : '#f9fafb';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textPrimary = isDark ? '#e5e7eb' : '#1f2937';
  const textSecondary = isDark ? '#9ca3af' : '#6b7280';
  const textMuted = isDark ? '#6b7280' : '#9ca3af';
  const codeBg = isDark ? '#1f2937' : '#f9fafb';
  const codeText = isDark ? '#60a5fa' : '#2563eb';
  const panelBg = isDark ? '#111827' : '#ffffff';

  const graphData = JSON.stringify(graph);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>因子进化 DAG 图</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: ${bg};
    color: ${textPrimary};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .header {
    padding: 20px 32px;
    display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid ${borderColor};
  }
  .header h1 { font-size: 18px; font-weight: 600; }
  .header .legend { margin-left: auto; display: flex; gap: 16px; }
  .header .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: ${textSecondary}; }
  .header .legend-dot { width: 8px; height: 8px; border-radius: 50%; }
  .main { display: flex; flex: 1; overflow: hidden; }
  .graph-area {
    flex: 1; min-width: 0; overflow: auto; padding: 24px;
  }
  .detail-panel {
    width: 320px; flex-shrink: 0; border-left: 1px solid ${borderColor};
    padding: 20px; overflow-y: auto; background: ${panelBg};
  }
  .detail-panel .empty-hint {
    text-align: center; color: ${textMuted}; font-size: 12px; padding: 60px 0;
  }
  .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .panel-header h3 { font-size: 14px; font-weight: 600; }
  .panel-close {
    background: none; border: none; color: ${textMuted}; cursor: pointer; padding: 4px; border-radius: 4px;
  }
  .panel-close:hover { background: ${isDark ? '#1f2937' : '#f3f4f6'}; }
  .score-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .gauge { position: relative; display: inline-flex; align-items: center; justify-content: center; }
  .gauge span { position: absolute; font-size: 13px; font-weight: 700; }
  .node-info .factor-id { font-size: 14px; font-family: monospace; font-weight: 600; }
  .node-info .meta { font-size: 11px; color: ${textSecondary}; margin-top: 2px; }
  .badge {
    display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px;
    font-size: 11px; font-weight: 500; margin-left: 6px;
  }
  .section { margin-bottom: 14px; }
  .section-label { font-size: 11px; font-weight: 500; color: ${textMuted}; margin-bottom: 6px; }
  .expression {
    padding: 10px; border-radius: 8px; font-family: monospace; font-size: 12px;
    background: ${codeBg}; color: ${codeText}; word-break: break-all;
  }
  .path-chain { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .path-node {
    font-size: 11px; font-family: monospace; padding: 2px 6px; border-radius: 4px;
    background: ${isDark ? '#1f2937' : '#f3f4f6'}; color: ${textSecondary};
  }
  .path-node.active { background: rgba(59,130,246,0.12); color: #60a5fa; font-weight: 600; }
  .path-arrow { color: ${textMuted}; font-size: 10px; }
  .reject-reason { font-size: 12px; color: ${isDark ? '#f87171' : '#ef4444'}; margin-top: 4px; }
  .llm-feedback { font-size: 12px; color: ${isDark ? '#60a5fa' : '#2563eb'}; margin-top: 4px; }
  .child-list { display: flex; flex-direction: column; gap: 4px; }
  .child-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 10px; border-radius: 8px; font-size: 12px;
    background: ${isDark ? '#1f2937' : '#f9fafb'}; cursor: pointer;
  }
  .child-item:hover { background: ${isDark ? '#374151' : '#e5e7eb'}; }
  .child-item .id { font-family: monospace; color: ${textSecondary}; }
  .child-item .right { display: flex; align-items: center; gap: 8px; }
  .child-item .reward { font-family: monospace; font-weight: 600; }

  /* SVG node styles */
  .dag-node { cursor: pointer; transition: opacity 0.2s; }
  .dag-node:hover rect { filter: brightness(1.1); }
</style>
</head>
<body>

<div class="header">
  <h1>因子进化 DAG 图</h1>
  <div class="legend">
    <div class="legend-item"><div class="legend-dot" style="background:#22c55e"></div>Candidate</div>
    <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div>LowScore</div>
    <div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div>Rejected</div>
    <div class="legend-item" style="margin-left:8px;padding-left:12px;border-left:1px solid ${borderColor}">
      <svg width="30" height="10"><line x1="0" y1="5" x2="30" y2="5" stroke="#22c55e" stroke-width="2"/></svg>改善
    </div>
    <div class="legend-item">
      <svg width="30" height="10"><line x1="0" y1="5" x2="30" y2="5" stroke="${isDark ? '#6b7280' : '#9ca3af'}" stroke-width="1.5" stroke-dasharray="6 3"/></svg>未改善
    </div>
  </div>
</div>

<div class="main">
  <div class="graph-area" id="graphArea"></div>
  <div class="detail-panel" id="detailPanel">
    <p class="empty-hint">点击节点查看详情</p>
  </div>
</div>

<script>
(function() {
  const graph = ${graphData};
  const isDark = ${isDark ? 'true' : 'false'};
  const NODE_W = ${NODE_W};
  const NODE_H = ${NODE_H};
  const LAYER_GAP = ${LAYER_GAP};
  const NODE_GAP = ${NODE_GAP};

  const colors = ${JSON.stringify(statusColors)};
  const textPrimary = '${textPrimary}';
  const textSecondary = '${textSecondary}';
  const textMuted = '${textMuted}';
  const cardBg = '${cardBg}';
  const cardHoverBg = '${cardHoverBg}';
  const borderColor = '${borderColor}';
  const panelBg = '${panelBg}';
  const codeBg = '${codeBg}';
  const codeText = '${codeText}';

  let selectedId = null;
  let hoveredId = null;

  // Layout
  const maxDepth = Math.max(...graph.nodes.map(n => n.depth));
  const layers = [];
  for (let d = 0; d <= maxDepth; d++) layers.push(graph.nodes.filter(n => n.depth === d));

  const totalWidth = Math.max(...layers.map(l => l.length)) * (NODE_W + NODE_GAP) - NODE_GAP;
  const totalHeight = (maxDepth + 1) * (NODE_H + LAYER_GAP) - LAYER_GAP + 40;

  const layoutNodes = [];
  layers.forEach((layer, d) => {
    const layerWidth = layer.length * (NODE_W + NODE_GAP) - NODE_GAP;
    const startX = (totalWidth - layerWidth) / 2;
    layer.forEach((node, i) => {
      layoutNodes.push({ ...node, x: startX + i * (NODE_W + NODE_GAP), y: d * (NODE_H + LAYER_GAP) + 20 });
    });
  });

  const nodeMap = new Map();
  layoutNodes.forEach(n => nodeMap.set(n.factor_id, n));

  function getRelated(id) {
    if (!id) return new Set();
    const s = new Set([id]);
    graph.edges.forEach(e => { if (e.from === id) s.add(e.to); if (e.to === id) s.add(e.from); });
    return s;
  }

  function buildSVG() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', totalWidth + 40);
    svg.setAttribute('height', totalHeight + 20);
    svg.style.display = 'block';

    // Defs
    const defs = document.createElementNS(svgNS, 'defs');

    const mkArrow = (id, fill) => {
      const m = document.createElementNS(svgNS, 'marker');
      m.setAttribute('id', id); m.setAttribute('viewBox', '0 0 10 7');
      m.setAttribute('refX', '10'); m.setAttribute('refY', '3.5');
      m.setAttribute('markerWidth', '8'); m.setAttribute('markerHeight', '6');
      m.setAttribute('orient', 'auto-start-reverse');
      const p = document.createElementNS(svgNS, 'polygon');
      p.setAttribute('points', '0 0, 10 3.5, 0 7'); p.setAttribute('fill', fill);
      m.appendChild(p); return m;
    };
    defs.appendChild(mkArrow('arrow-green', '#22c55e'));
    defs.appendChild(mkArrow('arrow-gray', isDark ? '#6b7280' : '#9ca3af'));

    const filter = document.createElementNS(svgNS, 'filter');
    filter.setAttribute('id', 'glow');
    const blur = document.createElementNS(svgNS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '3'); blur.setAttribute('result', 'blur');
    const merge = document.createElementNS(svgNS, 'feMerge');
    const mn1 = document.createElementNS(svgNS, 'feMergeNode'); mn1.setAttribute('in', 'blur');
    const mn2 = document.createElementNS(svgNS, 'feMergeNode'); mn2.setAttribute('in', 'SourceGraphic');
    merge.appendChild(mn1); merge.appendChild(mn2);
    filter.appendChild(blur); filter.appendChild(merge);
    defs.appendChild(filter);
    svg.appendChild(defs);

    // Edges
    graph.edges.forEach(edge => {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) return;
      const x1 = from.x + NODE_W / 2, y1 = from.y + NODE_H;
      const x2 = to.x + NODE_W / 2, y2 = to.y;
      const midY = (y1 + y2) / 2;
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + midY + ', ' + x2 + ' ' + midY + ', ' + x2 + ' ' + y2);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', edge.improved ? '#22c55e' : (isDark ? '#6b7280' : '#9ca3af'));
      path.setAttribute('stroke-width', '1.5');
      if (!edge.improved) path.setAttribute('stroke-dasharray', '6 3');
      path.setAttribute('marker-end', edge.improved ? 'url(#arrow-green)' : 'url(#arrow-gray)');
      path.dataset.from = edge.from;
      path.dataset.to = edge.to;
      path.classList.add('dag-edge');
      svg.appendChild(path);
    });

    // Nodes
    layoutNodes.forEach(node => {
      const sc = colors[node.status] || colors.Candidate;
      const shortId = node.factor_id.replace('F_', '').replace(/_004/, '.4').replace(/_008/, '.8').replace(/_001/, '.1');
      const displayId = shortId.length > 12 ? shortId.slice(0, 12) : shortId;
      const expr = node.expression.length > 22 ? node.expression.slice(0, 22) + '...' : node.expression;

      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('transform', 'translate(' + node.x + ', ' + node.y + ')');
      g.classList.add('dag-node');
      g.dataset.id = node.factor_id;

      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('width', NODE_W); rect.setAttribute('height', NODE_H);
      rect.setAttribute('rx', '8'); rect.setAttribute('fill', cardBg);
      rect.setAttribute('stroke', sc.border); rect.setAttribute('stroke-width', '1');
      g.appendChild(rect);

      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', '14'); circle.setAttribute('cy', '16');
      circle.setAttribute('r', '5'); circle.setAttribute('fill', sc.fill);
      circle.setAttribute('opacity', '0.9');
      g.appendChild(circle);

      const nameText = document.createElementNS(svgNS, 'text');
      nameText.setAttribute('x', '26'); nameText.setAttribute('y', '19');
      nameText.setAttribute('fill', textPrimary); nameText.setAttribute('font-size', '11');
      nameText.setAttribute('font-weight', '600'); nameText.setAttribute('font-family', 'monospace');
      nameText.textContent = displayId;
      g.appendChild(nameText);

      const exprText = document.createElementNS(svgNS, 'text');
      exprText.setAttribute('x', '14'); exprText.setAttribute('y', '40');
      exprText.setAttribute('fill', textSecondary); exprText.setAttribute('font-size', '9');
      exprText.setAttribute('font-family', 'monospace');
      exprText.textContent = expr;
      g.appendChild(exprText);

      const scoreText = document.createElementNS(svgNS, 'text');
      scoreText.setAttribute('x', '14'); scoreText.setAttribute('y', '58');
      scoreText.setAttribute('fill', sc.fill); scoreText.setAttribute('font-size', '12');
      scoreText.setAttribute('font-weight', '700');
      scoreText.textContent = node.total_reward.toFixed(2);
      g.appendChild(scoreText);

      const metaText = document.createElementNS(svgNS, 'text');
      metaText.setAttribute('x', '50'); metaText.setAttribute('y', '58');
      metaText.setAttribute('fill', textMuted); metaText.setAttribute('font-size', '9');
      metaText.textContent = 'reward \\u00b7 depth ' + node.depth;
      g.appendChild(metaText);

      g.addEventListener('click', () => selectNode(node.factor_id));
      g.addEventListener('mouseenter', () => { hoveredId = node.factor_id; updateHighlights(); });
      g.addEventListener('mouseleave', () => { hoveredId = null; updateHighlights(); });

      svg.appendChild(g);
    });

    return svg;
  }

  function updateHighlights() {
    const activeId = hoveredId || selectedId;
    const related = getRelated(activeId);

    document.querySelectorAll('.dag-node').forEach(g => {
      const id = g.dataset.id;
      const sc = colors[graph.nodes.find(n => n.factor_id === id)?.status] || colors.Candidate;
      const isSelected = selectedId === id;
      const rect = g.querySelector('rect');

      if (activeId) {
        g.style.opacity = related.has(id) ? '1' : '0.3';
      } else {
        g.style.opacity = '1';
      }

      rect.setAttribute('fill', isSelected ? cardHoverBg : cardBg);
      rect.setAttribute('stroke-width', isSelected ? '2' : '1');

      // Selection glow
      const existingGlow = g.querySelector('.sel-glow');
      if (isSelected && !existingGlow) {
        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        glow.setAttribute('x', '-3'); glow.setAttribute('y', '-3');
        glow.setAttribute('width', NODE_W + 6); glow.setAttribute('height', NODE_H + 6);
        glow.setAttribute('rx', '12'); glow.setAttribute('fill', 'none');
        glow.setAttribute('stroke', sc.fill); glow.setAttribute('stroke-width', '2');
        glow.setAttribute('filter', 'url(#glow)');
        glow.classList.add('sel-glow');
        g.insertBefore(glow, g.firstChild);
      } else if (!isSelected && existingGlow) {
        existingGlow.remove();
      }
    });

    document.querySelectorAll('.dag-edge').forEach(path => {
      const isRelated = activeId && related.has(path.dataset.from) && related.has(path.dataset.to);
      if (activeId) {
        path.style.opacity = isRelated ? '1' : '0.2';
        path.setAttribute('stroke-width', isRelated ? '2.5' : '1.5');
      } else {
        path.style.opacity = '0.7';
        path.setAttribute('stroke-width', '1.5');
      }
    });
  }

  function selectNode(id) {
    selectedId = selectedId === id ? null : id;
    updateHighlights();
    renderDetailPanel();
  }

  function buildPathChain(node) {
    const path = [];
    let cur = node;
    while (cur) { path.unshift(cur); cur = cur.parent_id ? graph.nodes.find(n => n.factor_id === cur.parent_id) || null : null; }
    return path;
  }

  function renderScoreGauge(score, size) {
    const r = (size - 8) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - score * c;
    const color = score >= 0.7 ? '#22c55e' : score >= 0.5 ? '#f59e0b' : '#ef4444';
    const trackColor = isDark ? '#374151' : '#e5e7eb';
    return '<div class="gauge"><svg width="' + size + '" height="' + size + '" style="transform:rotate(-90deg)">' +
      '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" fill="none" stroke="' + trackColor + '" stroke-width="4"/>' +
      '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="4" stroke-dasharray="' + c + '" stroke-dashoffset="' + offset + '" stroke-linecap="round"/>' +
      '</svg><span>' + score.toFixed(2) + '</span></div>';
  }

  function renderBadge(status) {
    const sc = colors[status] || colors.Candidate;
    return '<span class="badge" style="background:' + sc.badgeBg + ';color:' + sc.badgeText + '">' + status + '</span>';
  }

  function renderDetailPanel() {
    const panel = document.getElementById('detailPanel');
    if (!selectedId) {
      panel.innerHTML = '<p class="empty-hint">点击节点查看详情</p>';
      return;
    }

    const node = graph.nodes.find(n => n.factor_id === selectedId);
    if (!node) { panel.innerHTML = '<p class="empty-hint">点击节点查看详情</p>'; return; }

    const sc = colors[node.status] || colors.Candidate;
    const path = buildPathChain(node);
    const canDerive = node.status !== 'Rejected';
    const children = canDerive ? graph.nodes.filter(n => n.parent_id === node.factor_id) : [];

    let html = '<div class="panel-header"><h3>节点详情</h3>' +
      '<button class="panel-close" onclick="window.__deselect()" title="关闭">\\u2715</button></div>';

    html += '<div class="score-row">' + renderScoreGauge(node.total_reward, 64) +
      '<div class="node-info"><div><span class="factor-id">' + node.factor_id + '</span>' + renderBadge(node.status) + '</div>' +
      '<div class="meta">depth ' + node.depth + ' \\u00b7 ' + new Date(node.timestamp).toLocaleString() + '</div></div></div>';

    html += '<div class="section"><div class="section-label">表达式</div>' +
      '<div class="expression">' + node.expression + '</div></div>';

    if (path.length > 1) {
      html += '<div class="section"><div class="section-label">进化路径</div><div class="path-chain">';
      path.forEach((p, i) => {
        const cls = p.factor_id === node.factor_id ? 'path-node active' : 'path-node';
        html += '<span class="' + cls + '">' + p.factor_id.replace('F_', '') + '</span>';
        if (i < path.length - 1) html += '<span class="path-arrow">\\u203A</span>';
      });
      html += '</div></div>';
    }

    if (node.reject_reason) {
      html += '<div class="section"><div class="section-label">拒绝原因</div>' +
        '<div class="reject-reason">' + node.reject_reason + '</div></div>';
    }
    if (node.llm_feedback) {
      html += '<div class="section"><div class="section-label">LLM 建议</div>' +
        '<div class="llm-feedback">' + node.llm_feedback + '</div></div>';
    }

    if (children.length > 0) {
      html += '<div class="section"><div class="section-label">衍生因子</div><div class="child-list">';
      children.forEach(child => {
        const csc = colors[child.status] || colors.Candidate;
        const rewardColor = child.total_reward >= 0.7 ? '#22c55e' : '#f59e0b';
        html += '<div class="child-item" onclick="window.__selectChild(\\'' + child.factor_id + '\\')">' +
          '<span class="id">' + child.factor_id + '</span>' +
          '<div class="right">' + renderBadge(child.status) +
          '<span class="reward" style="color:' + rewardColor + '">' + child.total_reward.toFixed(2) + '</span></div></div>';
      });
      html += '</div></div>';
    }

    panel.innerHTML = html;
  }

  // Global handlers
  window.__deselect = function() { selectedId = null; updateHighlights(); renderDetailPanel(); };
  window.__selectChild = function(id) { selectNode(id); };

  // Init
  document.getElementById('graphArea').appendChild(buildSVG());
})();
</script>
</body>
</html>`;
}
