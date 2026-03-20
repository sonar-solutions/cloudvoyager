/**
 * MigrationGraph — Rendering module.
 * Handles force simulation, animation loop, and all drawing
 * (grid, edges, particles, nodes, pulse rings).
 */
Object.assign(window.MigrationGraph, {

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

      // Repulsion: only between org-level nodes (performance optimization)
      if (!node.isProjectNode) {
        this.nodes.forEach(other => {
          if (other === node || other.isProjectNode) return;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distSq = dx * dx + dy * dy;
          const minDist = 400;
          const d = Math.max(distSq, minDist);
          const force = repulsion / d;
          const dist = Math.sqrt(d);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });
      }

      node.vx = (node.vx + fx) * damping;
      node.vy = (node.vy + fy) * damping;
    });

    // Update positions (no canvas clamping — camera handles visibility)
    this.nodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;
      maxMove = Math.max(maxMove, Math.abs(node.vx), Math.abs(node.vy));
    });

    // Never settle while dragging; otherwise settle when movement is negligible
    this._forceSettled = !this._dragNode && !this._isPanning && maxMove < 0.05;
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

    // Animate camera
    if (this._camAnimating) {
      this._animateCamera();
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    // Grid drawn in screen space (fixed background)
    this._drawGrid(ctx, cw, ch);

    // Apply camera transform for all graph elements
    ctx.save();
    ctx.setTransform(
      dpr * this._camScale, 0, 0,
      dpr * this._camScale,
      dpr * this._camX,
      dpr * this._camY
    );

    this._drawEdges(ctx);
    this._drawParticles(ctx);
    this._drawNodes(ctx, timestamp);
    this._drawPulseRings(ctx, timestamp);

    ctx.restore();
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

  _edgePoints(src, tgt, edgeType) {
    const hw = (n) => n.width / 2;
    const hh = (n) => n.height / 2;

    // Fan-out and internal edges use straight lines
    if (edgeType === 'fanout' || edgeType === 'internal') {
      const x1 = src.x + hw(src);
      const y1 = src.y;
      const x2 = tgt.x - hw(tgt);
      const y2 = tgt.y;
      // Use straight line (degenerate bezier)
      const midX = (x1 + x2) / 2;
      return {
        x1, y1, x2, y2,
        cp1x: midX, cp1y: y1,
        cp2x: midX, cp2y: y2,
      };
    }

    const pad = 12; // clearance around nodes

    if (src.col === tgt.col) {
      // Vertical edge: exit bottom of src -> enter top of tgt
      const x1 = src.x, y1 = src.y + hh(src);
      const x2 = tgt.x, y2 = tgt.y - hh(tgt);
      const gap = y2 - y1;
      return {
        x1, y1, x2, y2,
        cp1x: x1, cp1y: y1 + gap * 0.4,
        cp2x: x2, cp2y: y2 - gap * 0.4,
      };
    }

    // Cross-column: exit right of src -> enter left of tgt
    const x1 = src.x + hw(src);
    const y1 = src.y;
    const x2 = tgt.x - hw(tgt);
    const y2 = tgt.y;
    const dx = x2 - x1;

    // Collect intermediate nodes (not src/tgt) whose bounding box
    // is between x1 and x2 — candidates for edge collision.
    // Only check org-level nodes for obstacle avoidance
    const obstacles = this.nodes.filter(n => {
      if (n.id === src.id || n.id === tgt.id || n.isProjectNode) return false;
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

    const midX = (x1 + x2) / 2;
    let worstObs = obstacles[0];
    let worstDist = Infinity;
    for (const obs of obstacles) {
      const d = Math.abs(obs.x - midX);
      if (d < worstDist) { worstDist = d; worstObs = obs; }
    }

    const aboveY = worstObs.y - hh(worstObs) - pad - 8;
    const belowY = worstObs.y + hh(worstObs) + pad + 8;
    const midY = (y1 + y2) / 2;
    const routeY = Math.abs(aboveY - midY) < Math.abs(belowY - midY) ? aboveY : belowY;

    const frac = 0.2;
    const altCp1x = x1 + dx * frac;
    const altCp1y = routeY;
    const altCp2x = x2 - dx * frac;
    const altCp2y = routeY;

    if (curveClearsNodes(altCp1x, altCp1y, altCp2x, altCp2y)) {
      return { x1, y1, x2, y2, cp1x: altCp1x, cp1y: altCp1y, cp2x: altCp2x, cp2y: altCp2y };
    }

    const aggCp1x = x1 + dx * 0.1;
    const aggCp2x = x2 - dx * 0.1;
    return { x1, y1, x2, y2, cp1x: aggCp1x, cp1y: routeY, cp2x: aggCp2x, cp2y: routeY };
  },

  _drawEdges(ctx) {
    this.edges.forEach(edge => {
      const src = this._nodeById(edge.from);
      const tgt = this._nodeById(edge.to);
      if (!src || !tgt) return;

      const pts = this._edgePoints(src, tgt, edge.type);

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

      // Dim edges for completed project branches
      if (edge.type === 'internal' && src.isProjectNode && src.state === 'done' && tgt.state === 'done') {
        alpha *= 0.5;
      }

      ctx.save();
      ctx.lineWidth = edge.type === 'internal' ? 1.5 : 2;
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

      // Spawn/maintain particles for done edges (only org + fanout edges, skip internal)
      if (src.state === 'done' && edge.type !== 'internal') {
        this._ensureEdgeParticles(edge);
      }
    });
  },

  // ── Edge Particles ──────────────────────────────────────────────

  _ensureEdgeParticles(edge) {
    const key = edge.from + '->' + edge.to;
    const existing = this.particles.filter(p => p.key === key);
    const maxParticles = edge.type === 'fanout' ? 1 : 2;
    if (existing.length >= maxParticles) return;

    for (let i = existing.length; i < maxParticles; i++) {
      this.particles.push({ key, from: edge.from, to: edge.to, t: i * (1 / maxParticles), edgeType: edge.type });
    }
  },

  _drawParticles(ctx) {
    ctx.save();
    this.particles.forEach(p => {
      p.t += 0.004;
      if (p.t >= 1.0) p.t -= 1.0;

      const src = this._nodeById(p.from);
      const tgt = this._nodeById(p.to);
      if (!src || !tgt) return;
      const pts = this._edgePoints(src, tgt, p.edgeType);

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

      // Dim completed project branches
      let nodeAlpha = 1.0;
      if (node.isProjectNode && node.state === 'done') {
        const ids = this._projectNodeIdsForNode(node.id);
        if (ids && this._allProjectNodesDone(ids)) {
          nodeAlpha = 0.5;
        }
      }

      const nx = node.x - node.width / 2;
      const ny = node.y - node.height / 2;

      ctx.save();
      ctx.globalAlpha = nodeAlpha;

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
      this.roundedRect(ctx, nx, ny, node.width, node.height, node.isProjectNode ? 4 : 6);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.15)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
      ctx.lineWidth = node.isProjectNode ? 1 : 1.5;
      ctx.stroke();

      // Active outer glow ring
      if (node.state === 'active') {
        const osc = Math.sin(timestamp * 0.003) * 0.15 + 0.25;
        ctx.save();
        ctx.shadowBlur = 0;
        this.roundedRect(ctx, nx - 3, ny - 3, node.width + 6, node.height + 6, node.isProjectNode ? 7 : 9);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${osc})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // Icon + Label
      ctx.shadowBlur = 0;

      if (node.isProjectNode) {
        // Per-project nodes: colored dot + label, smaller font
        const dotRadius = 3;
        const dotX = nx + 10;
        const dotY = node.y;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
        ctx.fill();

        ctx.font = `9px ${this._font}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.themeColors.text || '#e6edf3';
        ctx.fillText(node.label, nx + 19, node.y);
      } else {
        // Org-level nodes: icon + text
        const iconSize = 11;
        const iconColor = `rgba(${r}, ${g}, ${b}, 0.85)`;
        const iconX = nx + 13;
        const textX = nx + 28;

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
});
