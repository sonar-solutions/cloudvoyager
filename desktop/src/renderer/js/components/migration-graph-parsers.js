/**
 * MigrationGraph — Log parser module.
 * State machine that parses CLI log lines and updates node states
 * for migrate, transfer, sync-metadata, and verify modes.
 */
Object.assign(window.MigrationGraph, {

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

    // Check for [projectKey] prefixed lines first
    const keyMatch = line.match(/\[([^\]]+)\]\s+(.*)/);
    if (keyMatch) {
      const [, pKey, rest] = keyMatch;
      if (this._projectNodes.has(pKey)) {
        this._parseProjectSubPhase(pKey, rest);
        return;
      }
    }

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

    // Projects — dynamic branch creation
    m = line.match(/--- Project (\d+)\/(\d+): (\S+)/);
    if (m) {
      const [, idx, total, projectKey] = m;
      this._setNodeCount('projects', idx + '/' + total);

      // First time: activate projects node
      const projectsNode = this._nodeById('projects');
      if (projectsNode && projectsNode.state === 'pending') {
        this.setNodeState('permTemplates', 'done');
        this.setNodeState('permissions', 'done');
        this.setNodeState('projects', 'active');
      }

      // Add project branch if new
      if (!this._projectNodes.has(projectKey)) {
        this._addProjectBranch(projectKey, this._projectKeys.length, parseInt(total));
        this._computeProjectPositions();
        this._autoFit();
      }
      this._currentProjectKey = projectKey; // fallback for non-prefixed lines

      // Check if this is an "already completed, skipping" line
      if (/already completed, skipping/.test(line)) {
        const ids = this._projectNodes.get(projectKey);
        if (ids) {
          this._setProjectNodeStateDirect(ids.upload, 'done');
          this._setProjectNodeStateDirect(ids.config, 'done');
          this._setProjectNodeStateDirect(ids.issues, 'done');
          this._setProjectNodeStateDirect(ids.hotspots, 'done');
        }
      }
      return;
    }

    // Fallback: attribute non-prefixed sub-phase lines to _currentProjectKey
    if (this._currentProjectKey && this._projectNodes.has(this._currentProjectKey)) {
      if (this._tryParseProjectSubPhase(this._currentProjectKey, line)) {
        return;
      }
    }

    // Portfolios — activate on portfolio creation log line
    if (/Creating portfolios via Enterprise/.test(line)) {
      this.setNodeState('projects', 'done');
      this.setNodeState('portfolios', 'active');
      return;
    }
    m = line.match(/Enterprise portfolios: (\d+) created/);
    if (m) {
      this._setNodeCount('portfolios', m[1]);
      this.setNodeState('portfolios', 'done');
      return;
    }

    // Complete — finalize all nodes
    if (/Migration complete|=== Migration completed/.test(line)) {
      this._markAllProjectNodesDone();
      this.setNodeState('projects', 'done');
      this.setNodeState('portfolios', 'done');
      return;
    }
  },

  _parseProjectSubPhase(pKey, line) {
    const ids = this._projectNodes.get(pKey);
    if (!ids) return;

    // Scanner upload
    if (/Starting scanner report upload|Starting data extraction|Starting transfer|Starting checkpoint/.test(line)) {
      this.setNodeState(ids.upload, 'active');
      return;
    }
    if (/Scanner report upload complete|Transfer completed|Scanner report upload — already completed/.test(line)) {
      this.setNodeState(ids.upload, 'done');
      return;
    }

    // Project config
    if (/Configuring project|Project settings|Project tags|Project links|New code definitions|DevOps binding|Assign quality gate|Assign quality profiles|Project permissions/.test(line)) {
      this.setNodeState(ids.upload, 'done'); // ensure upload is done
      this.setNodeState(ids.config, 'active');
      return;
    }
    if (/Project configuration complete/.test(line)) {
      this.setNodeState(ids.config, 'done');
      return;
    }

    // Issue sync
    if (/Syncing issue metadata/.test(line)) {
      this.setNodeState(ids.config, 'done'); // ensure config is done
      this.setNodeState(ids.issues, 'active');
      return;
    }
    if (/Issue sync:.*matched|Issue sync — already completed/.test(line)) {
      this.setNodeState(ids.issues, 'done');
      return;
    }

    // Hotspot sync
    if (/Syncing hotspot metadata/.test(line)) {
      this.setNodeState(ids.config, 'done'); // ensure config is done
      this.setNodeState(ids.hotspots, 'active');
      return;
    }
    if (/Hotspot sync:.*matched|Hotspot sync — already completed/.test(line)) {
      this.setNodeState(ids.hotspots, 'done');
      return;
    }

    // Project migration complete
    if (/Project migration complete/.test(line)) {
      this.setNodeState(ids.upload, 'done');
      this.setNodeState(ids.config, 'done');
      this.setNodeState(ids.issues, 'done');
      this.setNodeState(ids.hotspots, 'done');
      return;
    }
  },

  // Fallback parser for non-prefixed lines (backward compat, concurrency=1)
  _tryParseProjectSubPhase(pKey, line) {
    const ids = this._projectNodes.get(pKey);
    if (!ids) return false;

    if (/Starting data extraction|Starting transfer for project|Starting checkpoint|Uploading to SonarCloud|Submitting to SonarCloud/.test(line)) {
      this.setNodeState(ids.upload, 'active');
      return true;
    }
    if (/Transfer completed for project|Report uploaded successfully|Report submitted to Compute Engine/.test(line)) {
      this.setNodeState(ids.upload, 'done');
      return true;
    }
    if (!/^Extracting /.test(line) && /Migrating.*project settings|Setting quality gate|Setting quality profiles|Setting permissions for|Project settings|Project tags|Project links|New code definitions|DevOps binding|Assign quality gate|Assign quality profiles|Project permissions/.test(line)) {
      this.setNodeState(ids.config, 'active');
      return true;
    }
    if (/Syncing issue metadata/.test(line)) {
      this.setNodeState(ids.issues, 'active');
      return true;
    }
    if (/Issue sync:.*matched.*transitioned|Issue metadata sync complete/.test(line)) {
      this.setNodeState(ids.issues, 'done');
      return true;
    }
    if (/Syncing hotspot metadata/.test(line)) {
      this.setNodeState(ids.hotspots, 'active');
      return true;
    }
    if (/Hotspot sync:.*matched.*status changed|Hotspot metadata sync complete/.test(line)) {
      this.setNodeState(ids.hotspots, 'done');
      return true;
    }
    if (/Project migration complete|Finished migrating project/.test(line)) {
      this.setNodeState(ids.upload, 'done');
      this.setNodeState(ids.config, 'done');
      this.setNodeState(ids.issues, 'done');
      this.setNodeState(ids.hotspots, 'done');
      return true;
    }
    return false;
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

    // Check for [projectKey] prefixed lines
    const keyMatch = line.match(/\[([^\]]+)\]\s+(.*)/);
    if (keyMatch) {
      const [, pKey, rest] = keyMatch;
      if (this._projectNodes.has(pKey)) {
        this._parseSyncMetadataProjectSubPhase(pKey, rest);
        return;
      }
    }

    m = line.match(/--- Project (\d+)\/(\d+): (\S+)/);
    if (m) {
      const [, idx, total, projectKey] = m;
      this._setNodeCount('projects', m[1] + '/' + m[2]);
      this.setNodeState('projects', 'active');

      if (!this._projectNodes.has(projectKey)) {
        this._addSyncMetadataProjectBranch(projectKey, this._projectKeys.length, parseInt(total));
        this._computeSyncMetadataProjectPositions();
        this._autoFit();
      }
      this._currentProjectKey = projectKey;

      if (/already completed, skipping/.test(line)) {
        const ids = this._projectNodes.get(projectKey);
        if (ids) {
          this._setProjectNodeStateDirect(ids.issues, 'done');
          this._setProjectNodeStateDirect(ids.hotspots, 'done');
        }
      }
      return;
    }

    // Fallback for non-prefixed sync-metadata lines
    if (this._currentProjectKey && this._projectNodes.has(this._currentProjectKey)) {
      const ids = this._projectNodes.get(this._currentProjectKey);
      if (ids) {
        if (/Syncing issue metadata/.test(line)) {
          this.setNodeState(ids.issues, 'active');
          return;
        }
        if (/Issue sync:.*matched.*transitioned|Issue metadata sync complete/.test(line)) {
          this.setNodeState(ids.issues, 'done');
          return;
        }
        if (/Syncing hotspot metadata/.test(line)) {
          this.setNodeState(ids.hotspots, 'active');
          return;
        }
        if (/Hotspot sync:.*matched.*status changed|Hotspot metadata sync complete/.test(line)) {
          this.setNodeState(ids.hotspots, 'done');
          return;
        }
      }
    }

    if (/Migration complete|=== Migration completed|Metadata sync complete/.test(line)) {
      this._markAllProjectNodesDone();
      this.setNodeState('projects', 'done');
      return;
    }
  },

  _parseSyncMetadataProjectSubPhase(pKey, line) {
    const ids = this._projectNodes.get(pKey);
    if (!ids) return;

    if (/Syncing issue metadata/.test(line)) {
      this.setNodeState(ids.issues, 'active');
      return;
    }
    if (/Issue sync:.*matched|Issue sync — already completed/.test(line)) {
      this.setNodeState(ids.issues, 'done');
      return;
    }
    if (/Syncing hotspot metadata/.test(line)) {
      this.setNodeState(ids.hotspots, 'active');
      return;
    }
    if (/Hotspot sync:.*matched|Hotspot sync — already completed/.test(line)) {
      this.setNodeState(ids.hotspots, 'done');
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
        this.setNodeState('vQualityGates', 'done');
        this.setNodeState('vQualityProfiles', 'done');
        this.setNodeState('vGroups', 'done');
        this.setNodeState('vPermissions', 'done');
        this.setNodeState('vProjects', 'active');
      }
      if (node && node.state === 'active') {
        node.count = m[1] + '/' + m[2];
      }
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

    // Overall completion
    if (/Verification complete|Verification Summary|all checks passed/.test(line)) {
      this.nodes.forEach(n => this.setNodeState(n.id, 'done'));
      return;
    }
  },

  _resetVerifySubNodes() {
    const subIds = ['vBranches', 'vIssues', 'vHotspots', 'vMeasures'];
    subIds.forEach(id => {
      const node = this._nodeById(id);
      if (node) {
        node.state = 'pending';
        node.progress = 0;
      }
    });
    this.particles = this.particles.filter(p => {
      return !subIds.some(id => p.key.includes(id));
    });
  },
});
