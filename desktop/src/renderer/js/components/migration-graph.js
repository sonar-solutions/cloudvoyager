/**
 * Real-time migration graph visualization.
 * Renders a Canvas 2D DAG showing entity categories and their
 * dependency edges, with nodes transitioning red -> amber -> green
 * as migration progresses.
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

  // ── Graph Definitions ───────────────────────────────────────────

  _graphDefs: {
    migrate: {
      nodes: [
        { id: 'setup',           label: 'Setup',            col: 0, row: 0, yPct: 0.50 },
        { id: 'groups',          label: 'Groups',           col: 1, row: 0, yPct: 0.22 },
        { id: 'qualityGates',   label: 'Quality Gates',    col: 1, row: 1, yPct: 0.50 },
        { id: 'qualityProfiles', label: 'Quality Profiles', col: 1, row: 2, yPct: 0.78 },
        { id: 'permissions',     label: 'Permissions',      col: 2, row: 0, yPct: 0.15 },
        { id: 'permTemplates',   label: 'Perm Templates',   col: 2, row: 1, xPct: 0.50, yPct: 0.65 },
        { id: 'projects',        label: 'Projects',         col: 3, row: 0, yPct: 0.10 },
        { id: 'scannerUpload',   label: 'Scanner Upload',   col: 3, row: 1, yPct: 0.30 },
        { id: 'issueSync',       label: 'Issue Sync',       col: 3, row: 2, yPct: 0.50 },
        { id: 'hotspotSync',     label: 'Hotspot Sync',     col: 3, row: 3, yPct: 0.70 },
        { id: 'projectConfig',   label: 'Project Config',   col: 3, row: 4, yPct: 0.90 },
        { id: 'portfolios',      label: 'Portfolios',       col: 4, row: 0, yPct: 0.45 },
      ],
      edges: [
        ['setup', 'groups'], ['setup', 'qualityGates'], ['setup', 'qualityProfiles'],
        ['groups', 'permissions'], ['groups', 'permTemplates'],
        ['qualityGates', 'projects'], ['qualityProfiles', 'projects'],
        ['permissions', 'projects'], ['permTemplates', 'projects'],
        ['projects', 'scannerUpload'], ['scannerUpload', 'issueSync'],
        ['issueSync', 'hotspotSync'], ['hotspotSync', 'projectConfig'],
        ['projects', 'portfolios'],
      ],
      colPositions: [0.06, 0.22, 0.40, 0.62, 0.90],
    },
    transfer: {
      nodes: [
        { id: 'connect',       label: 'Connect',        col: 0, row: 0 },
        { id: 'extract',       label: 'Extract',        col: 1, row: 0 },
        { id: 'buildProtobuf', label: 'Build Protobuf', col: 2, row: 0 },
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
        { id: 'projects',    label: 'Projects',      col: 0, row: 0 },
        { id: 'issueSync',   label: 'Issue Sync',    col: 1, row: 0 },
        { id: 'hotspotSync', label: 'Hotspot Sync',  col: 2, row: 0 },
      ],
      edges: [
        ['projects', 'issueSync'], ['issueSync', 'hotspotSync'],
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

  // ── Node Icons (drawn via Canvas 2D paths) ────────────────────

  _drawIcon(ctx, nodeId, cx, cy, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const s = size / 2;

    switch (nodeId) {
      case 'setup': // Gear
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * s * 0.55, cy + Math.sin(a) * s * 0.55);
          ctx.lineTo(cx + Math.cos(a) * s * 0.85, cy + Math.sin(a) * s * 0.85);
          ctx.stroke();
        }
        break;

      case 'groups': // Two people
        ctx.beginPath();
        ctx.arc(cx - s * 0.25, cy - s * 0.25, s * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - s * 0.25, cy + s * 0.55, s * 0.4, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + s * 0.35, cy - s * 0.15, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'qualityGates': // Shield
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.8);
        ctx.lineTo(cx - s * 0.6, cy - s * 0.4);
        ctx.lineTo(cx - s * 0.6, cy + s * 0.1);
        ctx.quadraticCurveTo(cx, cy + s * 0.9, cx, cy + s * 0.9);
        ctx.quadraticCurveTo(cx, cy + s * 0.9, cx + s * 0.6, cy + s * 0.1);
        ctx.lineTo(cx + s * 0.6, cy - s * 0.4);
        ctx.closePath();
        ctx.stroke();
        break;

      case 'qualityProfiles': // Clipboard/list
        ctx.strokeRect(cx - s * 0.45, cy - s * 0.7, s * 0.9, s * 1.4);
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.2, cy - s * 0.25);
        ctx.lineTo(cx + s * 0.25, cy - s * 0.25);
        ctx.moveTo(cx - s * 0.2, cy + s * 0.05);
        ctx.lineTo(cx + s * 0.25, cy + s * 0.05);
        ctx.moveTo(cx - s * 0.2, cy + s * 0.35);
        ctx.lineTo(cx + s * 0.15, cy + s * 0.35);
        ctx.stroke();
        break;

      case 'permissions': // Lock
        ctx.beginPath();
        ctx.arc(cx, cy - s * 0.2, s * 0.35, Math.PI, 0);
        ctx.stroke();
        ctx.strokeRect(cx - s * 0.45, cy, s * 0.9, s * 0.65);
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.25, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'permTemplates': // Document with badge
        ctx.strokeRect(cx - s * 0.4, cy - s * 0.65, s * 0.8, s * 1.3);
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.15, cy - s * 0.2);
        ctx.lineTo(cx + s * 0.2, cy - s * 0.2);
        ctx.moveTo(cx - s * 0.15, cy + s * 0.1);
        ctx.lineTo(cx + s * 0.2, cy + s * 0.1);
        ctx.stroke();
        break;

      case 'projects': // Folder
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.55, cy - s * 0.25);
        ctx.lineTo(cx - s * 0.55, cy - s * 0.55);
        ctx.lineTo(cx - s * 0.1, cy - s * 0.55);
        ctx.lineTo(cx + s * 0.05, cy - s * 0.35);
        ctx.lineTo(cx + s * 0.55, cy - s * 0.35);
        ctx.lineTo(cx + s * 0.55, cy + s * 0.55);
        ctx.lineTo(cx - s * 0.55, cy + s * 0.55);
        ctx.closePath();
        ctx.stroke();
        break;

      case 'scannerUpload': // Upload arrow
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.6);
        ctx.lineTo(cx - s * 0.4, cy - s * 0.1);
        ctx.moveTo(cx, cy - s * 0.6);
        ctx.lineTo(cx + s * 0.4, cy - s * 0.1);
        ctx.moveTo(cx, cy - s * 0.6);
        ctx.lineTo(cx, cy + s * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.5, cy + s * 0.6);
        ctx.lineTo(cx + s * 0.5, cy + s * 0.6);
        ctx.stroke();
        break;

      case 'issueSync': // Sync arrows (circular)
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.5, -Math.PI * 0.7, Math.PI * 0.3);
        ctx.stroke();
        // Arrow head top
        ctx.beginPath();
        ctx.moveTo(cx + s * 0.15, cy - s * 0.6);
        ctx.lineTo(cx + s * 0.45, cy - s * 0.4);
        ctx.lineTo(cx + s * 0.1, cy - s * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.5, Math.PI * 0.3, Math.PI * 1.3);
        ctx.stroke();
        // Arrow head bottom
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.15, cy + s * 0.6);
        ctx.lineTo(cx - s * 0.45, cy + s * 0.4);
        ctx.lineTo(cx - s * 0.1, cy + s * 0.3);
        ctx.stroke();
        break;

      case 'hotspotSync': // Flame
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.6);
        ctx.quadraticCurveTo(cx - s * 0.5, cy + s * 0.1, cx - s * 0.3, cy - s * 0.3);
        ctx.quadraticCurveTo(cx - s * 0.1, cy - s * 0.1, cx, cy - s * 0.7);
        ctx.quadraticCurveTo(cx + s * 0.1, cy - s * 0.1, cx + s * 0.3, cy - s * 0.3);
        ctx.quadraticCurveTo(cx + s * 0.5, cy + s * 0.1, cx, cy + s * 0.6);
        ctx.stroke();
        break;

      case 'projectConfig': // Sliders
        ctx.beginPath();
        [-s * 0.3, 0, s * 0.3].forEach((dy, i) => {
          const dotX = cx + (i === 1 ? s * 0.2 : -s * 0.2);
          ctx.moveTo(cx - s * 0.5, cy + dy);
          ctx.lineTo(cx + s * 0.5, cy + dy);
          ctx.moveTo(dotX, cy + dy);
          ctx.arc(dotX, cy + dy, s * 0.1, 0, Math.PI * 2);
        });
        ctx.stroke();
        break;

      case 'portfolios': // Grid/briefcase
        ctx.strokeRect(cx - s * 0.55, cy - s * 0.4, s * 1.1, s * 0.8);
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.4);
        ctx.lineTo(cx, cy + s * 0.4);
        ctx.moveTo(cx - s * 0.55, cy);
        ctx.lineTo(cx + s * 0.55, cy);
        ctx.stroke();
        break;

      case 'connect': // Plug
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.2, cy - s * 0.7);
        ctx.lineTo(cx - s * 0.2, cy - s * 0.15);
        ctx.moveTo(cx + s * 0.2, cy - s * 0.7);
        ctx.lineTo(cx + s * 0.2, cy - s * 0.15);
        ctx.stroke();
        ctx.strokeRect(cx - s * 0.4, cy - s * 0.15, s * 0.8, s * 0.5);
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.35);
        ctx.lineTo(cx, cy + s * 0.7);
        ctx.stroke();
        break;

      case 'extract': // Download arrow
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.5);
        ctx.lineTo(cx - s * 0.4, cy);
        ctx.moveTo(cx, cy + s * 0.5);
        ctx.lineTo(cx + s * 0.4, cy);
        ctx.moveTo(cx, cy + s * 0.5);
        ctx.lineTo(cx, cy - s * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.5, cy + s * 0.7);
        ctx.lineTo(cx + s * 0.5, cy + s * 0.7);
        ctx.stroke();
        break;

      case 'buildProtobuf': // Cube/box
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.6);
        ctx.lineTo(cx + s * 0.5, cy - s * 0.25);
        ctx.lineTo(cx + s * 0.5, cy + s * 0.35);
        ctx.lineTo(cx, cy + s * 0.7);
        ctx.lineTo(cx - s * 0.5, cy + s * 0.35);
        ctx.lineTo(cx - s * 0.5, cy - s * 0.25);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.1);
        ctx.lineTo(cx, cy + s * 0.7);
        ctx.moveTo(cx, cy + s * 0.1);
        ctx.lineTo(cx - s * 0.5, cy - s * 0.25);
        ctx.moveTo(cx, cy + s * 0.1);
        ctx.lineTo(cx + s * 0.5, cy - s * 0.25);
        ctx.stroke();
        break;

      case 'upload': // Cloud with up arrow
        ctx.beginPath();
        ctx.arc(cx - s * 0.15, cy - s * 0.05, s * 0.35, Math.PI * 0.7, Math.PI * 1.9);
        ctx.arc(cx + s * 0.2, cy - s * 0.15, s * 0.3, Math.PI * 1.2, Math.PI * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.1);
        ctx.lineTo(cx, cy + s * 0.5);
        ctx.moveTo(cx, cy - s * 0.1);
        ctx.lineTo(cx - s * 0.2, cy + s * 0.15);
        ctx.moveTo(cx, cy - s * 0.1);
        ctx.lineTo(cx + s * 0.2, cy + s * 0.15);
        ctx.stroke();
        break;

      case 'analysis': // Chart
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.5, cy + s * 0.5);
        ctx.lineTo(cx - s * 0.5, cy - s * 0.5);
        ctx.moveTo(cx - s * 0.55, cy + s * 0.5);
        ctx.lineTo(cx + s * 0.55, cy + s * 0.5);
        ctx.stroke();
        // Bars
        ctx.fillRect(cx - s * 0.35, cy + s * 0.1, s * 0.2, s * 0.35);
        ctx.fillRect(cx - s * 0.05, cy - s * 0.2, s * 0.2, s * 0.65);
        ctx.fillRect(cx + s * 0.25, cy - s * 0.35, s * 0.2, s * 0.8);
        break;

      // Verify-mode icons (prefix 'v' stripped for matching, reuse where sensible)
      case 'vConnect': // Magnifying glass + plug
        ctx.beginPath();
        ctx.arc(cx - s * 0.1, cy - s * 0.1, s * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + s * 0.15, cy + s * 0.2);
        ctx.lineTo(cx + s * 0.55, cy + s * 0.6);
        ctx.stroke();
        break;

      case 'vFetchProjects': // List with download
        ctx.strokeRect(cx - s * 0.45, cy - s * 0.6, s * 0.9, s * 1.2);
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.2, cy - s * 0.25);
        ctx.lineTo(cx + s * 0.25, cy - s * 0.25);
        ctx.moveTo(cx - s * 0.2, cy + s * 0.05);
        ctx.lineTo(cx + s * 0.25, cy + s * 0.05);
        ctx.stroke();
        break;

      case 'vBuildMappings': // Network/map
        ctx.beginPath();
        ctx.arc(cx - s * 0.35, cy - s * 0.3, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + s * 0.35, cy - s * 0.3, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.35, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.2, cy - s * 0.2);
        ctx.lineTo(cx + s * 0.2, cy - s * 0.2);
        ctx.moveTo(cx - s * 0.25, cy - s * 0.15);
        ctx.lineTo(cx - s * 0.1, cy + s * 0.2);
        ctx.moveTo(cx + s * 0.25, cy - s * 0.15);
        ctx.lineTo(cx + s * 0.1, cy + s * 0.2);
        ctx.stroke();
        break;

      case 'vQualityGates': // Shield with checkmark
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.8);
        ctx.lineTo(cx - s * 0.6, cy - s * 0.4);
        ctx.lineTo(cx - s * 0.6, cy + s * 0.1);
        ctx.quadraticCurveTo(cx, cy + s * 0.9, cx, cy + s * 0.9);
        ctx.quadraticCurveTo(cx, cy + s * 0.9, cx + s * 0.6, cy + s * 0.1);
        ctx.lineTo(cx + s * 0.6, cy - s * 0.4);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.2, cy);
        ctx.lineTo(cx - s * 0.05, cy + s * 0.2);
        ctx.lineTo(cx + s * 0.25, cy - s * 0.15);
        ctx.stroke();
        break;

      case 'vQualityProfiles': // Clipboard with checkmark
        ctx.strokeRect(cx - s * 0.45, cy - s * 0.7, s * 0.9, s * 1.4);
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.2, cy - s * 0.1);
        ctx.lineTo(cx - s * 0.05, cy + s * 0.1);
        ctx.lineTo(cx + s * 0.25, cy - s * 0.2);
        ctx.stroke();
        break;

      case 'vGroups': // Two people (reuse groups icon)
        ctx.beginPath();
        ctx.arc(cx - s * 0.25, cy - s * 0.25, s * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - s * 0.25, cy + s * 0.55, s * 0.4, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + s * 0.35, cy - s * 0.15, s * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'vPermissions': // Lock (reuse permissions icon)
        ctx.beginPath();
        ctx.arc(cx, cy - s * 0.2, s * 0.35, Math.PI, 0);
        ctx.stroke();
        ctx.strokeRect(cx - s * 0.45, cy, s * 0.9, s * 0.65);
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.25, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'vProjects': // Folder (reuse projects icon)
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.55, cy - s * 0.25);
        ctx.lineTo(cx - s * 0.55, cy - s * 0.55);
        ctx.lineTo(cx - s * 0.1, cy - s * 0.55);
        ctx.lineTo(cx + s * 0.05, cy - s * 0.35);
        ctx.lineTo(cx + s * 0.55, cy - s * 0.35);
        ctx.lineTo(cx + s * 0.55, cy + s * 0.55);
        ctx.lineTo(cx - s * 0.55, cy + s * 0.55);
        ctx.closePath();
        ctx.stroke();
        break;

      case 'vBranches': // Git branch
        ctx.beginPath();
        ctx.arc(cx - s * 0.25, cy - s * 0.4, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + s * 0.25, cy - s * 0.4, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.45, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.25, cy - s * 0.25);
        ctx.quadraticCurveTo(cx - s * 0.25, cy + s * 0.15, cx, cy + s * 0.3);
        ctx.moveTo(cx + s * 0.25, cy - s * 0.25);
        ctx.quadraticCurveTo(cx + s * 0.25, cy + s * 0.15, cx, cy + s * 0.3);
        ctx.stroke();
        break;

      case 'vIssues': // Bug/issue
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.15);
        ctx.lineTo(cx, cy + s * 0.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.22, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'vHotspots': // Flame (reuse hotspotSync icon)
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.6);
        ctx.quadraticCurveTo(cx - s * 0.5, cy + s * 0.1, cx - s * 0.3, cy - s * 0.3);
        ctx.quadraticCurveTo(cx - s * 0.1, cy - s * 0.1, cx, cy - s * 0.7);
        ctx.quadraticCurveTo(cx + s * 0.1, cy - s * 0.1, cx + s * 0.3, cy - s * 0.3);
        ctx.quadraticCurveTo(cx + s * 0.5, cy + s * 0.1, cx, cy + s * 0.6);
        ctx.stroke();
        break;

      case 'vMeasures': // Chart bars (reuse analysis icon)
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.5, cy + s * 0.5);
        ctx.lineTo(cx - s * 0.5, cy - s * 0.5);
        ctx.moveTo(cx - s * 0.55, cy + s * 0.5);
        ctx.lineTo(cx + s * 0.55, cy + s * 0.5);
        ctx.stroke();
        ctx.fillRect(cx - s * 0.35, cy + s * 0.1, s * 0.2, s * 0.35);
        ctx.fillRect(cx - s * 0.05, cy - s * 0.2, s * 0.2, s * 0.65);
        ctx.fillRect(cx + s * 0.25, cy - s * 0.35, s * 0.2, s * 0.8);
        break;

      case 'vPortfolios': // Grid (reuse portfolios icon)
        ctx.strokeRect(cx - s * 0.55, cy - s * 0.4, s * 1.1, s * 0.8);
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.4);
        ctx.lineTo(cx, cy + s * 0.4);
        ctx.moveTo(cx - s * 0.55, cy);
        ctx.lineTo(cx + s * 0.55, cy);
        ctx.stroke();
        break;

      default: // Circle dot fallback
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  },

  // ── Lifecycle ───────────────────────────────────────────────────

  create(containerEl, mode) {
    this.container = containerEl;
    this.mode = mode || 'migrate';
    this.allDone = false;
    this.particles = [];
    this.pulseRings = [];
    this.dashOffset = 0;
    this.lastFrameTime = 0;

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

    // Drag interaction
    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onMouseUp = this._handleMouseUp.bind(this);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
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
      if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    }
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this._dragNode = null;
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.nodes = [];
    this.edges = [];
    this.particles = [];
    this.pulseRings = [];
    this.allDone = false;
    this.mode = null;
  },

  // ── Graph Construction ──────────────────────────────────────────

  _buildGraph() {
    const def = this._graphDefs[this.mode];
    if (!def) return;

    this.nodes = def.nodes.map(n => ({
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
    }));

    this.edges = def.edges.map(([from, to]) => ({ from, to }));
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

      this.nodes.forEach(n => {
        const nodeDef = nodeDefs.find(d => d.id === n.id);
        // Use explicit xPct if defined, otherwise use column position
        n.targetX = (nodeDef && nodeDef.xPct != null) ? nodeDef.xPct * cw : colX[n.col] * cw;
        // Use explicit yPct if defined in the graph definition
        if (nodeDef && nodeDef.yPct != null) {
          n.targetY = nodeDef.yPct * ch;
        } else {
          n.targetY = ch * 0.5;
        }
      });
    } else {
      const numNodes = this.nodes.length;
      this.nodes.forEach((n, i) => {
        const margin = 0.1;
        const span = 1 - margin * 2;
        n.targetX = (margin + (numNodes > 1 ? (i / (numNodes - 1)) * span : 0.5 - margin)) * cw;
        n.targetY = ch * 0.5;
      });
    }

    if (firstLayout) {
      // Initialize positions with slight random offset for visual pop
      this.nodes.forEach(n => {
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

  // ── Drag Interaction ────────────────────────────────────────────

  _canvasMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  },

  _nodeAtPoint(px, py) {
    // Reverse order so topmost (last drawn) node is picked first
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      if (px >= n.x - n.width / 2 && px <= n.x + n.width / 2 &&
          py >= n.y - n.height / 2 && py <= n.y + n.height / 2) {
        return n;
      }
    }
    return null;
  },

  _handleMouseDown(e) {
    const pos = this._canvasMousePos(e);
    const node = this._nodeAtPoint(pos.x, pos.y);
    if (!node) return;

    this._dragNode = node;
    this._dragOffsetX = pos.x - node.x;
    this._dragOffsetY = pos.y - node.y;
    node.vx = 0;
    node.vy = 0;
    this.canvas.style.cursor = 'grabbing';

    // Wake up animation loop
    this._forceSettled = false;
    if (!this.animFrame) this._scheduleFrame();
  },

  _handleMouseMove(e) {
    if (!this._dragNode) {
      // Update cursor on hover
      if (this.canvas) {
        const pos = this._canvasMousePos(e);
        const hover = this._nodeAtPoint(pos.x, pos.y);
        this.canvas.style.cursor = hover ? 'grab' : 'default';
      }
      return;
    }

    const pos = this._canvasMousePos(e);
    const node = this._dragNode;
    node.x = pos.x - this._dragOffsetX;
    node.y = pos.y - this._dragOffsetY;
    node.vx = 0;
    node.vy = 0;

    // Keep simulation running while dragging
    this._forceSettled = false;
  },

  _handleMouseUp() {
    if (!this._dragNode) return;
    // Lock the node where the user dropped it by updating its target
    this._dragNode.targetX = this._dragNode.x;
    this._dragNode.targetY = this._dragNode.y;
    this._dragNode = null;
    if (this.canvas) this.canvas.style.cursor = 'default';
  },

  // ── Force Simulation ────────────────────────────────────────────

  _simulateForces() {
    const gravity = this._forceGravity;
    const repulsion = this._forceRepulsion;
    const damping = this._forceDamping;
    let maxMove = 0;

    // Apply forces to each node
    const dragged = this._dragNode;
    this.nodes.forEach(node => {
      // Skip force application for the node being dragged
      if (node === dragged) {
        node.vx = 0;
        node.vy = 0;
        return;
      }

      let fx = 0, fy = 0;

      // Gravity: pull toward target position
      fx += (node.targetX - node.x) * gravity;
      fy += (node.targetY - node.y) * gravity;

      // Repulsion: push away from other nodes
      this.nodes.forEach(other => {
        if (other === node) return;
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const distSq = dx * dx + dy * dy;
        const minDist = 400; // prevent extreme forces at very close range
        const d = Math.max(distSq, minDist);
        const force = repulsion / d;
        const dist = Math.sqrt(d);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      });

      node.vx = (node.vx + fx) * damping;
      node.vy = (node.vy + fy) * damping;
    });

    // Update positions and clamp to canvas bounds
    const dpr = window.devicePixelRatio || 1;
    const cw = this.canvas ? this.canvas.width / dpr : 800;
    const ch = this.canvas ? this.canvas.height / dpr : 260;

    this.nodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;

      // Clamp so the full node box stays within the canvas
      const hw = node.width / 2;
      const hh = node.height / 2;
      const margin = 4;
      node.x = Math.max(hw + margin, Math.min(cw - hw - margin, node.x));
      node.y = Math.max(hh + margin, Math.min(ch - hh - margin, node.y));

      // Kill velocity if we hit a wall
      if (node.x <= hw + margin || node.x >= cw - hw - margin) node.vx = 0;
      if (node.y <= hh + margin || node.y >= ch - hh - margin) node.vy = 0;

      maxMove = Math.max(maxMove, Math.abs(node.vx), Math.abs(node.vy));
    });

    // Never settle while dragging; otherwise settle when movement is negligible
    this._forceSettled = !this._dragNode && maxMove < 0.05;
  },

  // ── Animation Loop ──────────────────────────────────────────────

  _scheduleFrame() {
    this.animFrame = requestAnimationFrame(t => this.render(t));
  },

  render(timestamp) {
    this.animFrame = null; // mark frame as consumed
    if (!this.ctx || !this.canvas) return;

    // Throttle to ~30fps
    if (timestamp - this.lastFrameTime < 33) {
      this._scheduleFrame();
      return;
    }
    this.lastFrameTime = timestamp;

    const dpr = window.devicePixelRatio || 1;
    const cw = this.canvas.width / dpr;
    const ch = this.canvas.height / dpr;

    // Run force simulation
    if (!this._forceSettled) {
      this._simulateForces();
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    this._drawGrid(ctx, cw, ch);
    this._drawEdges(ctx);
    this._drawParticles(ctx);
    this._drawNodes(ctx, timestamp);
    this._drawPulseRings(ctx, timestamp);

    ctx.restore();

    // Advance dash offset for active edge animation
    this.dashOffset -= 0.6;

    // Always keep animating — particles and dash offsets should continue even after completion
    this._scheduleFrame();
  },

  // ── Grid ────────────────────────────────────────────────────────

  _drawGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = this.themeColors.gridLine || 'rgba(74, 125, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.04;

    const step = 40;
    for (let x = step; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = step; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  },

  // ── Edges ───────────────────────────────────────────────────────

  _edgePoints(src, tgt) {
    const hw = (n) => n.width / 2;
    const hh = (n) => n.height / 2;
    const pad = 12; // clearance around nodes

    if (src.col === tgt.col) {
      // Vertical edge: exit bottom of src → enter top of tgt
      const x1 = src.x, y1 = src.y + hh(src);
      const x2 = tgt.x, y2 = tgt.y - hh(tgt);
      const gap = y2 - y1;
      return {
        x1, y1, x2, y2,
        cp1x: x1, cp1y: y1 + gap * 0.4,
        cp2x: x2, cp2y: y2 - gap * 0.4,
      };
    }

    // Cross-column: exit right of src → enter left of tgt
    const x1 = src.x + hw(src);
    const y1 = src.y;
    const x2 = tgt.x - hw(tgt);
    const y2 = tgt.y;
    const dx = x2 - x1;

    // Collect intermediate nodes (not src/tgt) whose bounding box
    // is between x1 and x2 — candidates for edge collision.
    const obstacles = this.nodes.filter(n => {
      if (n.id === src.id || n.id === tgt.id) return false;
      const nl = n.x - hw(n) - pad;
      const nr = n.x + hw(n) + pad;
      return nr > Math.min(x1, x2) && nl < Math.max(x1, x2);
    });

    // Test if a candidate bezier curve intersects any obstacle node
    const curveClearsNodes = (cp1x, cp1y, cp2x, cp2y) => {
      const pts = { x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y };
      for (const obs of obstacles) {
        const ol = obs.x - hw(obs) - pad;
        const or_ = obs.x + hw(obs) + pad;
        const ot = obs.y - hh(obs) - pad;
        const ob = obs.y + hh(obs) + pad;
        // Sample curve at intervals to check overlap
        for (let t = 0.1; t <= 0.9; t += 0.05) {
          const pt = this.cubicBezierPoint(t, pts);
          if (pt.x >= ol && pt.x <= or_ && pt.y >= ot && pt.y <= ob) {
            return false;
          }
        }
      }
      return true;
    };

    // Default S-curve
    const defCp1x = x1 + dx * 0.5;
    const defCp1y = y1;
    const defCp2x = x2 - dx * 0.5;
    const defCp2y = y2;

    if (obstacles.length === 0 || curveClearsNodes(defCp1x, defCp1y, defCp2x, defCp2y)) {
      return { x1, y1, x2, y2, cp1x: defCp1x, cp1y: defCp1y, cp2x: defCp2x, cp2y: defCp2y };
    }

    // Find the obstacle node closest to the midpoint of the edge
    // and determine whether to route above or below it.
    const midX = (x1 + x2) / 2;
    let worstObs = obstacles[0];
    let worstDist = Infinity;
    for (const obs of obstacles) {
      const d = Math.abs(obs.x - midX);
      if (d < worstDist) { worstDist = d; worstObs = obs; }
    }

    // Route above or below the obstacle — pick the shorter detour
    const aboveY = worstObs.y - hh(worstObs) - pad - 8;
    const belowY = worstObs.y + hh(worstObs) + pad + 8;
    const midY = (y1 + y2) / 2;
    const routeY = Math.abs(aboveY - midY) < Math.abs(belowY - midY) ? aboveY : belowY;

    // Try early inflection (route around obstacle)
    const frac = 0.2;
    const altCp1x = x1 + dx * frac;
    const altCp1y = routeY;
    const altCp2x = x2 - dx * frac;
    const altCp2y = routeY;

    if (curveClearsNodes(altCp1x, altCp1y, altCp2x, altCp2y)) {
      return { x1, y1, x2, y2, cp1x: altCp1x, cp1y: altCp1y, cp2x: altCp2x, cp2y: altCp2y };
    }

    // Fallback: aggressive early inflection with both CPs at routeY
    const aggCp1x = x1 + dx * 0.1;
    const aggCp2x = x2 - dx * 0.1;
    return { x1, y1, x2, y2, cp1x: aggCp1x, cp1y: routeY, cp2x: aggCp2x, cp2y: routeY };
  },

  _drawEdges(ctx) {
    this.edges.forEach(edge => {
      const src = this._nodeById(edge.from);
      const tgt = this._nodeById(edge.to);
      if (!src || !tgt) return;

      const pts = this._edgePoints(src, tgt);

      // Determine color from source state
      let color, alpha;
      if (src.state === 'done') {
        color = { r: 63, g: 185, b: 80 };
        alpha = 0.7;
      } else if (src.state === 'active') {
        color = { r: 210, g: 153, b: 34 };
        alpha = 0.7;
      } else {
        const pending = (this.themeColors && this.themeColors.pending) || { r: 110, g: 118, b: 138 };
        color = pending;
        alpha = 0.25;
      }

      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;

      if (src.state === 'active') {
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`;
        ctx.setLineDash([8, 4]);
        ctx.lineDashOffset = this.dashOffset;
      } else {
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(pts.x1, pts.y1);
      ctx.bezierCurveTo(pts.cp1x, pts.cp1y, pts.cp2x, pts.cp2y, pts.x2, pts.y2);
      ctx.stroke();
      ctx.restore();

      // Spawn/maintain particles for done edges
      if (src.state === 'done') {
        this._ensureEdgeParticles(edge);
      }
    });
  },

  // ── Edge Particles ──────────────────────────────────────────────

  _ensureEdgeParticles(edge) {
    const key = edge.from + '->' + edge.to;
    const existing = this.particles.filter(p => p.key === key);
    if (existing.length >= 2) return;

    for (let i = existing.length; i < 2; i++) {
      this.particles.push({ key, from: edge.from, to: edge.to, t: i * 0.5 });
    }
  },

  _drawParticles(ctx) {
    ctx.save();
    this.particles.forEach(p => {
      p.t += 0.004;
      if (p.t >= 1.0) p.t -= 1.0;

      // Recompute edge points from current node positions each frame
      const src = this._nodeById(p.from);
      const tgt = this._nodeById(p.to);
      if (!src || !tgt) return;
      const pts = this._edgePoints(src, tgt);

      const pt = this.cubicBezierPoint(p.t, pts);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(63, 185, 80, 0.6)';
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(63, 185, 80, 0.4)';
      ctx.fill();
    });
    ctx.restore();
  },

  // ── Nodes ───────────────────────────────────────────────────────

  _drawNodes(ctx, timestamp) {
    this.nodes.forEach(node => {
      const { r, g, b } = this.lerpColor(node.progress);
      const nx = node.x - node.width / 2;
      const ny = node.y - node.height / 2;

      ctx.save();

      // Glow for active nodes (oscillating)
      if (node.state === 'active') {
        const pulse = Math.sin(timestamp * 0.004) * 0.3 + 0.7;
        ctx.shadowBlur = 14 * pulse;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.6 * pulse})`;
      } else if (node.state === 'done') {
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
      } else {
        ctx.shadowBlur = 4;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.2)`;
      }

      // Rounded rect fill
      this.roundedRect(ctx, nx, ny, node.width, node.height, 6);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Active outer glow ring
      if (node.state === 'active') {
        const osc = Math.sin(timestamp * 0.003) * 0.15 + 0.25;
        ctx.save();
        ctx.shadowBlur = 0;
        this.roundedRect(ctx, nx - 3, ny - 3, node.width + 6, node.height + 6, 9);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${osc})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // Icon + Label — icon on left, text on right
      ctx.shadowBlur = 0;
      const iconSize = 11;
      const iconColor = `rgba(${r}, ${g}, ${b}, 0.85)`;
      const iconX = nx + 13;           // icon center X: 13px from left edge
      const textX = nx + 28;           // text left edge: 28px from left (15px gap from icon)

      ctx.font = `10px ${this._font}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.themeColors.text || '#e6edf3';

      if (node.count) {
        this._drawIcon(ctx, node.id, iconX, node.y - 3, iconSize, iconColor);
        ctx.fillText(node.label, textX, node.y - 5);
        ctx.font = `9px ${this._font}`;
        ctx.fillStyle = this.themeColors.textMuted || '#7d8590';
        ctx.fillText(node.count, textX, node.y + 7);
      } else {
        this._drawIcon(ctx, node.id, iconX, node.y, iconSize, iconColor);
        ctx.fillText(node.label, textX, node.y);
      }

      ctx.restore();
    });
  },

  // ── Pulse Rings ─────────────────────────────────────────────────

  _drawPulseRings(ctx, timestamp) {
    const now = Date.now();
    const duration = 600;

    this.pulseRings = this.pulseRings.filter(ring => {
      const elapsed = now - ring.startTime;
      if (elapsed > duration) return false;

      const t = elapsed / duration;
      const radius = 25 + 25 * t;
      const alpha = 0.5 * (1 - t);

      ctx.save();
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color.replace(/[\d.]+\)$/, `${alpha})`);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      return true;
    });
  },

  // ── State Machine: Log Parsing ──────────────────────────────────

  updateFromLog(line) {
    if (!line || !this.mode) return;

    if (this.mode === 'migrate') {
      this._parseMigrateLine(line);
    } else if (this.mode === 'transfer') {
      this._parseTransferLine(line);
    } else if (this.mode === 'sync-metadata') {
      this._parseSyncMetadataLine(line);
    } else if (this.mode === 'verify') {
      this._parseVerifyLine(line);
    }
  },

  _parseMigrateLine(line) {
    let m;

    // Setup
    if (/Extracting server-wide data|=== Step 2/.test(line)) {
      this.setNodeState('setup', 'active');
      return;
    }
    if (/Generating organization mapping|=== Step 3/.test(line)) {
      this.setNodeState('setup', 'done');
      return;
    }

    // Groups
    m = line.match(/Creating (\d+) groups/);
    if (m) {
      this._setNodeCount('groups', m[1]);
      this.setNodeState('groups', 'active');
      return;
    }
    if (/Setting global permissions/.test(line)) {
      this.setNodeState('groups', 'done');
      this.setNodeState('permissions', 'active');
      return;
    }

    // Quality Gates
    m = line.match(/Creating (\d+) quality gates/);
    if (m) {
      this._setNodeCount('qualityGates', m[1]);
      this.setNodeState('qualityGates', 'active');
      return;
    }

    // Quality Profiles (also marks quality gates done)
    m = line.match(/Restoring(?: (\d+))? quality profiles/);
    if (m) {
      this.setNodeState('qualityGates', 'done');
      if (m[1]) this._setNodeCount('qualityProfiles', m[1]);
      this.setNodeState('qualityProfiles', 'active');
      return;
    }
    if (/Creating.*permission templates/.test(line)) {
      this.setNodeState('qualityProfiles', 'done');
      return;
    }

    // Permission Templates
    m = line.match(/Creating (\d+) permission templates/);
    if (m) {
      this._setNodeCount('permTemplates', m[1]);
      this.setNodeState('permTemplates', 'active');
      return;
    }

    // Projects
    m = line.match(/--- Project (\d+)\/(\d+)/);
    if (m) {
      this._setNodeCount('projects', m[1] + '/' + m[2]);
      const node = this._nodeById('projects');
      if (node && node.state === 'pending') {
        this.setNodeState('permTemplates', 'done');
        this.setNodeState('permissions', 'done');
        this.setNodeState('projects', 'active');
      }
      // Update count on subsequent project lines
      if (node && node.state === 'active') {
        node.count = m[1] + '/' + m[2];
      }
      // Reset sub-nodes for each new project (back to pending visually via progress)
      this._resetSubNodes();
      return;
    }

    // Per-project sub-phases: Scanner Upload
    if (/Starting data extraction|Starting transfer for project|Starting checkpoint|Uploading to SonarCloud|Submitting to SonarCloud/.test(line)) {
      this.setNodeState('scannerUpload', 'active');
      return;
    }
    if (/Transfer completed for project|Scanner report upload for/.test(line)) {
      this.setNodeState('scannerUpload', 'done');
      return;
    }

    // Per-project sub-phases: Issue Sync
    if (/Syncing issue metadata/.test(line)) {
      this.setNodeState('scannerUpload', 'done');
      this.setNodeState('issueSync', 'active');
      return;
    }
    if (/Issue sync.*completed|Issue metadata sync complete/.test(line)) {
      this.setNodeState('issueSync', 'done');
      return;
    }

    // Per-project sub-phases: Hotspot Sync
    if (/Syncing hotspot metadata/.test(line)) {
      this.setNodeState('issueSync', 'done');
      this.setNodeState('hotspotSync', 'active');
      return;
    }
    if (/Hotspot sync.*completed|Hotspot metadata sync complete/.test(line)) {
      this.setNodeState('hotspotSync', 'done');
      return;
    }

    // Per-project sub-phases: Project Config
    if (/Migrating.*project settings|Setting quality gate|Setting quality profiles|Setting permissions for/.test(line)) {
      this.setNodeState('hotspotSync', 'done');
      this.setNodeState('projectConfig', 'active');
      return;
    }
    if (/Project migration complete|Finished migrating project/.test(line)) {
      this.setNodeState('projectConfig', 'done');
      return;
    }

    // Portfolios — finalize all per-project sub-nodes before moving on
    m = line.match(/Creating (\d+) portfolios/);
    if (m) {
      this._setNodeCount('portfolios', m[1]);
      this.setNodeState('projects', 'done');
      this.setNodeState('scannerUpload', 'done');
      this.setNodeState('issueSync', 'done');
      this.setNodeState('hotspotSync', 'done');
      this.setNodeState('projectConfig', 'done');
      this.setNodeState('portfolios', 'active');
      return;
    }

    // Complete — finalize all nodes (sub-nodes may still be amber/red from last project reset)
    if (/Migration complete|=== Migration completed/.test(line)) {
      this.setNodeState('projects', 'done');
      this.setNodeState('scannerUpload', 'done');
      this.setNodeState('issueSync', 'done');
      this.setNodeState('hotspotSync', 'done');
      this.setNodeState('projectConfig', 'done');
      this.setNodeState('portfolios', 'done');
      return;
    }
  },

  _parseTransferLine(line) {
    if (/Testing connections|Starting transfer/.test(line)) {
      this.setNodeState('connect', 'active');
      return;
    }
    if (/Starting data extraction|Starting checkpoint/.test(line)) {
      this.setNodeState('connect', 'done');
      this.setNodeState('extract', 'active');
      return;
    }
    if (/Building protobuf/.test(line)) {
      this.setNodeState('extract', 'done');
      this.setNodeState('buildProtobuf', 'active');
      return;
    }
    if (/Uploading to SonarCloud|Submitting to SonarCloud/.test(line)) {
      this.setNodeState('buildProtobuf', 'done');
      this.setNodeState('upload', 'active');
      return;
    }
    if (/Report submitted/.test(line)) {
      this.setNodeState('upload', 'done');
      this.setNodeState('analysis', 'active');
      return;
    }
    if (/Transfer completed|Analysis completed/.test(line)) {
      this.setNodeState('analysis', 'done');
      return;
    }
  },

  _parseSyncMetadataLine(line) {
    let m;

    m = line.match(/--- Project (\d+)\/(\d+)/);
    if (m) {
      this._setNodeCount('projects', m[1] + '/' + m[2]);
      this.setNodeState('projects', 'active');
      return;
    }
    if (/Syncing issue metadata/.test(line)) {
      this.setNodeState('issueSync', 'active');
      return;
    }
    if (/Syncing hotspot metadata/.test(line)) {
      this.setNodeState('issueSync', 'done');
      this.setNodeState('hotspotSync', 'active');
      return;
    }
    if (/completed|complete/i.test(line)) {
      this.setNodeState('hotspotSync', 'done');
      return;
    }
  },

  _parseVerifyLine(line) {
    let m;

    // Step 1: Connect
    if (/=== Step 1.*Connecting/.test(line)) {
      this.setNodeState('vConnect', 'active');
      return;
    }
    if (/Using pipeline/.test(line)) {
      this.setNodeState('vConnect', 'done');
      return;
    }

    // Step 2: Fetch projects
    if (/=== Step 2.*Fetching project list/.test(line)) {
      this.setNodeState('vConnect', 'done');
      this.setNodeState('vFetchProjects', 'active');
      return;
    }
    m = line.match(/Found (\d+) projects in SonarQube/);
    if (m) {
      this._setNodeCount('vFetchProjects', m[1]);
      this.setNodeState('vFetchProjects', 'done');
      return;
    }

    // Step 3: Build mappings
    if (/=== Step 3.*Building organization mappings/.test(line)) {
      this.setNodeState('vFetchProjects', 'done');
      this.setNodeState('vBuildMappings', 'active');
      return;
    }

    // Org-wide verification checks
    if (/Verifying organization/.test(line)) {
      this.setNodeState('vBuildMappings', 'done');
      return;
    }

    if (/Verifying quality gates/.test(line)) {
      this.setNodeState('vQualityGates', 'active');
      return;
    }
    if (/Quality gate verification/.test(line)) {
      this.setNodeState('vQualityGates', 'done');
      return;
    }

    if (/Verifying quality profiles/.test(line)) {
      this.setNodeState('vQualityProfiles', 'active');
      return;
    }
    if (/Quality profile verification/.test(line)) {
      this.setNodeState('vQualityProfiles', 'done');
      return;
    }

    if (/Verifying groups/.test(line)) {
      this.setNodeState('vGroups', 'active');
      return;
    }
    if (/Group verification/.test(line)) {
      this.setNodeState('vGroups', 'done');
      return;
    }

    if (/Verifying global permissions|Verifying permission templates/.test(line)) {
      this.setNodeState('vPermissions', 'active');
      return;
    }
    if (/Permission template verification|Global permission verification/.test(line)) {
      this.setNodeState('vPermissions', 'done');
      return;
    }

    // Per-project checks
    m = line.match(/--- Project (\d+)\/(\d+)/);
    if (m) {
      this._setNodeCount('vProjects', m[1] + '/' + m[2]);
      const node = this._nodeById('vProjects');
      if (node && node.state === 'pending') {
        // Mark org-wide checks done when projects start
        this.setNodeState('vQualityGates', 'done');
        this.setNodeState('vQualityProfiles', 'done');
        this.setNodeState('vGroups', 'done');
        this.setNodeState('vPermissions', 'done');
        this.setNodeState('vProjects', 'active');
      }
      if (node && node.state === 'active') {
        node.count = m[1] + '/' + m[2];
      }
      // Reset sub-nodes for each new project
      this._resetVerifySubNodes();
      return;
    }

    // Branch verification
    if (/Branch verification/.test(line)) {
      this.setNodeState('vBranches', 'active');
      this.setNodeState('vBranches', 'done');
      return;
    }

    // Issue verification
    if (/Fetching issues from SonarQube/.test(line)) {
      this.setNodeState('vBranches', 'done');
      this.setNodeState('vIssues', 'active');
      return;
    }
    if (/Issue verification/.test(line)) {
      this.setNodeState('vIssues', 'done');
      return;
    }

    // Hotspot verification
    if (/Fetching hotspots from SonarQube|Fetching hotspots for project/.test(line)) {
      this.setNodeState('vIssues', 'done');
      this.setNodeState('vHotspots', 'active');
      return;
    }
    if (/Hotspot verification/.test(line)) {
      this.setNodeState('vHotspots', 'done');
      return;
    }

    // Measures verification
    if (/Fetching measures for project|Measures verification/.test(line)) {
      this.setNodeState('vHotspots', 'done');
      this.setNodeState('vMeasures', 'active');
      if (/Measures verification/.test(line)) {
        this.setNodeState('vMeasures', 'done');
      }
      return;
    }

    // Project settings/config checks
    if (/Fetching project settings|Fetching quality gate for|Fetching quality profiles for/.test(line)) {
      this.setNodeState('vMeasures', 'done');
      return;
    }

    // Portfolios
    if (/Verifying portfolios/.test(line)) {
      this.setNodeState('vProjects', 'done');
      this.setNodeState('vBranches', 'done');
      this.setNodeState('vIssues', 'done');
      this.setNodeState('vHotspots', 'done');
      this.setNodeState('vMeasures', 'done');
      this.setNodeState('vPortfolios', 'active');
      return;
    }
    if (/Portfolio verification/.test(line)) {
      this.setNodeState('vPortfolios', 'done');
      return;
    }

    // Overall completion — mark ALL nodes done
    if (/Verification complete|Verification Summary|all checks passed/.test(line)) {
      this.nodes.forEach(n => this.setNodeState(n.id, 'done'));
      return;
    }
  },

  _resetVerifySubNodes() {
    // Reset per-project sub-nodes so they cycle pending→active→done for each project
    const subIds = ['vBranches', 'vIssues', 'vHotspots', 'vMeasures'];
    subIds.forEach(id => {
      const node = this._nodeById(id);
      if (node) {
        node.state = 'pending';
        node.progress = 0;
      }
    });
    // Remove particles for sub-node edges
    this.particles = this.particles.filter(p => {
      return !subIds.some(id => p.key.includes(id));
    });
  },

  // ── State Transitions ──────────────────────────────────────────

  setNodeState(nodeId, newState) {
    const node = this._nodeById(nodeId);
    if (!node) return;

    const rank = { pending: 0, active: 1, done: 2 };
    if (rank[node.state] >= rank[newState]) return;

    node.state = newState;
    node.progress = newState === 'pending' ? 0 : newState === 'active' ? 0.5 : 1.0;
    node.pulseTime = Date.now();

    // Pulse ring
    const { r, g, b } = this.lerpColor(node.progress);
    this.pulseRings.push({
      x: node.x,
      y: node.y,
      startTime: Date.now(),
      color: `rgba(${r}, ${g}, ${b}, 1)`,
    });

    // Check all done
    const wasDone = this.allDone;
    this.allDone = this.nodes.length > 0 && this.nodes.every(n => n.state === 'done');

    if (!wasDone && this.allDone) {
      // Force final render by resetting throttle so the frame is guaranteed to draw
      this.lastFrameTime = 0;
      requestAnimationFrame(t => {
        this.render(t);
      });
    } else if (!this.animFrame) {
      // Restart loop if it stopped (force sim or animation may need it)
      this._scheduleFrame();
    }
  },

  // ── Helpers ─────────────────────────────────────────────────────

  _nodeById(id) {
    return this.nodes.find(n => n.id === id) || null;
  },

  _setNodeCount(nodeId, count) {
    const node = this._nodeById(nodeId);
    if (node) node.count = String(count);
  },

  _resetSubNodes() {
    // Reset per-project sub-nodes so they cycle red→amber→green for each project
    const subIds = ['scannerUpload', 'issueSync', 'hotspotSync', 'projectConfig'];
    subIds.forEach(id => {
      const node = this._nodeById(id);
      if (node) {
        node.state = 'pending';
        node.progress = 0;
      }
    });
    // Remove particles for sub-node edges
    this.particles = this.particles.filter(p => {
      return !subIds.some(id => p.key.includes(id));
    });
  },

  lerpColor(progress) {
    const p = Math.max(0, Math.min(1, progress));
    const pending = (this.themeColors && this.themeColors.pending) || { r: 110, g: 118, b: 138 };
    let r, g, b;
    if (p <= 0.5) {
      // Pending (theme-aware muted) → Amber
      const t = p / 0.5;
      r = pending.r + (210 - pending.r) * t;
      g = pending.g + (153 - pending.g) * t;
      b = pending.b + (34 - pending.b) * t;
    } else {
      // Amber → Green
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
      // Pending: muted slate for dark, muted cool gray for light
      pending: isDark
        ? { r: 110, g: 118, b: 138 }
        : { r: 160, g: 168, b: 185 },
    };
  },
};
