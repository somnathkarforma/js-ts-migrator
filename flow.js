/* ═══════════════════════════════════════════════════════
   TS·FORGE — Animated Agentic Flow Visualizer (flow.js)
   ═══════════════════════════════════════════════════════ */

'use strict';

const FlowVisualizer = (() => {
  // ── Config ────────────────────────────────────────────
  const NODE_WIDTH    = 280;
  const NODE_HEIGHT   = 72;
  const NODE_GAP      = 24;
  const SVG_PADDING   = 16;
  const BADGE_SIZE    = 18;
  const CONNECTOR_H   = NODE_GAP;

  const STAGES = [
    { id: 'stage-0', name: 'Codebase Analyzer',    desc: 'Detecting patterns & structure' },
    { id: 'stage-1', name: 'Type Inference Engine', desc: 'Inferring TypeScript types' },
    { id: 'stage-2', name: 'Interface Architect',   desc: 'Generating interfaces & types' },
    { id: 'stage-3', name: 'Code Transformer',      desc: 'Converting JS → TypeScript' },
    { id: 'stage-4', name: 'Config Generator',      desc: 'Building tsconfig & scripts' },
    { id: 'stage-5', name: 'Migration Reporter',    desc: 'Producing migration report' },
  ];

  // Colors
  const COLORS = {
    idle:     { stroke: '#374151', fill: '#1C2333',          text: '#9CA3AF' },
    running:  { stroke: '#3B82F6', fill: 'rgba(59,130,246,0.08)', text: '#93C5FD' },
    complete: { stroke: '#10B981', fill: 'rgba(16,185,129,0.13)', text: '#6EE7B7' },
    error:    { stroke: '#EF4444', fill: 'rgba(239,68,68,0.1)',  text: '#FCA5A5' },
  };

  // ── State ─────────────────────────────────────────────
  const stageStates = new Array(STAGES.length).fill('idle');
  const stageData   = new Array(STAGES.length).fill(null);
  let svgEl = null;
  let containerEl = null;
  let logEl = null;
  let animationFrameIds = {};

  // ── SVG Namespace Helper ──────────────────────────────
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}, text = '') {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (text) e.textContent = text;
    return e;
  }

  // ── Build SVG ─────────────────────────────────────────
  function buildSvg() {
    const totalH = STAGES.length * NODE_HEIGHT + (STAGES.length - 1) * NODE_GAP + 2 * SVG_PADDING;
    const totalW = NODE_WIDTH + 2 * SVG_PADDING;

    const svg = el('svg', {
      viewBox: `0 0 ${totalW} ${totalH}`,
      class: 'flow-svg',
      role: 'img',
      'aria-label': 'Migration pipeline stages',
    });

    // Defs for gradient and animation paths
    const defs = el('defs');

    STAGES.forEach((stage, i) => {
      const y = SVG_PADDING + i * (NODE_HEIGHT + NODE_GAP);
      const x = SVG_PADDING;
      const midX = x + NODE_WIDTH / 2;

      // Connector line (above node, except first)
      if (i > 0) {
        const lineY1 = y - CONNECTOR_H;
        const lineY2 = y;
        const path = el('path', {
          id: `connector-${i}`,
          class: 'connector-line',
          d: `M ${midX} ${lineY1} L ${midX} ${lineY2}`,
          'stroke-dasharray': '4 3',
        });
        svg.appendChild(path);

        // Traveling dot
        const dot = el('circle', {
          id: `connector-dot-${i}`,
          class: 'connector-dot',
          r: '3',
          cx: midX,
          cy: lineY1,
        });
        svg.appendChild(dot);
      }

      // Stage group
      const g = el('g', {
        id: `node-${i}`,
        class: 'stage-node',
        transform: `translate(${x}, ${y})`,
        role: 'group',
        'aria-label': stage.name,
      });

      // Background rect
      const rect = el('rect', {
        id: `node-rect-${i}`,
        class: 'stage-node-rect',
        x: '0', y: '0',
        width: NODE_WIDTH, height: NODE_HEIGHT,
        rx: '8', ry: '8',
        fill: COLORS.idle.fill,
        stroke: COLORS.idle.stroke,
        'stroke-width': '1.5',
      });
      g.appendChild(rect);

      // Stage number badge background
      const badgeBg = el('rect', {
        class: 'stage-badge-bg',
        x: '10', y: '10',
        width: BADGE_SIZE, height: BADGE_SIZE,
        rx: '4', ry: '4',
        fill: '#8B5CF6',
      });
      g.appendChild(badgeBg);

      // Stage number text
      const badgeText = el('text', {
        class: 'stage-badge',
        x: String(10 + BADGE_SIZE / 2),
        y: String(10 + BADGE_SIZE / 2 + 4),
        'text-anchor': 'middle',
        fill: '#fff',
        'font-family': 'JetBrains Mono, monospace',
        'font-size': '10',
        'font-weight': '600',
      }, String(i + 1));
      g.appendChild(badgeText);

      // Stage name
      const nameText = el('text', {
        id: `node-name-${i}`,
        class: 'stage-name',
        x: String(10 + BADGE_SIZE + 8),
        y: '24',
        fill: COLORS.idle.text === '#9CA3AF' ? '#F9FAFB' : COLORS.idle.text,
        'font-family': 'DM Sans, sans-serif',
        'font-size': '13',
        'font-weight': '600',
      }, stage.name);
      g.appendChild(nameText);

      // Stage description
      const descText = el('text', {
        id: `node-desc-${i}`,
        class: 'stage-desc',
        x: String(10 + BADGE_SIZE + 8),
        y: '40',
        fill: '#6B7280',
        'font-family': 'DM Sans, sans-serif',
        'font-size': '11',
      }, stage.desc);
      g.appendChild(descText);

      // Status indicator circle
      const statusCircle = el('circle', {
        id: `node-status-circle-${i}`,
        cx: String(NODE_WIDTH - 16),
        cy: '22',
        r: '6',
        fill: '#374151',
        stroke: '#6B7280',
        'stroke-width': '1.5',
      });
      g.appendChild(statusCircle);

      // Status icon text (✓ or ✕ or ●)
      const statusIcon = el('text', {
        id: `node-status-icon-${i}`,
        x: String(NODE_WIDTH - 16),
        y: '26',
        'text-anchor': 'middle',
        fill: '#6B7280',
        'font-size': '10',
        'font-weight': 'bold',
      }, '');
      g.appendChild(statusIcon);

      // Thinking dots (shown when running)
      const thinkingText = el('text', {
        id: `node-thinking-${i}`,
        class: 'stage-thinking',
        x: '14',
        y: String(NODE_HEIGHT - 12),
        fill: '#3B82F6',
        'font-family': 'JetBrains Mono, monospace',
        'font-size': '11',
        opacity: '0',
      }, '');
      g.appendChild(thinkingText);

      // Token / data label
      const dataLabel = el('text', {
        id: `node-data-${i}`,
        x: String(NODE_WIDTH - 100),
        y: String(NODE_HEIGHT - 12),
        'text-anchor': 'start',
        fill: '#6B7280',
        'font-family': 'JetBrains Mono, monospace',
        'font-size': '10',
        opacity: '0',
      }, '');
      g.appendChild(dataLabel);

      svg.appendChild(g);
    });

    svg.appendChild(defs);
    return svg;
  }

  // ── Update Stage Visual ───────────────────────────────
  function updateNodeVisual(index) {
    if (!svgEl) return;
    const status = stageStates[index];
    const colors = COLORS[status] || COLORS.idle;

    const rect    = svgEl.getElementById(`node-rect-${index}`);
    const circle  = svgEl.getElementById(`node-status-circle-${index}`);
    const icon    = svgEl.getElementById(`node-status-icon-${index}`);
    const thinking = svgEl.getElementById(`node-thinking-${index}`);
    const dataLbl = svgEl.getElementById(`node-data-${index}`);
    const node    = svgEl.getElementById(`node-${index}`);
    const dot     = svgEl.getElementById(`connector-dot-${index}`);

    if (!rect) return;

    // Update rect colors
    rect.setAttribute('fill',   colors.fill);
    rect.setAttribute('stroke', colors.stroke);

    // Update node class for CSS animations
    node.setAttribute('class', `stage-node ${status}`);

    if (status === 'idle') {
      circle.setAttribute('fill', '#374151');
      circle.setAttribute('stroke', '#6B7280');
      icon.textContent = '';
      icon.setAttribute('fill', '#6B7280');
      thinking.setAttribute('opacity', '0');
      dataLbl.setAttribute('opacity', '0');
      if (dot) { dot.setAttribute('opacity', '0'); stopDotAnimation(index); }
    }

    if (status === 'running') {
      circle.setAttribute('fill', 'rgba(59,130,246,0.2)');
      circle.setAttribute('stroke', '#3B82F6');
      icon.textContent = '';
      startThinkingAnimation(index, thinking);
      if (dot) startDotAnimation(index, dot, svgEl.getElementById(`connector-${index}`));
      dataLbl.setAttribute('opacity', '0');
    }

    if (status === 'complete') {
      circle.setAttribute('fill', 'rgba(16,185,129,0.25)');
      circle.setAttribute('stroke', '#10B981');
      icon.textContent = '✓';
      icon.setAttribute('fill', '#10B981');
      thinking.setAttribute('opacity', '0');
      stopThinkingAnimation(index);
      if (dot) { dot.setAttribute('opacity', '0'); stopDotAnimation(index); }

      // Show data label
      const data = stageData[index];
      if (data) {
        const label = buildDataLabel(index, data);
        if (label) {
          dataLbl.textContent = label;
          dataLbl.setAttribute('opacity', '1');
          dataLbl.setAttribute('fill', '#10B981');
        }
      }
    }

    if (status === 'error') {
      circle.setAttribute('fill', 'rgba(239,68,68,0.2)');
      circle.setAttribute('stroke', '#EF4444');
      icon.textContent = '✕';
      icon.setAttribute('fill', '#EF4444');
      thinking.setAttribute('opacity', '0');
      stopThinkingAnimation(index);
      if (dot) { dot.setAttribute('opacity', '0'); stopDotAnimation(index); }
    }
  }

  function buildDataLabel(index, data) {
    switch (index) {
      case 0: return data.results ? `${data.results.length} file(s) analyzed` : null;
      case 1: return data.typeResults ? `${data.typeResults.length} type map(s)` : null;
      case 2: return data.interfaceBlocks ? `${data.interfaceBlocks.length} interface block(s)` : null;
      case 3: return data.count != null ? `${data.count} file(s) transformed` : null;
      case 4: return data.files ? `${data.files.length} config file(s)` : null;
      case 5: return data.reviewItems != null ? `${data.reviewItems} review item(s)` : null;
      default: return null;
    }
  }

  // ── Thinking Dots Animation ───────────────────────────
  const thinkingIntervals = {};

  function startThinkingAnimation(index, el) {
    if (thinkingIntervals[index]) clearInterval(thinkingIntervals[index]);
    const dots = ['thinking.', 'thinking..', 'thinking...', 'processing'];
    let step = 0;
    el.setAttribute('opacity', '1');
    el.textContent = dots[0];
    thinkingIntervals[index] = setInterval(() => {
      step = (step + 1) % dots.length;
      if (el) el.textContent = dots[step];
    }, 400);
  }

  function stopThinkingAnimation(index) {
    if (thinkingIntervals[index]) {
      clearInterval(thinkingIntervals[index]);
      delete thinkingIntervals[index];
    }
  }

  // ── Traveling Dot Animation ───────────────────────────
  function startDotAnimation(index, dotEl, pathEl) {
    if (!pathEl || !dotEl) return;
    stopDotAnimation(index);

    dotEl.setAttribute('opacity', '1');
    const pathLength = pathEl.getTotalLength ? pathEl.getTotalLength() : 24;
    let progress = 0;
    const speed  = 0.015; // fraction per frame

    function frame() {
      progress += speed;
      if (progress > 1) progress = 0;
      const pt = pathEl.getPointAtLength ? pathEl.getPointAtLength(progress * pathLength) : null;
      if (pt) {
        dotEl.setAttribute('cx', pt.x);
        dotEl.setAttribute('cy', pt.y);
      }
      animationFrameIds[index] = requestAnimationFrame(frame);
    }
    animationFrameIds[index] = requestAnimationFrame(frame);
  }

  function stopDotAnimation(index) {
    if (animationFrameIds[index]) {
      cancelAnimationFrame(animationFrameIds[index]);
      delete animationFrameIds[index];
    }
  }

  // ── Log ───────────────────────────────────────────────
  function appendLog(stageIndex, status, message) {
    if (!logEl) { logEl = document.getElementById('agent-log'); }
    if (!logEl) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${status}`;

    const ts = document.createElement('span');
    ts.className = 'log-ts';
    const now = new Date();
    ts.textContent = `[${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}]`;

    const stageName = MigrationAgent?.STAGES?.[stageIndex]?.name || STAGES[stageIndex]?.name || `Stage ${stageIndex + 1}`;
    const stageSpan = document.createElement('span');
    stageSpan.style.fontWeight = '600';
    stageSpan.textContent = ` [${stageName}] `;

    const msg = document.createElement('span');
    msg.textContent = message;

    entry.append(ts, stageSpan, msg);
    logEl.appendChild(entry);

    // Auto-scroll to bottom
    logEl.scrollTop = logEl.scrollHeight;

    // Limit log to 500 entries
    while (logEl.children.length > 500) {
      logEl.removeChild(logEl.firstChild);
    }
  }

  // ── Public API ────────────────────────────────────────
  function init(containerId) {
    containerEl = document.getElementById(containerId);
    if (!containerEl) return;

    containerEl.innerHTML = '';
    svgEl = buildSvg();
    containerEl.appendChild(svgEl);

    logEl = document.getElementById('agent-log');
    appendLog(0, 'info', 'Flow visualizer ready. Waiting for migration to start…');
  }

  function updateStage(stageIndex, status, data) {
    if (stageIndex < 0 || stageIndex >= STAGES.length) return;

    stageStates[stageIndex] = status;
    if (data) stageData[stageIndex] = data;

    updateNodeVisual(stageIndex);

    // Log entry
    const stageName = STAGES[stageIndex].name;
    const messages = {
      running:  `Starting ${stageName}…`,
      complete: `${stageName} complete.${data ? ` ${buildDataLabel(stageIndex, data) || ''}` : ''}`,
      error:    `${stageName} encountered an error.`,
    };
    appendLog(stageIndex, status, messages[status] || `${stageName}: ${status}`);
  }

  function reset() {
    for (let i = 0; i < STAGES.length; i++) {
      stageStates[i] = 'idle';
      stageData[i] = null;
      stopThinkingAnimation(i);
      stopDotAnimation(i);
      updateNodeVisual(i);
    }
    appendLog(0, 'info', 'Pipeline reset to idle.');
  }

  function clearLog() {
    if (!logEl) { logEl = document.getElementById('agent-log'); }
    if (logEl) logEl.innerHTML = '';
  }

  return { init, updateStage, reset, clearLog };
})();
