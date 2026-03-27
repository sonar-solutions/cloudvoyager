/**
 * Transfer config wizard — 4 steps for single-project transfer.
 */
window.TransferConfigScreen = {
  config: null,
  step: 0,

  STEPS: [
    'SonarQube Connection',
    'SonarCloud Connection',
    'Transfer Settings',
    'Review & Start'
  ],

  async init() {
    const stored = await window.cloudvoyager.config.loadKey('transferConfig');
    this.config = stored || {
      sonarqube: { url: '', token: '', projectKey: '' },
      sonarcloud: { url: 'https://sonarcloud.io', token: '', organization: '', projectKey: '' },
      transfer: { mode: 'incremental', stateFile: './.cloudvoyager-state.json', batchSize: 100, syncAllBranches: true, excludeBranches: [], checkpoint: { enabled: true, cacheExtractions: true, cacheMaxAgeDays: 7, strictResume: false } },
      rateLimit: { maxRetries: 3, baseDelay: 1000, minRequestInterval: 0 },
      performance: { autoTune: false, maxConcurrency: 64, maxMemoryMB: 8192 }
    };
  },

  async render(container) {
    await this.init();
    this.renderStep(container, this.step);
  },

  renderStep(container, stepIndex) {
    this.step = stepIndex;
    WizardNav.render(this.STEPS, stepIndex, (i) => this.renderStep(container, i));

    switch (stepIndex) {
      case 0: this.renderSonarQubeStep(container); break;
      case 1: this.renderSonarCloudStep(container); break;
      case 2: this.renderOptionsStep(container); break;
      case 3: this.renderReviewStep(container); break;
    }
  },

  renderSonarQubeStep(container) {
    const sq = this.config.sonarqube;
    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('plug')} SonarQube Connection</h2>
        <p>Connect to your SonarQube server</p>
      </div>
      <div class="card">
        ${ConfigForm.textField('sq-url', 'Server Address (URL)', sq.url, { placeholder: 'https://sonarqube.example.com', required: true, hint: 'The web address of your SonarQube server' })}
        ${ConfigForm.textField('sq-token', 'Authentication Token', sq.token, { type: 'password', placeholder: 'sqp_...', required: true, hint: 'You can generate this in SonarQube under My Account > Security > Tokens' })}
        ${ConfigForm.textField('sq-project', 'Project Key', sq.projectKey, { placeholder: 'my-project', required: true, hint: "Found on your project's Information page in SonarQube" })}
      </div>
      <div class="button-row right">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <button class="btn btn-primary" id="btn-next">Next</button>
      </div>
    `;
    ConfigForm.attachHandlers(container);
    container.querySelector('#btn-back').addEventListener('click', () => App.navigate('welcome'));
    container.querySelector('#btn-next').addEventListener('click', () => {
      const result = ConfigForm.validate(container);
      if (!result.valid) return;
      this.config.sonarqube.url = container.querySelector('#sq-url').value.trim();
      this.config.sonarqube.token = container.querySelector('#sq-token').value.trim();
      this.config.sonarqube.projectKey = container.querySelector('#sq-project').value.trim();
      this.saveAndNext(container);
    });
  },

  renderSonarCloudStep(container) {
    const sc = this.config.sonarcloud;
    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('cloud')} SonarCloud Connection</h2>
        <p>Connect to your SonarCloud organization</p>
      </div>
      <div class="card">
        ${ConfigForm.textField('sc-url', 'SonarCloud Address (URL)', sc.url, { placeholder: 'https://sonarcloud.io', hint: 'Leave as default unless you are using a staging or custom environment' })}
        ${ConfigForm.textField('sc-token', 'Authentication Token', sc.token, { type: 'password', placeholder: 'Token', required: true, hint: 'Generate this in SonarCloud under My Account > Security' })}
        ${ConfigForm.textField('sc-org', 'Organization Key', sc.organization, { placeholder: 'my-org', required: true, hint: 'Your organization identifier in SonarCloud' })}
        ${ConfigForm.textField('sc-project', 'Project Key', sc.projectKey, { placeholder: 'my-org_my-project', required: true, hint: 'The destination project key in SonarCloud' })}
      </div>
      <div class="button-row right">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <button class="btn btn-primary" id="btn-next">Next</button>
      </div>
    `;
    ConfigForm.attachHandlers(container);
    container.querySelector('#btn-back').addEventListener('click', () => this.renderStep(container, 0));
    container.querySelector('#btn-next').addEventListener('click', () => {
      const result = ConfigForm.validate(container);
      if (!result.valid) return;
      this.config.sonarcloud.url = container.querySelector('#sc-url').value.trim();
      this.config.sonarcloud.token = container.querySelector('#sc-token').value.trim();
      this.config.sonarcloud.organization = container.querySelector('#sc-org').value.trim();
      this.config.sonarcloud.projectKey = container.querySelector('#sc-project').value.trim();
      this.saveAndNext(container);
    });
  },

  renderOptionsStep(container) {
    const t = this.config.transfer;
    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('gear')} Transfer Settings</h2>
        <p>Choose how the transfer should run</p>
      </div>
      <div class="card">
        ${ConfigForm.radioGroup('transfer-mode', 'What to transfer', [
          { value: 'full', label: 'Everything (full transfer)' },
          { value: 'incremental', label: 'Only new & changed data' }
        ], t.mode)}
        ${ConfigForm.checkbox('sync-branches', 'Include all code branches', t.syncAllBranches, { hint: 'When unchecked, only the main branch is transferred' })}
        ${ConfigForm.textField('exclude-branches', 'Exclude branches', (t.excludeBranches || []).join(', '), { hint: 'Comma-separated branch names to skip (e.g. feature/old, release/legacy)' })}
        ${ConfigForm.numberField('batch-size', 'Items per group', t.batchSize, { min: 1, max: 500, hint: 'How many items to process at once (1\u2013500). Higher = faster but uses more memory' })}
        ${ConfigForm.checkbox('wait-analysis', 'Wait for SonarCloud to finish reviewing', this.config._waitAnalysis || false, { hint: 'Keep running until SonarCloud completes its analysis of the uploaded data' })}
        ${ConfigForm.checkbox('verbose', 'Show detailed log output', this.config._verbose || false, { hint: 'Display extra technical details in the log during transfer' })}
      </div>

      ${ConfigForm.collapsible('advanced-section', `${ConfigForm.icon('gear')} More Settings (Advanced)`, this.renderAdvancedHtml())}

      <div class="button-row right">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <button class="btn btn-primary" id="btn-next">Next</button>
      </div>
    `;
    ConfigForm.attachHandlers(container);
    container.querySelector('#btn-back').addEventListener('click', () => this.renderStep(container, 1));
    container.querySelector('#btn-next').addEventListener('click', () => {
      this.config.transfer.mode = container.querySelector('input[name="transfer-mode"]:checked')?.value || 'incremental';
      this.config.transfer.syncAllBranches = container.querySelector('#sync-branches').checked;
      this.config.transfer.excludeBranches = container.querySelector('#exclude-branches').value.split(',').map(s => s.trim()).filter(Boolean);
      this.config.transfer.batchSize = parseInt(container.querySelector('#batch-size').value, 10) || 100;
      this.config._waitAnalysis = container.querySelector('#wait-analysis').checked;
      this.config._verbose = container.querySelector('#verbose').checked;
      this.readAdvancedValues(container);
      this.saveAndNext(container);
    });
  },

  renderAdvancedHtml() {
    const rl = this.config.rateLimit;
    const perf = this.config.performance;
    const cp = this.config.transfer.checkpoint;
    return `
      <div class="card">
        <div class="card-header">Request Throttling</div>
        <div class="form-grid">
          ${ConfigForm.numberField('rl-retries', 'Retry attempts', rl.maxRetries, { min: 0, max: 20, hint: 'How many times to retry a failed request' })}
          ${ConfigForm.numberField('rl-delay', 'Wait between retries (ms)', rl.baseDelay, { min: 0, max: 60000, hint: 'Milliseconds to wait before retrying' })}
          ${ConfigForm.numberField('rl-interval', 'Minimum gap between requests (ms)', rl.minRequestInterval, { min: 0, max: 10000, hint: 'Slow down requests to avoid overloading the server' })}
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="card-header">Speed & Resources</div>
        ${ConfigForm.checkbox('perf-autotune', 'Auto-optimize for this computer', perf.autoTune, { hint: 'Automatically adjust settings based on your hardware' })}
        <div class="form-grid">
          ${ConfigForm.numberField('perf-concurrency', 'Parallel tasks', perf.maxConcurrency, { min: 1, max: 128, hint: 'How many operations to run at the same time' })}
          ${ConfigForm.numberField('perf-memory', 'Memory limit (MB)', perf.maxMemoryMB, { min: 0, max: 32768, hint: '0 = let the system decide' })}
          ${ConfigForm.numberField('perf-source', 'Source file extraction concurrency', perf.sourceExtraction?.concurrency ?? 50, { min: 1, max: 100, hint: 'Max concurrent source file fetches from SonarQube' })}
          ${ConfigForm.numberField('perf-hotspot', 'Hotspot extraction concurrency', perf.hotspotExtraction?.concurrency ?? 50, { min: 1, max: 100, hint: 'Max concurrent hotspot detail fetches from SonarQube' })}
          ${ConfigForm.numberField('perf-issue-sync', 'Issue sync concurrency', perf.issueSync?.concurrency ?? 20, { min: 1, max: 50, hint: 'Max concurrent issue metadata sync operations to SonarCloud' })}
          ${ConfigForm.numberField('perf-hotspot-sync', 'Hotspot sync concurrency', perf.hotspotSync?.concurrency ?? 20, { min: 1, max: 50, hint: 'Max concurrent hotspot sync operations to SonarCloud' })}
          ${ConfigForm.numberField('perf-project', 'Project migration concurrency', perf.projectMigration?.concurrency ?? 8, { min: 1, max: 16, hint: 'Max concurrent project migrations' })}
          ${ConfigForm.numberField('perf-verify', 'Project verification concurrency', perf.projectVerification?.concurrency ?? 3, { min: 1, max: 16, hint: 'Max concurrent project verifications' })}
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="card-header">Progress Recovery</div>
        ${ConfigForm.textField('cp-statefile', 'State file path', this.config.transfer.stateFile || './.cloudvoyager-state.json', { hint: 'Path to the file that tracks transfer progress between runs' })}
        ${ConfigForm.checkbox('cp-enabled', 'Save progress checkpoints', cp.enabled, { hint: 'If interrupted, resume from where it stopped instead of starting over' })}
        ${ConfigForm.checkbox('cp-cache', 'Keep downloaded data temporarily', cp.cacheExtractions, { hint: "Saves extracted data so it doesn't need to be re-downloaded on retry" })}
        <div class="form-grid">
          ${ConfigForm.numberField('cp-maxage', 'Keep saved data for (days)', cp.cacheMaxAgeDays, { min: 1, hint: 'Automatically discard old saved data after this many days' })}
        </div>
        ${ConfigForm.checkbox('cp-strict', 'Strict resume mode', cp.strictResume, { hint: 'Stop and warn if something changed since the last checkpoint (safer but stricter)' })}
      </div>
    `;
  },

  readAdvancedValues(container) {
    const val = (id) => container.querySelector(`#${id}`)?.value;
    const chk = (id) => container.querySelector(`#${id}`)?.checked;

    const numVal = (id, fallback) => { const n = parseInt(val(id), 10); return Number.isNaN(n) ? fallback : n; };

    this.config.rateLimit.maxRetries = numVal('rl-retries', 3);
    this.config.rateLimit.baseDelay = numVal('rl-delay', 1000);
    this.config.rateLimit.minRequestInterval = numVal('rl-interval', 0);

    this.config.performance.autoTune = chk('perf-autotune') || false;
    this.config.performance.maxConcurrency = numVal('perf-concurrency', 64);
    this.config.performance.maxMemoryMB = numVal('perf-memory', 8192);
    this.config.performance.sourceExtraction = { concurrency: numVal('perf-source', 50) };
    this.config.performance.hotspotExtraction = { concurrency: numVal('perf-hotspot', 50) };
    this.config.performance.issueSync = { concurrency: numVal('perf-issue-sync', 20) };
    this.config.performance.hotspotSync = { concurrency: numVal('perf-hotspot-sync', 20) };
    this.config.performance.projectMigration = { concurrency: numVal('perf-project', 8) };
    this.config.performance.projectVerification = { concurrency: numVal('perf-verify', 3) };

    this.config.transfer.stateFile = val('cp-statefile') || './.cloudvoyager-state.json';
    this.config.transfer.checkpoint.enabled = chk('cp-enabled') !== false;
    this.config.transfer.checkpoint.cacheExtractions = chk('cp-cache') !== false;
    this.config.transfer.checkpoint.cacheMaxAgeDays = numVal('cp-maxage', 7);
    this.config.transfer.checkpoint.strictResume = chk('cp-strict') || false;
  },

  renderReviewStep(container) {
    const sq = this.config.sonarqube;
    const sc = this.config.sonarcloud;
    const t = this.config.transfer;

    const modeLabel = t.mode === 'full' ? 'Everything (full transfer)' : 'Only new & changed data';

    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('clipboard')} Review Your Settings</h2>
        <p>Check everything looks correct before starting</p>
      </div>

      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <span>${ConfigForm.icon('plug')} SonarQube (Source)</span>
          <button class="btn btn-sm btn-secondary" data-edit-step="0">Edit</button>
        </div>
        ${ConfigForm.summaryTable([
          ['Server Address', sq.url],
          ['Token', sq.token ? '********' : ''],
          ['Project Key', sq.projectKey]
        ])}
      </div>

      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <span>${ConfigForm.icon('cloud')} SonarCloud (Destination)</span>
          <button class="btn btn-sm btn-secondary" data-edit-step="1">Edit</button>
        </div>
        ${ConfigForm.summaryTable([
          ['Address', sc.url],
          ['Token', sc.token ? '********' : ''],
          ['Organization', sc.organization],
          ['Project Key', sc.projectKey]
        ])}
      </div>

      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <span>${ConfigForm.icon('gear')} Transfer Settings</span>
          <button class="btn btn-sm btn-secondary" data-edit-step="2">Edit</button>
        </div>
        ${ConfigForm.summaryTable([
          ['What to transfer', modeLabel],
          ['Include all branches', t.syncAllBranches ? 'Yes' : 'No'],
          ['Excluded branches', (t.excludeBranches || []).join(', ') || 'None'],
          ['Items per group', t.batchSize]
        ])}
      </div>

      <div class="button-row spread">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <div style="display:flex;gap:12px">
          <button class="btn btn-secondary" id="btn-test">${ConfigForm.icon('search')} Test Connections</button>
          <button class="btn btn-primary" id="btn-start">${ConfigForm.icon('rocket')} Start Transfer</button>
        </div>
      </div>
    `;

    container.querySelector('#btn-back').addEventListener('click', () => this.renderStep(container, 2));
    container.querySelector('#btn-test').addEventListener('click', async () => {
      await this.saveConfig();
      App.navigate('connection-test', { command: 'test', configType: 'transfer', returnTo: 'transfer-config' });
    });
    container.querySelector('#btn-start').addEventListener('click', async () => {
      await this.saveConfig();
      const checkpoint = await window.cloudvoyager.checkpoint.detect('transfer');
      if (checkpoint.found) {
        const choice = await App.showResumeDialog(checkpoint);
        if (choice === 'cancel') return;
        if (choice === 'resume') {
          const args = [];
          if (this.config._verbose) args.push('--verbose');
          if (this.config._waitAnalysis) args.push('--wait');
          App.navigate('execution', { command: 'transfer', args, configType: 'transfer', resumeRunDir: checkpoint.runDir });
          return;
        }
      }
      const args = [];
      if (checkpoint.found) { args.push('--force-restart', '--force-fresh-extract'); }
      if (this.config._verbose) args.push('--verbose');
      if (this.config._waitAnalysis) args.push('--wait');
      App.navigate('execution', { command: 'transfer', args, configType: 'transfer' });
    });
    container.querySelectorAll('[data-edit-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.renderStep(container, parseInt(btn.dataset.editStep, 10));
      });
    });
  },

  async saveConfig() {
    await window.cloudvoyager.config.saveKey('transferConfig', this.config);
    await window.cloudvoyager.config.saveKey('lastCommand', 'transfer');
  },

  async saveAndNext(container) {
    await this.saveConfig();
    this.renderStep(container, this.step + 1);
  }
};
