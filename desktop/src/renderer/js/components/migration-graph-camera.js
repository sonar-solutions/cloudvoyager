/**
 * MigrationGraph — Camera & interaction module.
 * Handles zoom, pan, drag, auto-fit, and coordinate transforms.
 */
Object.assign(window.MigrationGraph, {

  _screenToWorld(sx, sy) {
    return {
      x: (sx - this._camX) / this._camScale,
      y: (sy - this._camY) / this._camScale,
    };
  },

  _worldToScreen(wx, wy) {
    return {
      x: wx * this._camScale + this._camX,
      y: wy * this._camScale + this._camY,
    };
  },

  _autoFit() {
    if (this.nodes.length === 0 || !this.canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = this.canvas.width / dpr;
    const ch = this.canvas.height / dpr;
    const padding = 50;

    // Compute bounding box of all node targets
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.nodes.forEach(n => {
      const tx = n.targetX || n.x;
      const ty = n.targetY || n.y;
      minX = Math.min(minX, tx - n.width / 2);
      maxX = Math.max(maxX, tx + n.width / 2);
      minY = Math.min(minY, ty - n.height / 2);
      maxY = Math.max(maxY, ty + n.height / 2);
    });

    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw <= 0 || bh <= 0) return;

    const scaleX = (cw - padding * 2) / bw;
    const scaleY = (ch - padding * 2) / bh;
    const scale = Math.min(scaleX, scaleY, this._camMaxScale);
    const clampedScale = Math.max(this._camMinScale, Math.min(this._camMaxScale, scale));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this._camTargetScale = clampedScale;
    this._camTargetX = cw / 2 - centerX * clampedScale;
    this._camTargetY = ch / 2 - centerY * clampedScale;
    this._camAnimating = true;
    this._camAnimFrames = 0;

    if (!this.animFrame) this._scheduleFrame();
  },

  _animateCamera() {
    if (!this._camAnimating) return;

    const lerpFactor = 0.12;
    this._camX += (this._camTargetX - this._camX) * lerpFactor;
    this._camY += (this._camTargetY - this._camY) * lerpFactor;
    this._camScale += (this._camTargetScale - this._camScale) * lerpFactor;

    this._camAnimFrames++;

    const dx = Math.abs(this._camTargetX - this._camX);
    const dy = Math.abs(this._camTargetY - this._camY);
    const ds = Math.abs(this._camTargetScale - this._camScale);

    if ((dx < 0.5 && dy < 0.5 && ds < 0.001) || this._camAnimFrames > 60) {
      this._camX = this._camTargetX;
      this._camY = this._camTargetY;
      this._camScale = this._camTargetScale;
      this._camAnimating = false;
    }
  },

  // ── Interaction Handlers ────────────────────────────────────────

  _canvasMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  },

  _nodeAtPoint(px, py) {
    // Convert screen coords to world coords
    const world = this._screenToWorld(px, py);
    // Reverse order so topmost (last drawn) node is picked first
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      if (world.x >= n.x - n.width / 2 && world.x <= n.x + n.width / 2 &&
          world.y >= n.y - n.height / 2 && world.y <= n.y + n.height / 2) {
        return n;
      }
    }
    return null;
  },

  _handleMouseDown(e) {
    const pos = this._canvasMousePos(e);
    const node = this._nodeAtPoint(pos.x, pos.y);

    if (node) {
      // Start dragging a node
      const world = this._screenToWorld(pos.x, pos.y);
      this._dragNode = node;
      this._dragOffsetX = world.x - node.x;
      this._dragOffsetY = world.y - node.y;
      node.vx = 0;
      node.vy = 0;
      this.canvas.style.cursor = 'grabbing';
    } else {
      // Start panning
      this._isPanning = true;
      this._panStartX = pos.x;
      this._panStartY = pos.y;
      this._camStartX = this._camX;
      this._camStartY = this._camY;
      this.canvas.style.cursor = 'grabbing';
    }

    // Wake up animation loop
    this._forceSettled = false;
    if (!this.animFrame) this._scheduleFrame();
  },

  _handleMouseMove(e) {
    if (this._isPanning) {
      const pos = this._canvasMousePos(e);
      this._camX = this._camStartX + (pos.x - this._panStartX);
      this._camY = this._camStartY + (pos.y - this._panStartY);
      this._camTargetX = this._camX;
      this._camTargetY = this._camY;
      this._camAnimating = false;
      return;
    }

    if (this._dragNode) {
      const pos = this._canvasMousePos(e);
      const world = this._screenToWorld(pos.x, pos.y);
      this._dragNode.x = world.x - this._dragOffsetX;
      this._dragNode.y = world.y - this._dragOffsetY;
      this._dragNode.vx = 0;
      this._dragNode.vy = 0;
      this._forceSettled = false;
      return;
    }

    // Update cursor on hover
    if (this.canvas) {
      const pos = this._canvasMousePos(e);
      const hover = this._nodeAtPoint(pos.x, pos.y);
      this.canvas.style.cursor = hover ? 'grab' : 'default';
    }
  },

  _handleMouseUp() {
    if (this._isPanning) {
      this._isPanning = false;
      if (this.canvas) this.canvas.style.cursor = 'default';
      return;
    }
    if (this._dragNode) {
      // Lock the node where the user dropped it by updating its target
      this._dragNode.targetX = this._dragNode.x;
      this._dragNode.targetY = this._dragNode.y;
      this._dragNode = null;
      if (this.canvas) this.canvas.style.cursor = 'default';
    }
  },

  _handleWheel(e) {
    e.preventDefault();
    const pos = this._canvasMousePos(e);

    // World point under cursor before zoom
    const worldBefore = this._screenToWorld(pos.x, pos.y);

    // Adjust scale
    const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
    let newScale = this._camScale * zoomFactor;
    newScale = Math.max(this._camMinScale, Math.min(this._camMaxScale, newScale));
    this._camScale = newScale;

    // Adjust translation so the world point stays under the cursor
    this._camX = pos.x - worldBefore.x * this._camScale;
    this._camY = pos.y - worldBefore.y * this._camScale;
    this._camTargetX = this._camX;
    this._camTargetY = this._camY;
    this._camTargetScale = this._camScale;
    this._camAnimating = false;

    if (!this.animFrame) this._scheduleFrame();
  },

  _handleDblClick() {
    // Reset view to auto-fit
    this._autoFit();
  },

  _handleGestureChange(e) {
    e.preventDefault();
    const pos = this._canvasMousePos(e);
    const worldBefore = this._screenToWorld(pos.x, pos.y);

    let newScale = this._camScale * e.scale;
    newScale = Math.max(this._camMinScale, Math.min(this._camMaxScale, newScale));
    this._camScale = newScale;

    this._camX = pos.x - worldBefore.x * this._camScale;
    this._camY = pos.y - worldBefore.y * this._camScale;
    this._camTargetX = this._camX;
    this._camTargetY = this._camY;
    this._camTargetScale = this._camScale;
    this._camAnimating = false;

    if (!this.animFrame) this._scheduleFrame();
  },
});
