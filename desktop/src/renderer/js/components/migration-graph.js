/**
 * Real-time migration graph visualization.
 * Renders a Canvas 2D DAG showing entity categories and their
 * dependency edges, with nodes transitioning red -> amber -> green
 * as migration progresses.
 *
 * Supports dynamic per-project fan-out nodes, zoom/pan camera, and
 * auto-fit to keep all nodes in view.
 *
 * This is the core module. Additional methods are mixed in from:
 *   - migration-graph-icons.js     (icon drawing)
 *   - migration-graph-camera.js    (zoom, pan, drag, auto-fit)
 *   - migration-graph-rendering.js (force sim, draw loop, edges, nodes)
 *   - migration-graph-parsers.js   (log line parsing for all modes)
 *   - migration-graph-projects.js  (dynamic per-project node generation)
 */
window.MigrationGraph = {
  // ── Properties ──────────────────────────────────────────────────
  canvas: null,
  ctx: null,
  container: null,
  nodes: [],
  edges: [],
  animFrame: null,
  mode: null, // 'migrate' | 'transfer' | 'sync-metadata'
  lastFrameTime: 0,
  dashOffset: 0,
  particles: [],
  pulseRings: [],
  resizeObserver: null,
  allDone: false,
  themeColors: {},
  // Force simulation parameters
  _forceGravity: 0.12,    // pull toward target position
  _forceRepulsion: 1500,  // repulsion strength between nodes
  _forceDamping: 0.7,     // velocity damping per frame
  _forceSettled: false,    // true when simulation has settled
  // Drag state
  _dragNode: null,         // node currently being dragged
  _dragOffsetX: 0,         // mouse offset from node center
  _dragOffsetY: 0,
  // Camera state (zoom + pan)
  _camX: 0, _camY: 0,           // camera translation (screen pixels)
  _camScale: 1,                  // zoom level
  _camMinScale: 0.1,
  _camMaxScale: 3.0,
  _isPanning: false,
  _panStartX: 0, _panStartY: 0,
  _camStartX: 0, _camStartY: 0,
  _camTargetX: 0, _camTargetY: 0, _camTargetScale: 1,
  _camAnimating: false,
  _camAnimFrames: 0,
  // Per-project dynamic nodes
  _projectNodes: null,        // Map: projectKey → { upload, config, issues, hotspots }
  _projectKeys: null,         // ordered list of project keys
  _currentProjectKey: null,   // fallback for non-prefixed log lines (concurrency=1)
  _nodeMap: null,             // Map: nodeId → node (O(1) lookup)
  // Static org-level node IDs for force sim (repulsion only between these)
  _orgNodeIds: null,

  // ── Graph Definitions ───────────────────────────────────────────

  _graphDefs: {
    migrate: {
      nodes: [
        { id: 'setup',           label: 'Setup',            col: 0, row: 0, yPct: 0.50 },
        { id: 'groups',          label: 'Groups',           col: 1, row: 0, yPct: 0.22 },
        { id: 'qualityGates',   label: 'Quality Gates',    col: 1, row: 1, yPct: 0.50 },
        { id: 'qualityProfiles', label: 'Quality Profiles', col: 1, row: 2, yPct: 0.78 },
        { id: 'permissions',     label: 'Permissions',      col: 2, row: 0, yPct: 0.15 },
        { id: 'permTemplates',   label: 'Perm Templates',   col: 2, row: 1, xPct: 0.50, yPct: 0.78 },
        { id: 'projects',        label: 'Projects',         col: 3, row: 0, xPct: 0.52, yPct: 0.50 },
        { id: 'portfolios',      label: 'Portfolios',       col: 4, row: 0, yPct: 0.50 },
      ],
      edges: [
        ['setup', 'groups'], ['setup', 'qualityGates'], ['setup', 'qualityProfiles'],
        ['groups', 'permissions'], ['groups', 'permTemplates'],
        ['qualityGates', 'projects'], ['qualityProfiles', 'projects'],
        ['permissions', 'projects'], ['permTemplates', 'projects'],
      ],
      colPositions: [0.06, 0.20, 0.36, 0.52, 0.92],
    },
    transfer: {
      nodes: [
        { id: 'connect',       label: 'Connect',        col: 0, row: 0 },
        { id: 'extract',       label: 'Extract',        col: 1, row: 0 },
        { id: 'buildProtobuf', label: 'Preparing Upload', col: 2, row: 0 },
        { id: 'upload',        label: 'Upload',         col: 3, row: 0 },
        { id: 'analysis',      label: 'Analysis',       col: 4, row: 0 },
      ],
      edges: [
        ['connect', 'extract'], ['extract', 'buildProtobuf'],
        ['buildProtobuf', 'upload'], ['upload', 'analysis'],
      ],
    },
    'sync-metadata': {
      nodes: [
        { id: 'projects',    label: 'Projects',      col: 0, row: 0, yPct: 0.50 },
        { id: 'issueSync',   label: 'Issue Sync',    col: 1, row: 0, yPct: 0.30 },
        { id: 'hotspotSync', label: 'Hotspot Sync',  col: 1, row: 1, yPct: 0.70 },
      ],
      edges: [
        ['projects', 'issueSync'], ['projects', 'hotspotSync'],
      ],
    },
    verify: {
      nodes: [
        { id: 'vConnect',        label: 'Connect',          col: 0, row: 0, yPct: 0.50 },
        { id: 'vFetchProjects',  label: 'Fetch Projects',   col: 1, row: 0, yPct: 0.30 },
        { id: 'vBuildMappings',  label: 'Build Mappings',   col: 1, row: 1, yPct: 0.70 },
        { id: 'vQualityGates',   label: 'Quality Gates',    col: 2, row: 0, yPct: 0.15 },
        { id: 'vQualityProfiles',label: 'Quality Profiles', col: 2, row: 1, yPct: 0.38 },
        { id: 'vGroups',         label: 'Groups',           col: 2, row: 2, yPct: 0.62 },
        { id: 'vPermissions',    label: 'Permissions',      col: 2, row: 3, yPct: 0.85 },
        { id: 'vProjects',       label: 'Projects',         col: 3, row: 0, yPct: 0.12 },
        { id: 'vBranches',       label: 'Branches',         col: 3, row: 1, yPct: 0.32 },
        { id: 'vIssues',         label: 'Issues',           col: 3, row: 2, yPct: 0.52 },
        { id: 'vHotspots',       label: 'Hotspots',         col: 3, row: 3, yPct: 0.72 },
        { id: 'vMeasures',       label: 'Measures',         col: 3, row: 4, yPct: 0.92 },
        { id: 'vPortfolios',     label: 'Portfolios',       col: 4, row: 0, yPct: 0.50 },
      ],
      edges: [
        ['vConnect', 'vFetchProjects'], ['vConnect', 'vBuildMappings'],
        ['vFetchProjects', 'vQualityGates'], ['vFetchProjects', 'vQualityProfiles'],
        ['vBuildMappings', 'vGroups'], ['vBuildMappings', 'vPermissions'],
        ['vQualityGates', 'vProjects'], ['vQualityProfiles', 'vProjects'],
        ['vGroups', 'vProjects'], ['vPermissions', 'vProjects'],
        ['vProjects', 'vBranches'], ['vBranches', 'vIssues'],
        ['vIssues', 'vHotspots'], ['vHotspots', 'vMeasures'],
        ['vProjects', 'vPortfolios'],
      ],
      colPositions: [0.05, 0.22, 0.42, 0.65, 0.92],
    },
  },

  // ── Font ────────────────────────────────────────────────────────

  _font: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Consolas', monospace",

  // ── Lifecycle ───────────────────────────────────────────────────

  create(containerEl, mode) {
    this.container = containerEl;
    this.mode = mode || 'migrate';
    this.allDone = false;
    this.particles = [];
    this.pulseRings = [];
    this.dashOffset = 0;
    this.lastFrameTime = 0;
    this._projectNodes = new Map();
    this._projectKeys = [];
    this._currentProjectKey = null;
    this._nodeMap = new Map();
    this._orgNodeIds = new Set();

    // Camera reset
    this._camX = 0;
    this._camY = 0;
    this._camScale = 1;
    this._camTargetX = 0;
    this._camTargetY = 0;
    this._camTargetScale = 1;
    this._camAnimating = false;
    this._camAnimFrames = 0;
    this._isPanning = false;

    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Theme — re-read colors when data-theme attribute changes
    this.readThemeColors();
    this._themeObserver = new MutationObserver(() => this.readThemeColors());
    this._themeObserver.observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme'],
    });

    // Build graph
    this._buildGraph();

    // Initial size
    this.resize();

    // Observe container resizes
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    // Interaction handlers
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onDblClick = this._handleDblClick.bind(this);
    this._onGestureStart = (e) => e.preventDefault();
    this._onGestureChange = this._handleGestureChange.bind(this);

    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this._onDblClick);
    this.canvas.addEventListener('gesturestart', this._onGestureStart);
    this.canvas.addEventListener('gesturechange', this._onGestureChange);
    this.canvas.style.cursor = 'default';

    // Start render loop
    this._scheduleFrame();
  },

  destroy() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this._themeObserver) {
      this._themeObserver.disconnect();
      this._themeObserver = null;
    }
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this._onMouseDown);
      this.canvas.removeEventListener('wheel', this._onWheel);
      this.canvas.removeEventListener('dblclick', this._onDblClick);
      this.canvas.removeEventListener('gesturestart', this._onGestureStart);
      this.canvas.removeEventListener('gesturechange', this._onGestureChange);
      if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    }
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this._dragNode = null;
    this._isPanning = false;
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.nodes = [];
    this.edges = [];
    this.particles = [];
    this.pulseRings = [];
    this.allDone = false;
    this.mode = null;
    this._projectNodes = new Map();
    this._projectKeys = [];
    this._currentProjectKey = null;
    this._nodeMap = new Map();
    this._orgNodeIds = new Set();
  },

  // ── Graph Construction ──────────────────────────────────────────

  _buildGraph() {
    const def = this._graphDefs[this.mode];
    if (!def) return;

    this._nodeMap = new Map();
    this.nodes = def.nodes.map(n => {
      const node = {
        id: n.id,
        label: n.label,
        count: '',
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        vx: 0,
        vy: 0,
        width: 130,
        height: 32,
        state: 'pending',
        progress: 0,
        pulseTime: 0,
        col: n.col,
        row: n.row,
        isProjectNode: false, // true for dynamic per-project nodes
      };
      this._nodeMap.set(n.id, node);
      this._orgNodeIds.add(n.id);
      return node;
    });

    this.edges = def.edges.map(([from, to]) => ({ from, to, type: 'org' }));
  },

  // ── Layout ──────────────────────────────────────────────────────

  resize() {
    if (!this.canvas || !this.container) return;

    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = cw * dpr;
    this.canvas.height = ch * dpr;
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';

    this._computePositions(cw, ch);

    // Setting canvas.width/height clears the buffer — schedule a redraw
    if (!this.animFrame) {
      this.lastFrameTime = 0;
      this._scheduleFrame();
    }
  },

  _computePositions(cw, ch) {
    const def = this._graphDefs[this.mode];
    if (!def) return;

    const firstLayout = this.nodes.every(n => n.targetX === 0 && n.targetY === 0);

    if (def.colPositions) {
      const colX = def.colPositions;
      const nodeDefs = def.nodes;

      // Only position org-level nodes from the definition
      this.nodes.forEach(n => {
        if (n.isProjectNode) return; // project nodes positioned by _computeProjectPositions
        const nodeDef = nodeDefs.find(d => d.id === n.id);
        if (!nodeDef) return;
        n.targetX = (nodeDef.xPct != null) ? nodeDef.xPct * cw : colX[n.col] * cw;
        if (nodeDef.yPct != null) {
          n.targetY = nodeDef.yPct * ch;
        } else {
          n.targetY = ch * 0.5;
        }
      });
    } else {
      const orgNodes = this.nodes.filter(n => !n.isProjectNode);
      const numNodes = orgNodes.length;
      orgNodes.forEach((n, i) => {
        const margin = 0.1;
        const span = 1 - margin * 2;
        n.targetX = (margin + (numNodes > 1 ? (i / (numNodes - 1)) * span : 0.5 - margin)) * cw;
        n.targetY = ch * 0.5;
      });
    }

    // Recompute project node positions if any exist
    if (this._projectKeys.length > 0) {
      this._computeProjectPositions();
    }

    if (firstLayout) {
      // Initialize positions with slight random offset for visual pop
      this.nodes.forEach(n => {
        if (n.isProjectNode) return; // project nodes get positioned later
        n.x = n.targetX + (Math.random() - 0.5) * 40;
        n.y = n.targetY + (Math.random() - 0.5) * 40;
        n.vx = 0;
        n.vy = 0;
      });
      this._forceSettled = false;
    } else {
      // On resize, update targets — simulation will smoothly animate
      this._forceSettled = false;
    }
  },

  // ── State Transitions ──────────────────────────────────────────

  setNodeState(nodeId, newState) {
    const node = this._nodeById(nodeId);
    if (!node) return;

    const rank = { pending: 0, active: 1, done: 2 };
    if (rank[node.state] >= rank[newState]) return;

    // Enforce dependency edges: a node cannot activate until all its
    // predecessor nodes have moved past 'pending'.
    // Skip this check for project nodes (they have simpler dependencies)
    if (newState === 'active' && !node.isProjectNode) {
      const parents = this.edges
        .filter(e => e.to === nodeId)
        .map(e => this._nodeById(e.from))
        .filter(Boolean);
      if (parents.length > 0 && parents.some(p => p.state === 'pending')) {
        if (!this._deferredActive) this._deferredActive = new Set();
        this._deferredActive.add(nodeId);
        return;
      }
    }

    node.state = newState;
    node.progress = newState === 'pending' ? 0 : newState === 'active' ? 0.5 : 1.0;
    node.pulseTime = Date.now();

    // Pulse ring (skip for project nodes to reduce visual noise)
    if (!node.isProjectNode) {
      const { r, g, b } = this.lerpColor(node.progress);
      this.pulseRings.push({
        x: node.x,
        y: node.y,
        startTime: Date.now(),
        color: `rgba(${r}, ${g}, ${b}, 1)`,
      });
    }

    // Cascade: when a node advances, retry any deferred children that were blocked
    if (this._deferredActive && this._deferredActive.size > 0) {
      const ready = [...this._deferredActive].filter(id => {
        const parents = this.edges
          .filter(e => e.to === id)
          .map(e => this._nodeById(e.from))
          .filter(Boolean);
        return parents.length === 0 || parents.every(p => p.state !== 'pending');
      });
      for (const id of ready) {
        this._deferredActive.delete(id);
        this.setNodeState(id, 'active');
      }
    }

    // Check all done (only org-level nodes for allDone check)
    const orgNodes = this.nodes.filter(n => !n.isProjectNode);
    const wasDone = this.allDone;
    this.allDone = orgNodes.length > 0 && orgNodes.every(n => n.state === 'done');

    if (!wasDone && this.allDone) {
      this.lastFrameTime = 0;
      requestAnimationFrame(t => {
        this.render(t);
      });
    } else if (!this.animFrame) {
      this._scheduleFrame();
    }
  },

  // Direct state set bypassing dependency checks (for already-completed projects)
  _setProjectNodeStateDirect(nodeId, newState) {
    const node = this._nodeById(nodeId);
    if (!node) return;
    node.state = newState;
    node.progress = newState === 'pending' ? 0 : newState === 'active' ? 0.5 : 1.0;
    node.pulseTime = Date.now();
  },

  // ── Helpers ─────────────────────────────────────────────────────

  _nodeById(id) {
    return this._nodeMap.get(id) || null;
  },

  _setNodeCount(nodeId, count) {
    const node = this._nodeById(nodeId);
    if (node) node.count = String(count);
  },

  _markAllProjectNodesDone() {
    this._projectNodes.forEach(ids => {
      Object.values(ids).forEach(nodeId => {
        this._setProjectNodeStateDirect(nodeId, 'done');
      });
    });
  },

  // Given a project node ID, find the project key and return all its node IDs
  _projectNodeIdsForNode(nodeId) {
    for (const [, ids] of this._projectNodes) {
      if (Object.values(ids).includes(nodeId)) return ids;
    }
    return null;
  },

  _allProjectNodesDone(ids) {
    return Object.values(ids).every(nodeId => {
      const node = this._nodeById(nodeId);
      return node && node.state === 'done';
    });
  },

  lerpColor(progress) {
    const p = Math.max(0, Math.min(1, progress));
    const pending = (this.themeColors && this.themeColors.pending) || { r: 110, g: 118, b: 138 };
    let r, g, b;
    if (p <= 0.5) {
      const t = p / 0.5;
      r = pending.r + (210 - pending.r) * t;
      g = pending.g + (153 - pending.g) * t;
      b = pending.b + (34 - pending.b) * t;
    } else {
      const t = (p - 0.5) / 0.5;
      r = 210 + (63 - 210) * t;
      g = 153 + (185 - 153) * t;
      b = 34 + (80 - 34) * t;
    }
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  },

  cubicBezierPoint(t, pts) {
    const u = 1 - t;
    return {
      x: u*u*u*pts.x1 + 3*u*u*t*pts.cp1x + 3*u*t*t*pts.cp2x + t*t*t*pts.x2,
      y: u*u*u*pts.y1 + 3*u*u*t*pts.cp1y + 3*u*t*t*pts.cp2y + t*t*t*pts.y2,
    };
  },

  roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  },

  readThemeColors() {
    const styles = getComputedStyle(document.documentElement);
    const theme = document.documentElement.getAttribute('data-theme');
    const isDark = theme !== 'light';
    this.themeColors = {
      text: styles.getPropertyValue('--text-primary').trim() || '#e6edf3',
      textMuted: styles.getPropertyValue('--text-muted').trim() || '#7d8590',
      gridLine: styles.getPropertyValue('--glass-border').trim() || 'rgba(74, 125, 255, 0.08)',
      pending: isDark
        ? { r: 110, g: 118, b: 138 }
        : { r: 160, g: 168, b: 185 },
    };
  },
};
