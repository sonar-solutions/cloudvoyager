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
  whaleAnimInterval: null,
  whaleSpriteF1: null,
  whaleSpriteF2: null,
  typewriterInterval: null,
  starfieldTwinkleInterval: null,

  async render(container, params) {
    this.params = params || {};
    this.startTime = Date.now();
    this.isRunning = true;
    this.currentProgress = 0;
    this.pipelineState = { totalProjects: 0, currentProject: 0, phase: 'init', subPercent: 0 };
    this.progressHistory = [];
    this.currentPhaseLabel = '';
    WizardNav.clear();

    const commandLabel = this.params.command || 'command';

    container.innerHTML = `
      <div class="execution-header">
        <div class="execution-info">
          <h2 style="font-size:18px">${ConfigForm.escapeHtml(commandLabel)}</h2>
          <span id="exec-status" class="badge badge-running" role="status" aria-live="polite">Running</span>
          <span id="exec-timer" class="execution-timer">00:00</span>
        </div>
        <div class="execution-controls">
          <button class="btn btn-danger btn-sm" id="btn-cancel" aria-label="Cancel operation">Cancel</button>
        </div>
        <div class="whale-progress" id="whale-progress">
          <div class="whale-track">
            <div class="whale-trail" id="whale-trail"></div>
            <div class="whale-clouds" id="whale-clouds"></div>
            <div class="whale-sprite" id="whale-sprite"></div>
          </div>
          <div class="whale-percent" id="whale-percent" aria-live="polite">0%<span class="whale-eta" id="whale-eta" aria-live="polite"></span></div>
          <div class="whale-phase-label" id="whale-phase" aria-live="polite"></div>
        </div>
      </div>
      <div id="migration-graph-container" class="migration-graph-container"></div>
      <div id="exec-log"></div>
      <div class="button-row right" style="margin-top:16px">
        <button class="btn btn-secondary" id="btn-home" disabled>Back to Home</button>
        <button class="btn btn-primary" id="btn-results" style="display:none">View Reports</button>
        <button class="btn btn-secondary" id="btn-rerun" style="display:none">Run Again</button>
      </div>
    `;

    // Setup log viewer
    const logContainer = container.querySelector('#exec-log');
    LogViewer.create(logContainer);

    // Initialize migration graph if applicable
    const graphMode = (commandLabel === 'transfer') ? 'transfer'
      : (commandLabel === 'migrate') ? 'migrate'
      : (commandLabel === 'sync-metadata') ? 'sync-metadata'
      : null;
    if (graphMode && typeof MigrationGraph !== 'undefined') {
      const graphContainer = container.querySelector('#migration-graph-container');
      MigrationGraph.create(graphContainer, graphMode);
      logContainer.classList.add('log-container-with-graph');
    }

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
      if (typeof MigrationGraph !== 'undefined' && MigrationGraph.canvas) {
        MigrationGraph.updateFromLog(data.line);
      }

      // Add flash effect to the newest log line
      const logOutput = document.querySelector('.log-output');
      if (logOutput) {
        const lastLine = logOutput.lastElementChild;
        if (lastLine && lastLine.classList.contains('log-line')) {
          lastLine.classList.add('log-line-new');
          setTimeout(() => lastLine.classList.remove('log-line-new'), 600);
        }
      }
    });

    // Subscribe to exit
    this.unsubExit = window.cloudvoyager.cli.onExit((data) => {
      this.isRunning = false;
      clearInterval(this.timerInterval);

      const statusEl = container.querySelector('#exec-status');
      const cancelBtn = container.querySelector('#btn-cancel');
      const homeBtn = container.querySelector('#btn-home');
      const resultsBtn = container.querySelector('#btn-results');

      cancelBtn.textContent = 'Close';
      cancelBtn.className = 'btn btn-secondary btn-sm';
      cancelBtn.onclick = () => {
        this.cleanup();
        App.navigate('welcome');
      };
      homeBtn.disabled = false;

      const rerunBtn = container.querySelector('#btn-rerun');
      if (rerunBtn) {
        rerunBtn.style.display = '';
        rerunBtn.addEventListener('click', () => {
          this.cleanup();
          // Navigate back to the config screen that launched this
          const configScreen = this.params.configType === 'transfer' ? 'transfer-config' : 'migrate-config';
          App.navigate(configScreen);
        });
      }

      // Show summary card
      const elapsed = this.formatDuration(Date.now() - this.startTime);
      const summaryHtml = `
        <div class="execution-summary">
          <div class="summary-item">
            <span class="summary-label">Duration</span>
            <span class="summary-value">${elapsed}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Status</span>
            <span class="summary-value">${data.code === 0 ? 'Success' : data.signal ? 'Cancelled' : 'Failed'}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Phase</span>
            <span class="summary-value">${this.currentPhaseLabel || 'Complete'}</span>
          </div>
        </div>
      `;
      const logEl = container.querySelector('#exec-log');
      if (logEl) logEl.insertAdjacentHTML('beforebegin', summaryHtml);

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
    container.querySelector('#btn-cancel').addEventListener('click', () => {
      if (this.isRunning) {
        App.showConfirmDialog(
          'Cancel Operation',
          'Are you sure you want to cancel? The process will be terminated.',
          async () => {
            await window.cloudvoyager.cli.cancel();
          }
        );
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
      const configType = (this.params && this.params.configType) || undefined;
      const result = await window.cloudvoyager.cli.run(this.params.command, args, configType);
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
    if (this.whaleAnimInterval) { clearInterval(this.whaleAnimInterval); this.whaleAnimInterval = null; }
    if (this.typewriterInterval) { clearInterval(this.typewriterInterval); this.typewriterInterval = null; }
    if (this.starfieldTwinkleInterval) { clearInterval(this.starfieldTwinkleInterval); this.starfieldTwinkleInterval = null; }
    if (typeof MigrationGraph !== 'undefined' && MigrationGraph.destroy) { MigrationGraph.destroy(); }
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

  /** Render a sprite array onto an offscreen canvas. */
  renderSprite(spriteArray, palette, scale, expectedWidth) {
    const canvas = document.createElement('canvas');
    canvas.width = expectedWidth * scale;
    canvas.height = spriteArray.length * scale;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < spriteArray.length; y++) {
      const row = spriteArray[y].padEnd(expectedWidth, ' ');
      for (let x = 0; x < expectedWidth; x++) {
        const ch = row[x];
        if (palette[ch]) {
          ctx.fillStyle = palette[ch];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    return canvas;
  },

  drawWhale() {
    const palette = {
      'D': '#1e293b', 'M': '#334155', 'L': '#94a3b8',
      'W': '#f8fafc', 'B': '#0f172a', 'C': '#bae6fd',
      'S': '#7dd3fc', 'P': '#e0f2fe'
    };

    // Frame 1: Tail up, spout visible
    const whaleF1 = [
      '                                                                                ',
      '                                                                                ',
      '                                          P   P                                 ',
      '                                         P  P  P                                ',
      '                                        PPPPPPPPP                               ',
      '                                          PPPPP                                 ',
      '                                            P                                   ',
      '                                                                                ',
      '                                  DDDDDDDDDDDD                                  ',
      '                              DDDDMMMMMMMMMMMMDDDD                              ',
      '                           DDDMMMMMMMMMMMMMMMMMMMMDD                            ',
      '                         DDMMMMMMMMMMMMMMMMMMMMMMMMMDD                          ',
      '                       DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD                        ',
      '  DD                 DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD                       ',
      ' DMMD               DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMBMD                      ',
      ' DMMMD            DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDD                      ',
      ' DMMMMD         DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWW                    ',
      '  DMMMMD      DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWWWW                   ',
      '   DMMMMDDDDDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWW                    ',
      '    DMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWWW                    ',
      '     DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWWWW                    ',
      '       DDDWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWLLWWWWWWW                     ',
      '          WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWLLWWWWWW                      ',
      '                            DDDDDDDDD                                           ',
      '                            DMMMMMMMMDD                                         ',
      '                             DMMMMMMMMMDD                                       ',
      '                              WWWWWWWWWWW                                       ',
      '                               WWWWWWWWWW                                       ',
      '                                WWWWWWWW                                        ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                '
    ];

    // Frame 2: Tail down, no spout
    const whaleF2 = [
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                ',
      '                                  DDDDDDDDDDDD                                  ',
      '                              DDDDMMMMMMMMMMMMDDDD                              ',
      '                           DDDMMMMMMMMMMMMMMMMMMMMDD                            ',
      '                         DDMMMMMMMMMMMMMMMMMMMMMMMMMDD                          ',
      '                       DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD                        ',
      '                     DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD                       ',
      '                   DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMBMD                       ',
      '  DD             DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDD                       ',
      ' DMMD          DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWW                     ',
      ' DMMMD       DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWWWWWWW                    ',
      ' DMMMMD   DDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWW                     ',
      '  DMMMMDDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWWW                     ',
      '   DDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMWWLLWWWWWW                     ',
      '     DDDWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWLLWWWWWWW                      ',
      '        WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWLLWWWWWW                       ',
      '                             DDDDDDD                                            ',
      '                              DMMMMMMDD                                         ',
      '                               DMMMMMMMDD                                       ',
      '                                WWWWWWWWWW                                      ',
      '                                 WWWWWWWWW                                      ',
      '                                  WWWWWWWW                                      ',
      '                                                                                ',
      '                                                                                ',
      '                                                                                '
    ];

    // Multi-shaded pixel clouds
    const cloudSprite = [
      '',
      '          WWWW',
      '        WWWWWWWW                              WWW',
      '       WWWWWWWWWW                           WWWWWWW',
      '      WWWWWWWWWWWC                         WWWWWWWWC',
      '     WWWWWWWWWWWWCC                       WWWWWWWWWCC',
      '    WWWWWWWWWWWWWWCC                     WWWWWWWWWWWCC',
      '    CCCCCCCCCCCCCCCC                     CCCCCCCCCCCCC',
      '     SSSSSSSSSSSSSS                       SSSSSSSSSSS',
      '',
      '',
      '                                    WWWWW',
      '                                  WWWWWWWWW',
      '                                 WWWWWWWWWWC',
      '                                WWWWWWWWWWWWCC',
      '                                CCCCCCCCCCCCCC',
      '                                 SSSSSSSSSSSS',
      '',
      '  WWW',
      ' WWWWWWW                                                 WWWW',
      'WWWWWWWWC                                              WWWWWWWW',
      'CCCCCCCCCC                                            WWWWWWWWWC',
      'SSSSSSSSSS                                            CCCCCCCCCC',
      '                                                       SSSSSSSS',
      '',
      '                         WWWWWWW',
      '                       WWWWWWWWWWW',
      '                      WWWWWWWWWWWWC',
      '                      CCCCCCCCCCCCC',
      '                       SSSSSSSSSSS',
      '',
      ''
    ];

    // --- WHALE: render both frames as offscreen canvases ---
    this.whaleSpriteF1 = this.renderSprite(whaleF1, palette, 2, 80);
    this.whaleSpriteF2 = this.renderSprite(whaleF2, palette, 2, 80);

    // Create display canvas and append to DOM
    const whaleEl = document.getElementById('whale-sprite');
    if (whaleEl) {
      const display = document.createElement('canvas');
      display.width = 160;  // 80 * 2
      display.height = 64;  // 32 * 2
      display.id = 'whale-display';
      whaleEl.appendChild(display);
      display.getContext('2d').drawImage(this.whaleSpriteF1, 0, 0);
    }

    // --- STARFIELD: draw a canvas of twinkling stars behind the whale ---
    const trackEl = document.querySelector('.whale-track');
    if (trackEl) {
      const starCanvas = document.createElement('canvas');
      starCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
      const trackRect = trackEl.getBoundingClientRect();
      const starW = Math.max(trackRect.width, 400);
      const starH = Math.max(trackRect.height, 64);
      starCanvas.width = starW;
      starCanvas.height = starH;
      const starCtx = starCanvas.getContext('2d');

      // Generate random star positions
      const starCount = 40 + Math.floor(Math.random() * 20); // 40-60 stars
      const stars = [];
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * starW,
          y: Math.random() * starH,
          r: 0.5 + Math.random() * 1.5, // 0.5-2px radius
          opacity: 0.3 + Math.random() * 0.7, // 0.3-1.0
          isBlue: Math.random() > 0.7 // 30% chance of light blue tint
        });
      }

      const drawStars = () => {
        starCtx.clearRect(0, 0, starW, starH);
        for (const star of stars) {
          const color = star.isBlue ? `rgba(200, 220, 255, ${star.opacity})` : `rgba(255, 255, 255, ${star.opacity})`;
          starCtx.fillStyle = color;
          starCtx.beginPath();
          starCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
          starCtx.fill();
        }
      };

      drawStars();
      trackEl.insertBefore(starCanvas, trackEl.firstChild);

      // Subtle twinkle: randomly adjust opacity of a few stars every 2s
      this.starfieldTwinkleInterval = setInterval(() => {
        const numTwinkle = 5 + Math.floor(Math.random() * 5);
        for (let i = 0; i < numTwinkle; i++) {
          const idx = Math.floor(Math.random() * stars.length);
          stars[idx].opacity = 0.3 + Math.random() * 0.7;
        }
        drawStars();
      }, 2000);
    }

    // --- CLOUDS: render tile then repeat across a wide canvas ---
    const cloudTile = this.renderSprite(cloudSprite, palette, 2, 64);
    const tileW = cloudTile.width;  // 128
    const numTiles = 8;
    const cloudsCanvas = document.createElement('canvas');
    cloudsCanvas.width = tileW * numTiles;
    cloudsCanvas.height = cloudTile.height;
    const cloudCtx = cloudsCanvas.getContext('2d');
    for (let i = 0; i < numTiles; i++) {
      cloudCtx.drawImage(cloudTile, i * tileW, 0);
    }
    const cloudsEl = document.getElementById('whale-clouds');
    if (cloudsEl) cloudsEl.appendChild(cloudsCanvas);

    // --- FRAME ANIMATION: alternate whale sprites every 450ms ---
    let frame = 0;
    this.whaleAnimInterval = setInterval(() => {
      frame = (frame + 1) % 2;
      const canvas = document.getElementById('whale-display');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, 160, 64);
        ctx.drawImage(frame === 0 ? this.whaleSpriteF1 : this.whaleSpriteF2, 0, 0);
      }
    }, 450);
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
      this.setPhaseLabel('Connecting...');
      return;
    }
    if (line.includes('=== Step 2: Extracting server-wide data')) {
      s.phase = 'setup';
      this.setProgress(3);
      this.setPhaseLabel('Extracting server data...');
      return;
    }
    if (line.includes('=== Step 3: Generating organization mappings')) {
      s.phase = 'setup';
      this.setProgress(7);
      this.setPhaseLabel('Generating mappings...');
      return;
    }

    // --- Org setup (10-15%) ---
    if (line.includes('=== Step 4: Saving server info')) {
      s.phase = 'org-setup';
      this.setProgress(10);
      this.setPhaseLabel('Setting up organization...');
      return;
    }
    if (line.includes('=== Migrating to organization:')) {
      s.phase = 'org-setup';
      this.setProgress(11);
      return;
    }
    if (line.includes('Creating groups')) { this.setProgress(11); this.setPhaseLabel('Creating groups...'); return; }
    if (line.includes('Setting global permissions')) { this.setProgress(12); return; }
    if (line.includes('Creating quality gates')) { this.setProgress(12); this.setPhaseLabel('Creating quality gates...'); return; }
    if (line.includes('Restoring quality profiles')) { this.setProgress(13); this.setPhaseLabel('Restoring quality profiles...'); return; }
    if (line.includes('Creating permission templates')) { this.setProgress(14); this.setPhaseLabel('Creating permission templates...'); return; }

    // --- Project tracking (15-95%) ---
    const projectMatch = line.match(/--- Project (\d+)\/(\d+):/);
    if (projectMatch) {
      s.currentProject = parseInt(projectMatch[1], 10);
      s.totalProjects = parseInt(projectMatch[2], 10);
      s.phase = 'project-start';
      s.subPercent = 0;
      // Start of this project's slice
      this.setProgress(this.projectProgress(s, 0));
      this.setPhaseLabel('Migrating project ' + s.currentProject + '/' + s.totalProjects + '...');
      return;
    }

    // Within a project — sub-phases
    if (s.totalProjects > 0 && s.currentProject > 0) {
      // Scanner report upload phase (0-30% of project slice)
      if (line.includes('Starting data extraction') || line.includes('Starting transfer for project') || line.includes('Starting checkpoint-aware')) {
        s.phase = 'scanner';
        s.subPercent = 5;
        this.setProgress(this.projectProgress(s, 5));
        this.setPhaseLabel('Extracting project data...');
        return;
      }
      if (line.includes('Building protobuf messages')) {
        s.subPercent = 15;
        this.setProgress(this.projectProgress(s, 15));
        this.setPhaseLabel('Building report...');
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
        this.setPhaseLabel('Uploading to SonarCloud...');
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
        this.setPhaseLabel('Syncing issues...');
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
        this.setPhaseLabel('Syncing hotspots...');
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
      this.setPhaseLabel('Migration complete');
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
      this.setPhaseLabel('Testing connections...');
      return;
    }
    if (line.includes('Starting data extraction') || line.includes('Starting checkpoint-aware')) {
      this.setProgress(5);
      this.setPhaseLabel('Extracting data...');
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
      this.setPhaseLabel('Building protobuf...');
      return;
    }
    if (line.includes('Successfully built all protobuf messages')) {
      this.setProgress(55);
      return;
    }
    if (line.includes('Encoding to protobuf format')) {
      this.setProgress(60);
      this.setPhaseLabel('Encoding...');
      return;
    }
    if (line.includes('Uploading to SonarCloud') || line.includes('Submitting to SonarCloud')) {
      this.setProgress(68);
      this.setPhaseLabel('Uploading to SonarCloud...');
      return;
    }
    if (line.includes('Report submitted to Compute Engine')) {
      this.setProgress(80);
      this.setPhaseLabel('Waiting for analysis...');
      return;
    }
    if (line.includes('Analysis completed successfully')) {
      this.setProgress(92);
      this.setPhaseLabel('Analysis complete');
      return;
    }
    // Non-main branches
    if (line.includes('Syncing') && line.includes('additional branch')) {
      this.setProgress(93);
      this.setPhaseLabel('Syncing branches...');
      return;
    }
    if (line.includes('=== Transfer completed successfully ===')) {
      this.setProgress(98);
      this.setPhaseLabel('Transfer complete');
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

      // Track for ETA
      if (this.progressHistory) {
        this.progressHistory.push({ percent: clamped, time: Date.now() });
        if (this.progressHistory.length > 20) this.progressHistory.shift();
        this.updateETA(clamped);
      }
    }
  },

  setPhaseLabel(label) {
    this.currentPhaseLabel = label;
    const el = document.getElementById('whale-phase');
    if (!el) return;

    // Clear any ongoing typewriter interval
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
      this.typewriterInterval = null;
    }

    // Typewriter effect: type out char-by-char at ~30ms per char
    el.textContent = '';
    let charIndex = 0;
    this.typewriterInterval = setInterval(() => {
      if (charIndex < label.length) {
        el.textContent = label.slice(0, charIndex + 1);
        charIndex++;
      } else {
        clearInterval(this.typewriterInterval);
        this.typewriterInterval = null;
      }
    }, 30);
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

  updateWhale(percent) {
    const sprite = document.getElementById('whale-sprite');
    const trail = document.getElementById('whale-trail');
    const percentEl = document.getElementById('whale-percent');
    if (!sprite || !trail || !percentEl) return;

    const clamped = Math.min(100, Math.max(0, percent));
    // Whale moves from left (0%) to right (100%) of the track
    sprite.style.left = `calc(${clamped}% - 100px)`;
    trail.style.width = `${clamped}%`;
    percentEl.textContent = `${clamped}%`;

    // On completion: green trail, stop animation on spout frame
    if (clamped >= 100) {
      trail.classList.add('whale-trail-complete');
      if (this.whaleAnimInterval) {
        clearInterval(this.whaleAnimInterval);
        this.whaleAnimInterval = null;
      }
      const display = document.getElementById('whale-display');
      if (display && this.whaleSpriteF1) {
        const ctx = display.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 160, 64);
          ctx.drawImage(this.whaleSpriteF1, 0, 0);
        }
      }
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
