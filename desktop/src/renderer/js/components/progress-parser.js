/**
 * Progress parser — parses CLI log lines to determine migration/transfer/verify progress.
 * Used by ExecutionScreen to track progress percentage and ETA.
 */
window.ProgressParser = {
  currentProgress: 0,
  pipelineState: null,
  progressHistory: null,
  currentPhaseLabel: '',

  /** Initialize state for a new run. */
  init() {
    this.currentProgress = 0;
    this.pipelineState = { totalProjects: 0, currentProject: 0, phase: 'init', subPercent: 0 };
    this.progressHistory = [];
    this.currentPhaseLabel = '';
  },

  /** Parse a log line and update progress. Calls onProgress(pct) and onPhase(label) callbacks. */
  parseProgress(line, command, onProgress, onPhase) {
    const cmd = (command || '').toLowerCase();
    const s = this.pipelineState;

    if (cmd === 'migrate' || cmd === 'sync-metadata') {
      this._parseMigrateProgress(line, s, onProgress, onPhase);
    } else if (cmd === 'transfer') {
      this._parseTransferProgress(line, s, onProgress, onPhase);
    } else if (cmd === 'verify') {
      this._parseVerifyProgress(line, s, onProgress, onPhase);
    }
  },

  /**
   * Only allow progress to move forward (never backwards).
   * Calls onProgress(pct) and onPhase(label) if provided.
   */
  setProgress(pct, onProgress) {
    const clamped = Math.min(98, Math.max(0, pct)); // reserve 100% for actual completion
    if (clamped > this.currentProgress) {
      this.currentProgress = clamped;

      if (onProgress) onProgress(clamped);

      // Track for ETA
      if (this.progressHistory) {
        this.progressHistory.push({ percent: clamped, time: Date.now() });
        if (this.progressHistory.length > 20) this.progressHistory.shift();
        this.updateETA(clamped);
      }
    }
  },

  setPhaseLabel(label, onPhase) {
    this.currentPhaseLabel = label;
    if (onPhase) onPhase(label);
  },

  updateETA(currentPercent) {
    const etaEl = document.getElementById('whale-eta');
    if (!etaEl || currentPercent < 5 || this.progressHistory.length < 3) {
      if (etaEl) etaEl.textContent = '';
      return;
    }

    const history = this.progressHistory;
    const recent = history.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const pctDiff = last.percent - first.percent;
    const timeDiff = last.time - first.time;

    if (pctDiff <= 0 || timeDiff <= 0) {
      etaEl.textContent = '';
      return;
    }

    const pctRemaining = 100 - currentPercent;
    const msPerPct = timeDiff / pctDiff;
    const msRemaining = pctRemaining * msPerPct;

    const minutes = Math.ceil(msRemaining / 60000);
    if (minutes <= 0) {
      etaEl.textContent = '';
    } else if (minutes < 60) {
      etaEl.textContent = ` ~${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      etaEl.textContent = ` ~${hours}h ${mins}m`;
    }
  },

  /**
   * Calculate overall progress for a project sub-phase.
   * Projects occupy 15-95% of the total bar, divided equally.
   */
  projectProgress(s, subPercent) {
    const projectSlice = 80 / s.totalProjects; // each project gets equal share of 80%
    const projectBase = 15 + (s.currentProject - 1) * projectSlice;
    return Math.round(projectBase + (subPercent / 100) * projectSlice);
  },

  formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },

  async recordHistory(commandLabel, startTime, runReportsDir) {
    try {
      const dir = runReportsDir
        || await window.cloudvoyager.config.loadKey('reportsDir')
        || await window.cloudvoyager.app.getDefaultReportsDir();

      await SidebarHistory.addEntry({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        command: commandLabel,
        timestamp: new Date(startTime).toISOString(),
        durationMs: Date.now() - startTime,
        reportsDir: dir
      });
    } catch (err) {
      // Don't block the UI if history save fails
    }
  },

  /**
   * Migrate pipeline progress layout (0-100%):
   *   0-10%  : Steps 1-3 (connect, extract server data, generate mappings)
   *  10-15%  : Org setup (groups, permissions, quality gates/profiles, templates)
   *  15-95%  : Per-project migration (divided equally among N projects)
   *  95-100% : Finalization (reports, portfolios)
   */
  _parseMigrateProgress(line, s, onProgress, onPhase) {
    // --- Setup phases (0-10%) ---
    if (line.includes('=== Step 1: Connecting')) {
      s.phase = 'setup';
      this.setProgress(1, onProgress);
      this.setPhaseLabel('Connecting...', onPhase);
      return;
    }
    if (line.includes('=== Step 2: Extracting server-wide data')) {
      s.phase = 'setup';
      this.setProgress(3, onProgress);
      this.setPhaseLabel('Extracting server data...', onPhase);
      return;
    }
    if (line.includes('=== Step 3: Generating organization mappings')) {
      s.phase = 'setup';
      this.setProgress(7, onProgress);
      this.setPhaseLabel('Generating mappings...', onPhase);
      return;
    }

    // --- Org setup (10-15%) ---
    if (line.includes('=== Step 4: Saving server info')) {
      s.phase = 'org-setup';
      this.setProgress(10, onProgress);
      this.setPhaseLabel('Setting up organization...', onPhase);
      return;
    }
    if (line.includes('=== Migrating to organization:')) {
      s.phase = 'org-setup';
      this.setProgress(11, onProgress);
      return;
    }
    if (line.includes('Creating groups')) { this.setProgress(11, onProgress); this.setPhaseLabel('Creating groups...', onPhase); return; }
    if (line.includes('Setting global permissions')) { this.setProgress(12, onProgress); return; }
    if (line.includes('Creating quality gates')) { this.setProgress(12, onProgress); this.setPhaseLabel('Creating quality gates...', onPhase); return; }
    if (line.includes('Restoring quality profiles')) { this.setProgress(13, onProgress); this.setPhaseLabel('Restoring quality profiles...', onPhase); return; }
    if (line.includes('Creating permission templates')) { this.setProgress(14, onProgress); this.setPhaseLabel('Creating permission templates...', onPhase); return; }

    // --- Project tracking (15-95%) ---
    const projectMatch = line.match(/--- Project (\d+)\/(\d+):/);
    if (projectMatch) {
      s.currentProject = parseInt(projectMatch[1], 10);
      s.totalProjects = parseInt(projectMatch[2], 10);
      s.phase = 'project-start';
      s.subPercent = 0;
      this.setProgress(this.projectProgress(s, 0), onProgress);
      this.setPhaseLabel('Migrating project ' + s.currentProject + '/' + s.totalProjects + '...', onPhase);
      return;
    }

    // Within a project — sub-phases
    if (s.totalProjects > 0 && s.currentProject > 0) {
      // Scanner report upload phase (0-30% of project slice)
      if (line.includes('Starting data extraction') || line.includes('Starting transfer for project') || line.includes('Starting checkpoint-aware')) {
        s.phase = 'scanner';
        s.subPercent = 5;
        this.setProgress(this.projectProgress(s, 5), onProgress);
        this.setPhaseLabel('Extracting project data...', onPhase);
        return;
      }
      if (line.includes('Building protobuf messages')) {
        s.subPercent = 15;
        this.setProgress(this.projectProgress(s, 15), onProgress);
        this.setPhaseLabel('Building report...', onPhase);
        return;
      }
      if (line.includes('Encoding to protobuf format')) {
        s.subPercent = 20;
        this.setProgress(this.projectProgress(s, 20), onProgress);
        return;
      }
      if (line.includes('Uploading to SonarCloud') || line.includes('Submitting to SonarCloud')) {
        s.subPercent = 25;
        this.setProgress(this.projectProgress(s, 25), onProgress);
        this.setPhaseLabel('Uploading to SonarCloud...', onPhase);
        return;
      }
      if (line.includes('Transfer completed for project') || line.includes('Scanner report upload for')) {
        s.subPercent = 30;
        this.setProgress(this.projectProgress(s, 30), onProgress);
        return;
      }

      // Issue sync phase (30-70% of project slice)
      if (line.includes('Syncing issue metadata')) {
        s.phase = 'issue-sync';
        s.subPercent = 30;
        this.setProgress(this.projectProgress(s, 30), onProgress);
        this.setPhaseLabel('Syncing issues...', onPhase);
        return;
      }
      const issueSyncMatch = line.match(/Issue sync: \d+\/\d+ \((\d+)%\)/);
      if (issueSyncMatch && s.phase === 'issue-sync') {
        const pct = parseInt(issueSyncMatch[1], 10);
        s.subPercent = 30 + Math.round(pct * 0.4); // 30-70%
        this.setProgress(this.projectProgress(s, s.subPercent), onProgress);
        return;
      }

      // Hotspot sync phase (70-90% of project slice)
      if (line.includes('Syncing hotspot metadata')) {
        s.phase = 'hotspot-sync';
        s.subPercent = 70;
        this.setProgress(this.projectProgress(s, 70), onProgress);
        this.setPhaseLabel('Syncing hotspots...', onPhase);
        return;
      }
      const hotspotSyncMatch = line.match(/Hotspot sync: \d+\/\d+ \((\d+)%\)/);
      if (hotspotSyncMatch && s.phase === 'hotspot-sync') {
        const pct = parseInt(hotspotSyncMatch[1], 10);
        s.subPercent = 70 + Math.round(pct * 0.2); // 70-90%
        this.setProgress(this.projectProgress(s, s.subPercent), onProgress);
        return;
      }

      // Project config phase (90-100% of project slice)
      if (line.includes('Migrating') && line.includes('project settings')) {
        s.subPercent = 90;
        this.setProgress(this.projectProgress(s, 90), onProgress);
        return;
      }
    }

    // --- Completion ---
    if (line.includes('=== Migration completed successfully ===')) {
      this.setProgress(98, onProgress);
      this.setPhaseLabel('Migration complete', onPhase);
      return;
    }
  },

  /**
   * Transfer pipeline progress layout (0-100%):
   *   0-5%   : Connection test + setup
   *   5-45%  : Data extraction (Steps 1-10)
   *  45-55%  : Preparing upload
   *  55-65%  : Encoding upload
   *  65-95%  : Upload + wait for analysis
   *  95-100% : Completion
   */
  _parseTransferProgress(line, s, onProgress, onPhase) {
    if (line.includes('Testing connections') || line.includes('Starting transfer for project')) {
      this.setProgress(2, onProgress);
      this.setPhaseLabel('Testing connections...', onPhase);
      return;
    }
    if (line.includes('Starting data extraction') || line.includes('Starting checkpoint-aware')) {
      this.setProgress(5, onProgress);
      this.setPhaseLabel('Extracting data...', onPhase);
      return;
    }
    // Extraction steps 1-10
    const stepMatch = line.match(/Step (\d+)(?:\/\d+|[ab]?):/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      this.setProgress(5 + Math.round((step / 10) * 40), onProgress);
      return;
    }
    if (line.includes('Data extraction completed')) {
      this.setProgress(45, onProgress);
      return;
    }
    if (line.includes('Building protobuf messages')) {
      this.setProgress(48, onProgress);
      this.setPhaseLabel('Preparing upload...', onPhase);
      return;
    }
    if (line.includes('Successfully built all protobuf messages')) {
      this.setProgress(55, onProgress);
      return;
    }
    if (line.includes('Encoding to protobuf format')) {
      this.setProgress(60, onProgress);
      this.setPhaseLabel('Encoding...', onPhase);
      return;
    }
    if (line.includes('Uploading to SonarCloud') || line.includes('Submitting to SonarCloud')) {
      this.setProgress(68, onProgress);
      this.setPhaseLabel('Uploading to SonarCloud...', onPhase);
      return;
    }
    if (line.includes('Report submitted to Compute Engine')) {
      this.setProgress(80, onProgress);
      this.setPhaseLabel('Waiting for analysis...', onPhase);
      return;
    }
    if (line.includes('Analysis completed successfully')) {
      this.setProgress(92, onProgress);
      this.setPhaseLabel('Analysis complete', onPhase);
      return;
    }
    // Non-main branches
    if (line.includes('Syncing') && line.includes('additional branch')) {
      this.setProgress(93, onProgress);
      this.setPhaseLabel('Syncing branches...', onPhase);
      return;
    }
    if (line.includes('=== Transfer completed successfully ===')) {
      this.setProgress(98, onProgress);
      this.setPhaseLabel('Transfer complete', onPhase);
      return;
    }
  },

  /**
   * Verify pipeline progress layout (0-100%):
   *   0-5%   : Connect (Step 1)
   *   5-10%  : Fetch projects (Step 2)
   *  10-15%  : Build mappings (Step 3) + org-wide checks
   *  15-93%  : Per-project verification (divided equally among N projects)
   *  93-98%  : Portfolios + summary
   */
  _parseVerifyProgress(line, s, onProgress, onPhase) {
    if (line.includes('=== Step 1:')) {
      this.setProgress(2, onProgress);
      this.setPhaseLabel('Connecting to SonarQube...', onPhase);
      return;
    }
    if (line.includes('=== Step 2:')) {
      this.setProgress(6, onProgress);
      this.setPhaseLabel('Fetching project list...', onPhase);
      return;
    }
    if (line.includes('=== Step 3:')) {
      this.setProgress(10, onProgress);
      this.setPhaseLabel('Building org mappings...', onPhase);
      return;
    }
    if (line.includes('Verifying quality gates')) {
      this.setProgress(11, onProgress);
      this.setPhaseLabel('Verifying quality gates...', onPhase);
      return;
    }
    if (line.includes('Verifying quality profiles')) {
      this.setProgress(12, onProgress);
      this.setPhaseLabel('Verifying quality profiles...', onPhase);
      return;
    }
    if (line.includes('Verifying groups')) {
      this.setProgress(13, onProgress);
      this.setPhaseLabel('Verifying groups...', onPhase);
      return;
    }
    if (line.includes('Verifying permission templates')) {
      this.setProgress(14, onProgress);
      this.setPhaseLabel('Verifying permissions...', onPhase);
      return;
    }

    const projectMatch = line.match(/--- Project (\d+)\/(\d+):/);
    if (projectMatch) {
      s.currentProject = parseInt(projectMatch[1], 10);
      s.totalProjects = parseInt(projectMatch[2], 10);
      const pct = 15 + Math.round(((s.currentProject - 1) / s.totalProjects) * 78);
      this.setProgress(pct, onProgress);
      this.setPhaseLabel('Verifying project ' + s.currentProject + '/' + s.totalProjects + '...', onPhase);
      return;
    }

    if (line.includes('Verifying portfolios')) {
      this.setProgress(94, onProgress);
      this.setPhaseLabel('Verifying portfolios...', onPhase);
      return;
    }
    if (line.includes('=== Verification Summary ===')) {
      this.setProgress(98, onProgress);
      this.setPhaseLabel('Verification complete', onPhase);
      return;
    }
  }
};
