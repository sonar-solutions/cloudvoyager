/**
 * Execution screen — shows live logs while a command runs.
 */
window.ExecutionScreen = {
  params: null,
  unsubLog: null,
  unsubExit: null,
  startTime: null,
  timerInterval: null,
  isRunning: false,
  currentProgress: 0,
  pipelineState: null,
  runReportsDir: null,

  async render(container, params) {
    this.params = params || {};
    this.startTime = Date.now();
    this.isRunning = true;
    this.currentProgress = 0;
    this.pipelineState = { totalProjects: 0, currentProject: 0, phase: 'init', subPercent: 0 };
    WizardNav.clear();

    const commandLabel = this.params.command || 'command';

    container.innerHTML = `
      <div class="execution-header">
        <div class="execution-info">
          <h2 style="font-size:18px">${ConfigForm.escapeHtml(commandLabel)}</h2>
          <span id="exec-status" class="badge badge-running">Running</span>
          <span id="exec-timer" class="execution-timer">00:00</span>
        </div>
        <div class="whale-progress" id="whale-progress">
          <div class="whale-track">
            <div class="whale-cloud whale-cloud-1"></div>
            <div class="whale-cloud whale-cloud-2"></div>
            <div class="whale-cloud whale-cloud-3"></div>
            <div class="whale-cloud whale-cloud-4"></div>
            <div class="whale-cloud whale-cloud-5"></div>
            <div class="whale-sprite" id="whale-sprite">
              <div class="whale-spout" id="whale-spout">
                <div class="spout-drop spout-drop-1"></div>
                <div class="spout-drop spout-drop-2"></div>
                <div class="spout-drop spout-drop-3"></div>
              </div>
              <canvas id="whale-canvas" width="24" height="12"></canvas>
            </div>
            <div class="whale-trail" id="whale-trail"></div>
          </div>
          <div class="whale-percent" id="whale-percent">0%</div>
        </div>
        <div class="execution-controls">
          <button class="btn btn-danger btn-sm" id="btn-cancel">Cancel</button>
        </div>
      </div>
      <div id="exec-log"></div>
      <div class="button-row right" style="margin-top:16px">
        <button class="btn btn-secondary" id="btn-home" disabled>Back to Home</button>
        <button class="btn btn-primary" id="btn-results" style="display:none">View Reports</button>
      </div>
    `;

    // Setup log viewer
    const logContainer = container.querySelector('#exec-log');
    LogViewer.create(logContainer);

    // Draw pixel whale sprite
    this.drawWhale();

    // Timer
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      container.querySelector('#exec-timer').textContent = this.formatDuration(elapsed);
    }, 1000);

    // Subscribe to log events
    this.unsubLog = window.cloudvoyager.cli.onLog((data) => {
      LogViewer.addLine(data);
      this.parseProgress(data.line);
    });

    // Subscribe to exit
    this.unsubExit = window.cloudvoyager.cli.onExit((data) => {
      this.isRunning = false;
      clearInterval(this.timerInterval);

      const statusEl = container.querySelector('#exec-status');
      const cancelBtn = container.querySelector('#btn-cancel');
      const homeBtn = container.querySelector('#btn-home');
      const resultsBtn = container.querySelector('#btn-results');

      cancelBtn.disabled = true;
      homeBtn.disabled = false;

      if (data.code === 0) {
        statusEl.className = 'badge badge-completed';
        statusEl.textContent = 'Completed';
        resultsBtn.style.display = '';
        this.updateWhale(100);
        App.showToast(`${commandLabel} completed successfully`, 'success');

        // Record successful run in history
        this.recordHistory(commandLabel);
      } else if (data.signal) {
        statusEl.className = 'badge badge-cancelled';
        statusEl.textContent = 'Cancelled';
        App.showToast(`${commandLabel} was cancelled`, 'warning');
      } else {
        statusEl.className = 'badge badge-failed';
        statusEl.textContent = `Failed (exit ${data.code})`;
        App.showToast(`${commandLabel} failed with exit code ${data.code}`, 'error');
      }
    });

    // Cancel button
    container.querySelector('#btn-cancel').addEventListener('click', async () => {
      if (this.isRunning) {
        await window.cloudvoyager.cli.cancel();
      }
    });

    // Home button
    container.querySelector('#btn-home').addEventListener('click', () => {
      this.cleanup();
      App.navigate('welcome');
    });

    // Results button — pass the run-specific reports directory
    container.querySelector('#btn-results').addEventListener('click', () => {
      this.cleanup();
      App.navigate('results', { reportsDir: this.runReportsDir });
    });

    // Start the command
    try {
      const args = this.params.args || [];
      const result = await window.cloudvoyager.cli.run(this.params.command, args);
      this.runReportsDir = result?.reportsDir || null;
    } catch (err) {
      this.isRunning = false;
      clearInterval(this.timerInterval);
      container.querySelector('#exec-status').className = 'badge badge-failed';
      container.querySelector('#exec-status').textContent = 'Error';
      container.querySelector('#btn-cancel').disabled = true;
      container.querySelector('#btn-home').disabled = false;
      LogViewer.addLine({ stream: 'stderr', line: `Failed to start: ${err.message}`, timestamp: Date.now() });
    }
  },

  cleanup() {
    if (this.unsubLog) { this.unsubLog(); this.unsubLog = null; }
    if (this.unsubExit) { this.unsubExit(); this.unsubExit = null; }
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  },

  async recordHistory(commandLabel) {
    try {
      // Use the run-specific directory returned by cli:run so each history
      // entry points to its own timestamped reports folder.
      const dir = this.runReportsDir
        || await window.cloudvoyager.config.loadKey('reportsDir')
        || await window.cloudvoyager.app.getDefaultReportsDir();

      await SidebarHistory.addEntry({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        command: commandLabel,
        timestamp: new Date(this.startTime).toISOString(),
        durationMs: Date.now() - this.startTime,
        reportsDir: dir
      });
    } catch (err) {
      // Don't block the UI if history save fails
    }
  },

  drawWhale() {
    const canvas = document.getElementById('whale-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Color palette
    const C = {
      D: '#2a4a7f', // dark outline
      B: '#4a7dca', // body dark (back)
      M: '#6ba3f7', // body medium (sides)
      L: '#8ec2ff', // body highlight
      W: '#d0e4ff', // belly (light)
      E: '#ffffff', // eye highlight
      T: '#4a7dca', // tail dark
      t: '#5b8dd9', // tail light
    };
    // 24×12 pixel grid — side-view whale facing right
    // V-shaped forked tail, rounded body, white belly, white eye
    const grid = [
      '.........DDDDD..........',
      'tTD....DDBBBBBDDD.......',
      '.DtD..DBBMLMLMBBBD......',
      '..Dt.DBMMMMLMMMMMMD.....',
      '...DtBMMMMMMMEMMMMMD....',
      '...DtBMMMMMMMMMMMMMD....',
      '..Dt.DMMMMMMMMMMMMMD....',
      '.DtD..DMMWWWWMMMMD......',
      'DtD....DMWWWMMMMD.......',
      'DD......DMMMMMMD........',
      '.........DDDDDD.........',
      '...........DD...........',
    ];
    grid.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch !== '.' && C[ch]) {
          ctx.fillStyle = C[ch];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    });
  },

  parseProgress(line) {
    const cmd = (this.params.command || '').toLowerCase();
    const s = this.pipelineState;

    if (cmd === 'migrate' || cmd === 'sync-metadata') {
      this.parseMigrateProgress(line, s);
    } else if (cmd === 'transfer') {
      this.parseTransferProgress(line, s);
    } else if (cmd === 'verify') {
      this.parseVerifyProgress(line, s);
    }
  },

  /**
   * Migrate pipeline progress layout (0-100%):
   *   0-10%  : Steps 1-3 (connect, extract server data, generate mappings)
   *  10-15%  : Org setup (groups, permissions, quality gates/profiles, templates)
   *  15-95%  : Per-project migration (divided equally among N projects)
   *            Within each project's slice:
   *              0-30%  scanner report upload
   *             30-70%  issue metadata sync
   *             70-90%  hotspot metadata sync
   *             90-100% project config
   *  95-100% : Finalization (reports, portfolios)
   */
  parseMigrateProgress(line, s) {
    // --- Setup phases (0-10%) ---
    if (line.includes('=== Step 1: Connecting')) {
      s.phase = 'setup';
      this.setProgress(1);
      return;
    }
    if (line.includes('=== Step 2: Extracting server-wide data')) {
      s.phase = 'setup';
      this.setProgress(3);
      return;
    }
    if (line.includes('=== Step 3: Generating organization mappings')) {
      s.phase = 'setup';
      this.setProgress(7);
      return;
    }

    // --- Org setup (10-15%) ---
    if (line.includes('=== Step 4: Saving server info')) {
      s.phase = 'org-setup';
      this.setProgress(10);
      return;
    }
    if (line.includes('=== Migrating to organization:')) {
      s.phase = 'org-setup';
      this.setProgress(11);
      return;
    }
    if (line.includes('Creating groups')) { this.setProgress(11); return; }
    if (line.includes('Setting global permissions')) { this.setProgress(12); return; }
    if (line.includes('Creating quality gates')) { this.setProgress(12); return; }
    if (line.includes('Restoring quality profiles')) { this.setProgress(13); return; }
    if (line.includes('Creating permission templates')) { this.setProgress(14); return; }

    // --- Project tracking (15-95%) ---
    const projectMatch = line.match(/--- Project (\d+)\/(\d+):/);
    if (projectMatch) {
      s.currentProject = parseInt(projectMatch[1], 10);
      s.totalProjects = parseInt(projectMatch[2], 10);
      s.phase = 'project-start';
      s.subPercent = 0;
      // Start of this project's slice
      this.setProgress(this.projectProgress(s, 0));
      return;
    }

    // Within a project — sub-phases
    if (s.totalProjects > 0 && s.currentProject > 0) {
      // Scanner report upload phase (0-30% of project slice)
      if (line.includes('Starting data extraction') || line.includes('Starting transfer for project') || line.includes('Starting checkpoint-aware')) {
        s.phase = 'scanner';
        s.subPercent = 5;
        this.setProgress(this.projectProgress(s, 5));
        return;
      }
      if (line.includes('Building protobuf messages')) {
        s.subPercent = 15;
        this.setProgress(this.projectProgress(s, 15));
        return;
      }
      if (line.includes('Encoding to protobuf format')) {
        s.subPercent = 20;
        this.setProgress(this.projectProgress(s, 20));
        return;
      }
      if (line.includes('Uploading to SonarCloud') || line.includes('Submitting to SonarCloud')) {
        s.subPercent = 25;
        this.setProgress(this.projectProgress(s, 25));
        return;
      }
      if (line.includes('Transfer completed for project') || line.includes('Scanner report upload for')) {
        s.subPercent = 30;
        this.setProgress(this.projectProgress(s, 30));
        return;
      }

      // Issue sync phase (30-70% of project slice)
      if (line.includes('Syncing issue metadata')) {
        s.phase = 'issue-sync';
        s.subPercent = 30;
        this.setProgress(this.projectProgress(s, 30));
        return;
      }
      const issueSyncMatch = line.match(/Issue sync: \d+\/\d+ \((\d+)%\)/);
      if (issueSyncMatch && s.phase === 'issue-sync') {
        const pct = parseInt(issueSyncMatch[1], 10);
        s.subPercent = 30 + Math.round(pct * 0.4); // 30-70%
        this.setProgress(this.projectProgress(s, s.subPercent));
        return;
      }

      // Hotspot sync phase (70-90% of project slice)
      if (line.includes('Syncing hotspot metadata')) {
        s.phase = 'hotspot-sync';
        s.subPercent = 70;
        this.setProgress(this.projectProgress(s, 70));
        return;
      }
      const hotspotSyncMatch = line.match(/Hotspot sync: \d+\/\d+ \((\d+)%\)/);
      if (hotspotSyncMatch && s.phase === 'hotspot-sync') {
        const pct = parseInt(hotspotSyncMatch[1], 10);
        s.subPercent = 70 + Math.round(pct * 0.2); // 70-90%
        this.setProgress(this.projectProgress(s, s.subPercent));
        return;
      }

      // Project config phase (90-100% of project slice)
      if (line.includes('Migrating') && line.includes('project settings')) {
        s.subPercent = 90;
        this.setProgress(this.projectProgress(s, 90));
        return;
      }
    }

    // --- Completion ---
    if (line.includes('=== Migration completed successfully ===')) {
      this.setProgress(98);
      return;
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

  /**
   * Transfer pipeline progress layout (0-100%):
   *   0-5%   : Connection test + setup
   *   5-45%  : Data extraction (Steps 1-10)
   *  45-55%  : Build protobuf
   *  55-65%  : Encode protobuf
   *  65-95%  : Upload + wait for analysis
   *  95-100% : Completion
   */
  parseTransferProgress(line, s) {
    if (line.includes('Testing connections') || line.includes('Starting transfer for project')) {
      this.setProgress(2);
      return;
    }
    if (line.includes('Starting data extraction') || line.includes('Starting checkpoint-aware')) {
      this.setProgress(5);
      return;
    }
    // Extraction steps 1-10
    const stepMatch = line.match(/Step (\d+)(?:\/\d+|[ab]?):/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      // Steps 1-10 map to 5-45%
      this.setProgress(5 + Math.round((step / 10) * 40));
      return;
    }
    if (line.includes('Data extraction completed')) {
      this.setProgress(45);
      return;
    }
    if (line.includes('Building protobuf messages')) {
      this.setProgress(48);
      return;
    }
    if (line.includes('Successfully built all protobuf messages')) {
      this.setProgress(55);
      return;
    }
    if (line.includes('Encoding to protobuf format')) {
      this.setProgress(60);
      return;
    }
    if (line.includes('Uploading to SonarCloud') || line.includes('Submitting to SonarCloud')) {
      this.setProgress(68);
      return;
    }
    if (line.includes('Report submitted to Compute Engine')) {
      this.setProgress(80);
      return;
    }
    if (line.includes('Analysis completed successfully')) {
      this.setProgress(92);
      return;
    }
    // Non-main branches
    if (line.includes('Syncing') && line.includes('additional branch')) {
      this.setProgress(93);
      return;
    }
    if (line.includes('=== Transfer completed successfully ===')) {
      this.setProgress(98);
      return;
    }
  },

  /**
   * Verify pipeline: similar project-based structure.
   */
  parseVerifyProgress(line, s) {
    if (line.includes('=== Step 1:')) { this.setProgress(3); return; }
    if (line.includes('=== Step 2:')) { this.setProgress(8); return; }
    if (line.includes('=== Step 3:')) { this.setProgress(12); return; }

    const projectMatch = line.match(/--- Project (\d+)\/(\d+):/);
    if (projectMatch) {
      s.currentProject = parseInt(projectMatch[1], 10);
      s.totalProjects = parseInt(projectMatch[2], 10);
      const pct = 15 + Math.round(((s.currentProject - 1) / s.totalProjects) * 80);
      this.setProgress(pct);
      return;
    }
  },

  /**
   * Only allow progress to move forward (never backwards).
   */
  setProgress(pct) {
    const clamped = Math.min(98, Math.max(0, pct)); // reserve 100% for actual completion
    if (clamped > this.currentProgress) {
      this.currentProgress = clamped;
      this.updateWhale(clamped);
    }
  },

  updateWhale(percent) {
    const sprite = document.getElementById('whale-sprite');
    const trail = document.getElementById('whale-trail');
    const percentEl = document.getElementById('whale-percent');
    if (!sprite || !trail || !percentEl) return;

    const clamped = Math.min(100, Math.max(0, percent));
    // Whale moves from left (0%) to right (100%) of the track
    sprite.style.left = `calc(${clamped}% - 24px)`;
    trail.style.width = `${clamped}%`;
    percentEl.textContent = `${clamped}%`;

    // Add/remove completed class for trail glow effect
    if (clamped >= 100) {
      trail.classList.add('whale-trail-complete');
      sprite.classList.add('whale-arrived');
    }
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
  }
};
