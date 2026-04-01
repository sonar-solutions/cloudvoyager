/**
 * MigrationGraph — Dynamic per-project node module.
 * Handles creation and layout of per-project fan-out nodes
 * for both migrate and sync-metadata modes.
 */
Object.assign(window.MigrationGraph, {

  // ── Dynamic Per-Project Node Generation (migrate mode) ─────────

  _addProjectBranch(projectKey, index, total) {
    const truncLabel = projectKey.length > 18 ? projectKey.slice(0, 17) + '\u2026' : projectKey;

    const makeNode = (suffix, label) => {
      const id = `p:${projectKey}:${suffix}`;
      const node = {
        id,
        label,
        count: '',
        x: 0, y: 0,
        targetX: 0, targetY: 0,
        vx: 0, vy: 0,
        width: 110,
        height: 26,
        state: 'pending',
        progress: 0,
        pulseTime: 0,
        col: 4, // beyond org-level columns
        row: index,
        isProjectNode: true,
      };
      this.nodes.push(node);
      this._nodeMap.set(id, node);
      return id;
    };

    const uploadId = makeNode('upload', truncLabel);
    const configId = makeNode('config', 'Config');
    const issuesId = makeNode('issues', 'Issues');
    const hotspotsId = makeNode('hotspots', 'Hotspots');

    // Store IDs
    this._projectNodes.set(projectKey, {
      upload: uploadId,
      config: configId,
      issues: issuesId,
      hotspots: hotspotsId,
    });
    this._projectKeys.push(projectKey);

    // Create edges
    this.edges.push({ from: 'projects', to: uploadId, type: 'fanout' });
    this.edges.push({ from: uploadId, to: configId, type: 'internal' });
    this.edges.push({ from: configId, to: issuesId, type: 'internal' });
    this.edges.push({ from: configId, to: hotspotsId, type: 'internal' });
    this.edges.push({ from: configId, to: 'portfolios', type: 'fanout' });
  },

  _computeProjectPositions() {
    const projectsNode = this._nodeById('projects');
    if (!projectsNode) return;

    const total = this._projectKeys.length;
    if (total === 0) return;

    const slotH = total <= 10 ? 80 : total <= 30 ? 60 : 45;
    const fanTop = projectsNode.targetY - (total * slotH) / 2;

    this._projectKeys.forEach((key, i) => {
      const ids = this._projectNodes.get(key);
      if (!ids) return;

      const cy = fanTop + i * slotH + slotH / 2;
      const baseX = projectsNode.targetX + 200;

      const setTarget = (nodeId, tx, ty) => {
        const node = this._nodeById(nodeId);
        if (!node) return;
        const isNew = node.targetX === 0 && node.targetY === 0;
        node.targetX = tx;
        node.targetY = ty;
        if (isNew) {
          // Initialize position near the projects node for smooth animation
          node.x = projectsNode.x + 20;
          node.y = projectsNode.y;
        }
      };

      setTarget(ids.upload, baseX, cy);
      setTarget(ids.config, baseX + 170, cy);
      setTarget(ids.issues, baseX + 340, cy - 15);
      setTarget(ids.hotspots, baseX + 340, cy + 15);
    });

    // Move portfolios to the far right, vertically centered
    const portfoliosNode = this._nodeById('portfolios');
    if (portfoliosNode) {
      portfoliosNode.targetX = projectsNode.targetX + 720;
      portfoliosNode.targetY = projectsNode.targetY;
    }

    this._forceSettled = false;
  },

  // ── Dynamic Per-Project Node Generation (sync-metadata mode) ───

  _addSyncMetadataProjectBranch(projectKey, index, total) {
    const truncLabel = projectKey.length > 18 ? projectKey.slice(0, 17) + '\u2026' : projectKey;

    const makeNode = (suffix, label) => {
      const id = `p:${projectKey}:${suffix}`;
      const node = {
        id, label,
        count: '',
        x: 0, y: 0, targetX: 0, targetY: 0,
        vx: 0, vy: 0,
        width: 110, height: 26,
        state: 'pending', progress: 0, pulseTime: 0,
        col: 2, row: index,
        isProjectNode: true,
      };
      this.nodes.push(node);
      this._nodeMap.set(id, node);
      return id;
    };

    const issuesId = makeNode('issues', truncLabel + ' Issues');
    const hotspotsId = makeNode('hotspots', truncLabel + ' Hotspots');

    this._projectNodes.set(projectKey, { issues: issuesId, hotspots: hotspotsId });
    this._projectKeys.push(projectKey);

    this.edges.push({ from: 'projects', to: issuesId, type: 'fanout' });
    this.edges.push({ from: 'projects', to: hotspotsId, type: 'fanout' });
  },

  _computeSyncMetadataProjectPositions() {
    const projectsNode = this._nodeById('projects');
    if (!projectsNode) return;

    const total = this._projectKeys.length;
    if (total === 0) return;

    const slotH = total <= 10 ? 60 : total <= 30 ? 45 : 35;
    const fanTop = projectsNode.targetY - (total * slotH);

    this._projectKeys.forEach((key, i) => {
      const ids = this._projectNodes.get(key);
      if (!ids) return;

      const cy = fanTop + i * slotH * 2 + slotH;
      const baseX = projectsNode.targetX + 200;

      const setTarget = (nodeId, tx, ty) => {
        const node = this._nodeById(nodeId);
        if (!node) return;
        const isNew = node.targetX === 0 && node.targetY === 0;
        node.targetX = tx;
        node.targetY = ty;
        if (isNew) {
          node.x = projectsNode.x + 20;
          node.y = projectsNode.y;
        }
      };

      setTarget(ids.issues, baseX, cy - slotH * 0.3);
      setTarget(ids.hotspots, baseX, cy + slotH * 0.3);
    });

    this._forceSettled = false;
  },
});
