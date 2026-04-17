/**
 * Sync-metadata config wizard — 3 steps for metadata-only sync.
 * Uses the same migrate-style config (SQ + SC orgs).
 */
window.SyncMetadataConfigScreen = {
  config: null,
  step: 0,

  STEPS: [
    'SonarQube Connection',
    'SonarCloud Organizations',
    'Review & Start'
  ],

  async init() {
    // Reuse stored migrate config as base (same shape)
    const stored = await window.cloudvoyager.config.loadKey('syncMetadataConfig') || await window.cloudvoyager.config.loadKey('migrateConfig');
    this.config = stored || {
      sonarqube: { url: '', token: '' },
      sonarcloud: { enterprise: { key: '' }, organizations: [] },
      transfer: { mode: 'full', batchSize: 100, syncAllBranches: true, excludeBranches: [], checkpoint: { enabled: true, cacheExtractions: true, cacheMaxAgeDays: 7, strictResume: false } },
      migrate: { outputDir: './migration-output', skipIssueMetadataSync: false, skipHotspotMetadataSync: false, skipQualityProfileSync: false },
      rateLimit: { maxRetries: 3, baseDelay: 1000, minRequestInterval: 0 },
      performance: { autoTune: false, maxConcurrency: 64, maxMemoryMB: 8192 }
    };
    this.config._verbose = this.config._verbose || false;
    this.config._skipIssueSync = this.config._skipIssueSync || false;
    this.config._skipHotspotSync = this.config._skipHotspotSync || false;
    this.config._skipQPSync = this.config._skipQPSync || false;
    this.config._skipBranches = this.config._skipBranches || false;
    const adv = await window.cloudvoyager.config.loadKey('advancedConfig');
    this.sqcCustomUrl = adv?.sqcCustomUrl?.trim() || '';
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
      case 1: this.renderOrgsStep(container); break;
      case 2: this.renderReviewStep(container); break;
    }
  },

  renderSonarQubeStep(container) {
    const sq = this.config.sonarqube;
    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('plug')} SonarQube Connection</h2>
        <p>Connect to the SonarQube server to sync metadata from</p>
      </div>
      <div class="card">
        ${ConfigForm.textField('sq-url', 'Server Address (URL)', sq.url, { placeholder: 'https://sonarqube.example.com', required: true, hint: 'The web address of your SonarQube server' })}
        ${ConfigForm.textField('sq-token', 'Authentication Token', sq.token, { type: 'password', placeholder: 'sqp_...', required: true, hint: 'You can generate this in SonarQube under My Account > Security > Tokens' })}
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
      this.saveAndNext(container);
    });
  },

  renderOrgsStep(container) {
    const orgs = this.config.sonarcloud.organizations || [];

    let orgsHtml = '';
    orgs.forEach((org, i) => {
      orgsHtml += MigrateConfigScreen.renderOrgEntry(org, i);
    });

    const enterprise = this.config.sonarcloud.enterprise || { key: '' };

    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('cloud')} SonarCloud Organizations</h2>
        <p>Add the SonarCloud organizations to sync metadata to</p>
      </div>
      <div class="card">
        <div class="card-header">Enterprise (optional)</div>
        ${ConfigForm.textField('enterprise-key', 'Enterprise Key', enterprise.key, { placeholder: 'my-enterprise', hint: 'Required for portfolio sync. Leave blank if not using enterprise features.' })}
      </div>
      <div id="org-list">${orgsHtml}</div>
      <button class="add-org-btn" id="add-org">+ Add Organization</button>
      <div class="button-row right" style="margin-top:24px">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <button class="btn btn-primary" id="btn-next">Next</button>
      </div>
    `;

    MigrateConfigScreen.attachOrgHandlers.call(this, container);
    container.querySelector('#add-org').addEventListener('click', () => {
      this.readOrgs(container);
      this.config.sonarcloud.organizations.push({ key: '', token: '', url: 'https://sonarcloud.io' });
      this.renderStep(container, 1);
    });
    container.querySelector('#btn-back').addEventListener('click', () => this.renderStep(container, 0));
    container.querySelector('#btn-next').addEventListener('click', () => {
      const orgResult = ConfigForm.validateOrgs(container);
      if (!orgResult.valid) return;
      this.readOrgs(container);
      const ek = container.querySelector('#enterprise-key')?.value.trim() || '';
      this.config.sonarcloud.enterprise = { key: ek };
      this.saveAndNext(container);
    });
  },

  readOrgs(container) {
    const orgs = [];
    container.querySelectorAll('.org-entry').forEach((el) => {
      const i = el.dataset.orgIndex;
      const instance = container.querySelector(`input[name="org-instance-${i}"]:checked`)?.value || 'eu';
      orgs.push({
        key: container.querySelector(`#org-key-${i}`)?.value.trim() || '',
        token: container.querySelector(`#org-token-${i}`)?.value.trim() || '',
        url: ConfigForm.instanceToUrl(instance, this.sqcCustomUrl)
      });
    });
    this.config.sonarcloud.organizations = orgs;
  },

  renderReviewStep(container) {
    const sq = this.config.sonarqube;
    const orgs = this.config.sonarcloud.organizations || [];
    const orgRows = orgs.map((o, i) => [`Organization ${i + 1}`, `${o.key} (${o.url})`]);

    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('clipboard')} Review & Start Sync</h2>
        <p>Check the settings and choose what to sync</p>
      </div>

      <div class="card">
        <div class="card-header">${ConfigForm.icon('plug')} SonarQube (Source)</div>
        ${ConfigForm.summaryTable([
          ['Server Address', sq.url],
          ['Token', sq.token ? '********' : '']
        ])}
      </div>

      <div class="card">
        <div class="card-header">${ConfigForm.icon('cloud')} SonarCloud Organizations (${orgs.length})</div>
        ${ConfigForm.summaryTable(orgRows)}
      </div>

      <div class="card">
        <div class="card-header">${ConfigForm.icon('gear')} Sync Options</div>
        ${ConfigForm.checkbox('skip-issue-meta', 'Skip Issue Metadata Sync', this.config._skipIssueSync, { hint: "Skip syncing issue statuses, assignments, comments, and tags. CLI flag: --skip-issue-metadata-sync" })}
        ${ConfigForm.checkbox('skip-hotspot-meta', 'Skip Hotspot Metadata Sync', this.config._skipHotspotSync, { hint: "Skip syncing hotspot statuses and comments. CLI flag: --skip-hotspot-metadata-sync" })}
        ${ConfigForm.checkbox('skip-qp-sync', 'Skip Quality Profile Sync', this.config._skipQPSync, { hint: "Skip syncing quality profile configurations. CLI flag: --skip-quality-profile-sync" })}
        ${ConfigForm.checkbox('skip-branches', 'Skip All Branch Sync', this.config._skipBranches, { hint: 'Only sync the main branch of each project. CLI flag: --skip-all-branch-sync' })}
        ${ConfigForm.checkbox('verbose', 'Verbose', this.config._verbose || false, { hint: 'Enable verbose logging with extra technical details. CLI flag: --verbose' })}
      </div>

      ${ConfigForm.collapsible('advanced-section', 'More Settings (Advanced)', TransferConfigScreen.renderAdvancedHtml.call({ config: this.config }), true)}

      <div class="button-row spread">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <div style="display:flex;gap:12px">
          <button class="btn btn-secondary" id="btn-test">${ConfigForm.icon('search')} Test Connections</button>
          <button class="btn btn-primary" id="btn-start">${ConfigForm.icon('sync')} Start Sync</button>
        </div>
      </div>
    `;

    ConfigForm.attachHandlers(container);
    container.querySelector('#btn-back').addEventListener('click', () => this.renderStep(container, 1));
    container.querySelector('#btn-test').addEventListener('click', async () => {
      TransferConfigScreen.readAdvancedValues.call({ config: this.config }, container);
      await this.saveConfig();
      App.navigate('connection-test', { command: 'test', configType: 'migrate', returnTo: 'sync-metadata-config' });
    });
    container.querySelector('#btn-start').addEventListener('click', async () => {
      this.config._verbose = container.querySelector('#verbose')?.checked || false;
      this.config._skipIssueSync = container.querySelector('#skip-issue-meta')?.checked || false;
      this.config._skipHotspotSync = container.querySelector('#skip-hotspot-meta')?.checked || false;
      this.config._skipQPSync = container.querySelector('#skip-qp-sync')?.checked || false;
      this.config._skipBranches = container.querySelector('#skip-branches')?.checked || false;
      TransferConfigScreen.readAdvancedValues.call({ config: this.config }, container);
      await this.saveConfig();

      const args = [];
      if (this.config._verbose) args.push('--verbose');
      if (this.config._skipIssueSync) args.push('--skip-issue-metadata-sync');
      if (this.config._skipHotspotSync) args.push('--skip-hotspot-metadata-sync');
      if (this.config._skipQPSync) args.push('--skip-quality-profile-sync');
      if (this.config._skipBranches) args.push('--skip-all-branch-sync');

      App.navigate('execution', { command: 'sync-metadata', args, configType: 'migrate' });
    });
  },

  async saveConfig() {
    await window.cloudvoyager.config.saveKey('syncMetadataConfig', this.config);
  },

  async saveAndNext(container) {
    await this.saveConfig();
    this.renderStep(container, this.step + 1);
  }
};
