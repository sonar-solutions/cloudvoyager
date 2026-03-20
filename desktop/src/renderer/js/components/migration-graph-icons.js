/**
 * MigrationGraph — Icon rendering module.
 * Draws Canvas 2D icon paths for each node type.
 */
Object.assign(window.MigrationGraph, {
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

      case 'analysis': // Chart/graph
        ctx.strokeRect(cx - s * 0.5, cy - s * 0.5, s * 1.0, s * 1.0);
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.3, cy + s * 0.2);
        ctx.lineTo(cx - s * 0.1, cy - s * 0.1);
        ctx.lineTo(cx + s * 0.1, cy + s * 0.1);
        ctx.lineTo(cx + s * 0.3, cy - s * 0.3);
        ctx.stroke();
        break;

      // === Verify mode icons ===
      case 'vConnect': // Same as connect
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

      case 'vFetchProjects': // List with arrow
        ctx.strokeRect(cx - s * 0.45, cy - s * 0.5, s * 0.9, s * 1.0);
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.2, cy - s * 0.2);
        ctx.lineTo(cx + s * 0.2, cy - s * 0.2);
        ctx.moveTo(cx - s * 0.2, cy + s * 0.05);
        ctx.lineTo(cx + s * 0.2, cy + s * 0.05);
        ctx.stroke();
        break;

      case 'vBuildMappings': // Map/arrows
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.4, cy - s * 0.2);
        ctx.lineTo(cx + s * 0.4, cy - s * 0.2);
        ctx.lineTo(cx + s * 0.2, cy - s * 0.4);
        ctx.moveTo(cx + s * 0.4, cy + s * 0.2);
        ctx.lineTo(cx - s * 0.4, cy + s * 0.2);
        ctx.lineTo(cx - s * 0.2, cy + s * 0.4);
        ctx.stroke();
        break;

      case 'vQualityGates': // Same as qualityGates
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

      case 'vQualityProfiles': // Same as qualityProfiles
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

      case 'vGroups': // Same as groups
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

      case 'vPermissions': // Same as permissions
        ctx.beginPath();
        ctx.arc(cx, cy - s * 0.2, s * 0.35, Math.PI, 0);
        ctx.stroke();
        ctx.strokeRect(cx - s * 0.45, cy, s * 0.9, s * 0.65);
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.25, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'vProjects': // Same as projects
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

      case 'vBranches': // Git branch icon
        ctx.beginPath();
        ctx.arc(cx - s * 0.2, cy - s * 0.4, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + s * 0.2, cy - s * 0.1, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - s * 0.2, cy + s * 0.4, s * 0.15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.2, cy - s * 0.25);
        ctx.lineTo(cx - s * 0.2, cy + s * 0.25);
        ctx.moveTo(cx - s * 0.2, cy);
        ctx.quadraticCurveTo(cx, cy, cx + s * 0.2, cy - s * 0.1 + s * 0.15);
        ctx.stroke();
        break;

      case 'vIssues': // Bug icon
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.5, cy - s * 0.3);
        ctx.lineTo(cx - s * 0.25, cy - s * 0.15);
        ctx.moveTo(cx + s * 0.5, cy - s * 0.3);
        ctx.lineTo(cx + s * 0.25, cy - s * 0.15);
        ctx.moveTo(cx - s * 0.5, cy + s * 0.3);
        ctx.lineTo(cx - s * 0.25, cy + s * 0.15);
        ctx.moveTo(cx + s * 0.5, cy + s * 0.3);
        ctx.lineTo(cx + s * 0.25, cy + s * 0.15);
        ctx.stroke();
        break;

      case 'vHotspots': // Flame
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.5);
        ctx.quadraticCurveTo(cx - s * 0.4, cy + s * 0.1, cx - s * 0.3, cy - s * 0.2);
        ctx.quadraticCurveTo(cx - s * 0.2, cy, cx, cy - s * 0.1);
        ctx.quadraticCurveTo(cx - s * 0.05, cy - s * 0.5, cx, cy - s * 0.7);
        ctx.quadraticCurveTo(cx + s * 0.15, cy - s * 0.3, cx + s * 0.15, cy - s * 0.1);
        ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 0.2, cx + s * 0.3, cy + s * 0.1);
        ctx.quadraticCurveTo(cx + s * 0.4, cy + s * 0.3, cx, cy + s * 0.5);
        ctx.stroke();
        break;

      case 'vMeasures': // Bar chart
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.5, cy + s * 0.5);
        ctx.lineTo(cx + s * 0.5, cy + s * 0.5);
        ctx.stroke();
        ctx.fillRect(cx - s * 0.35, cy + s * 0.1, s * 0.2, s * 0.4);
        ctx.fillRect(cx - s * 0.1, cy - s * 0.3, s * 0.2, s * 0.8);
        ctx.fillRect(cx + s * 0.15, cy - s * 0.1, s * 0.2, s * 0.6);
        break;

      case 'vPortfolios': // Same as portfolios
        ctx.strokeRect(cx - s * 0.55, cy - s * 0.4, s * 1.1, s * 0.8);
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.4);
        ctx.lineTo(cx, cy + s * 0.4);
        ctx.moveTo(cx - s * 0.55, cy);
        ctx.lineTo(cx + s * 0.55, cy);
        ctx.stroke();
        break;

      // === Sync-metadata icons ===
      case 'issueSync': // Refresh/sync arrows
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.4, -Math.PI * 0.8, Math.PI * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + s * 0.35, cy + s * 0.2);
        ctx.lineTo(cx + s * 0.15, cy + s * 0.35);
        ctx.lineTo(cx + s * 0.4, cy + s * 0.45);
        ctx.stroke();
        break;

      case 'hotspotSync': // Flame + sync
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.4);
        ctx.quadraticCurveTo(cx - s * 0.3, cy, cx - s * 0.2, cy - s * 0.2);
        ctx.quadraticCurveTo(cx, cy - s * 0.5, cx, cy - s * 0.6);
        ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.2, cx + s * 0.2, cy);
        ctx.quadraticCurveTo(cx + s * 0.3, cy + s * 0.2, cx, cy + s * 0.4);
        ctx.stroke();
        break;

      default:
        // Fallback: simple circle
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
  },
});
