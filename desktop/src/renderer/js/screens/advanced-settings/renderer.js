/**
 * Advanced Settings screen — configures throttling, performance, and progress recovery.
 */
window.AdvancedSettingsScreen = {
  config: null,

  async init() {
    const stored = await window.cloudvoyager.config.loadKey('advancedConfig');
    this.config = stored || JSON.parse(JSON.stringify(window.ADVANCED_DEFAULTS));
  },

  async render(container) {
    await this.init();
    WizardNav.clear();

    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('gear')} Advanced Settings</h2>
        <p>Fine-tune performance, throttling, and progress recovery</p>
      </div>

      ${this.renderSqcCard()}
      ${this.renderThrottlingCard()}
      ${this.renderPerformanceCard()}
      ${this.renderRecoveryCard()}

      <div class="button-row spread" style="margin-top:24px">
        <button class="btn btn-secondary" id="btn-back">Back to Home</button>
        <div style="display:flex;gap:12px">
          <button class="btn btn-secondary" id="btn-reset-defaults">Reset to Defaults</button>
          <button class="btn btn-primary" id="btn-save">Save Settings</button>
        </div>
      </div>
    `;

    ConfigForm.attachHandlers(container);
    this.attachEventListeners(container);
  },

  renderSqcCard() {
    return `
      <div class="card">
        <div class="card-header">SonarQube Cloud</div>
        ${ConfigForm.textField('adv-sqc-url', 'Custom SonarQube Cloud URL', this.config.sqcCustomUrl || '', { placeholder: 'https://sonarcloud.io', hint: 'Override the EU/US instance selection with a custom URL, e.g. for staging environments. Leave blank to use the standard EU/US selection.' })}
        ${ConfigForm.checkbox('allow-no-enterprise-key', 'Allow migration without enterprise key', this.config.allowNoEnterpriseKey || false, { hint: 'When enabled, the enterprise key becomes optional. Portfolios will not be migrated without an enterprise key. Intended for team/free plan migrations.' })}
      </div>
    `;
  },

  renderThrottlingCard() {
    const rl = this.config.rateLimit;
    return `
      <div class="card">
        <div class="card-header">Request Throttling</div>
        <div class="form-grid">
          ${ConfigForm.numberField('rl-retries', 'Retry attempts', rl.maxRetries, { min: 0, max: 20, hint: 'How many times to retry a failed request' })}
          ${ConfigForm.numberField('rl-delay', 'Wait between retries (ms)', rl.baseDelay, { min: 0, max: 60000, hint: 'Milliseconds to wait before retrying' })}
          ${ConfigForm.numberField('rl-interval', 'Minimum gap between requests (ms)', rl.minRequestInterval, { min: 0, max: 10000, hint: 'Slow down requests to avoid overloading the server' })}
        </div>
      </div>
    `;
  },

  renderPerformanceCard() {
    const perf = this.config.performance;
    return `
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
    `;
  },

  renderRecoveryCard() {
    const cp = this.config.checkpoint;
    return `
      <div class="card" style="margin-top:12px">
        <div class="card-header">Progress Recovery</div>
        ${ConfigForm.textField('cp-statefile', 'State file path', this.config.stateFile || './.cloudvoyager-state.json', { hint: 'Path to the file that tracks transfer progress between runs' })}
        ${ConfigForm.checkbox('cp-enabled', 'Save progress checkpoints', cp.enabled, { hint: 'If interrupted, resume from where it stopped instead of starting over' })}
        ${ConfigForm.checkbox('cp-cache', 'Keep downloaded data temporarily', cp.cacheExtractions, { hint: "Saves extracted data so it doesn't need to be re-downloaded on retry" })}
        <div class="form-grid">
          ${ConfigForm.numberField('cp-maxage', 'Keep saved data for (days)', cp.cacheMaxAgeDays, { min: 1, hint: 'Automatically discard old saved data after this many days' })}
        </div>
        ${ConfigForm.checkbox('cp-strict', 'Strict resume mode', cp.strictResume, { hint: 'Stop and warn if something changed since the last checkpoint (safer but stricter)' })}
      </div>
    `;
  },

  attachEventListeners(container) {
    container.querySelector('#btn-back').addEventListener('click', () => {
      App.navigate('welcome');
    });

    container.querySelector('#btn-reset-defaults').addEventListener('click', () => {
      App.showConfirmDialog(
        'Reset to Defaults',
        'This will restore all advanced settings to their default values.',
        async () => {
          this.config = JSON.parse(JSON.stringify(window.ADVANCED_DEFAULTS));
          await this.saveConfig();
          this.render(container);
          App.showToast('Settings restored to defaults', 'success');
        }
      );
    });

    container.querySelector('#btn-save').addEventListener('click', async () => {
      this.config = AdvancedSettingsReader.readFromForm(container);
      await this.saveConfig();
      App.showToast('Advanced settings saved', 'success');
    });
  },

  async saveConfig() {
    await window.cloudvoyager.config.saveKey('advancedConfig', this.config);
  }
};
