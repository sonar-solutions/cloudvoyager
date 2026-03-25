/**
 * Verify config wizard — 3 steps for migration verification.
 * Uses the same migrate-style config (SQ + SC orgs).
 */
window.VerifyConfigScreen = {
  config: null,
  step: 0,

  STEPS: [
    'SonarQube Connection',
    'SonarCloud Organizations',
    'Review & Start'
  ],

  async init() {
    // Reuse stored migrate config as base (same shape)
    const stored = await window.cloudvoyager.config.loadKey('migrateConfig');
    this.config = stored || {
      sonarqube: { url: '', token: '' },
      sonarcloud: { enterprise: { key: '' }, organizations: [] },
      transfer: { mode: 'full', batchSize: 100, syncAllBranches: true, excludeBranches: [], checkpoint: { enabled: true, cacheExtractions: true, cacheMaxAgeDays: 7, strictResume: false } },
      migrate: { outputDir: './migration-output' },
      rateLimit: { maxRetries: 3, baseDelay: 1000, minRequestInterval: 0 },
      performance: { autoTune: false, maxConcurrency: 64, maxMemoryMB: 8192 }
    };
    // Verify-specific transient options
    this.config._onlyComponents = this.config._onlyComponents || [];
    this.config._verbose = this.config._verbose || false;
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
        <p>Connect to the SonarQube server you migrated from</p>
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
        <p>Add the SonarCloud organizations to verify against</p>
      </div>
      <div class="card">
        <div class="card-header">Enterprise (optional)</div>
        ${ConfigForm.textField('enterprise-key', 'Enterprise Key', enterprise.key, { placeholder: 'my-enterprise', hint: 'Required for portfolio verification. Leave blank if not using enterprise features.' })}
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
      orgs.push({
        key: container.querySelector(`#org-key-${i}`)?.value.trim() || '',
        token: container.querySelector(`#org-token-${i}`)?.value.trim() || '',
        url: container.querySelector(`#org-url-${i}`)?.value.trim() || 'https://sonarcloud.io'
      });
    });
    this.config.sonarcloud.organizations = orgs;
  },

  renderReviewStep(container) {
    const sq = this.config.sonarqube;
    const orgs = this.config.sonarcloud.organizations || [];
    const orgRows = orgs.map((o, i) => [`Organization ${i + 1}`, `${o.key} (${o.url})`]);

    const onlyComponents = [
      { id: 'scan-data', label: 'Code Analysis Data' },
      { id: 'scan-data-all-branches', label: 'Code Analysis (All Branches)' },
      { id: 'portfolios', label: 'Portfolios (Project Collections)' },
      { id: 'quality-gates', label: 'Quality Policies (Gates)' },
      { id: 'quality-profiles', label: 'Coding Rules (Profiles)' },
      { id: 'permission-templates', label: 'Permission Templates' },
      { id: 'permissions', label: 'Permissions' },
      { id: 'issue-metadata', label: 'Issue Details' },
      { id: 'hotspot-metadata', label: 'Security Hotspot Details' },
      { id: 'project-settings', label: 'Project Settings' }
    ];

    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('clipboard')} Review & Start Verification</h2>
        <p>Check the settings and choose what to verify</p>
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
        <div class="card-header">${ConfigForm.icon('shield')} Choose What to Verify (optional)</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Select specific items to verify, or leave all unchecked to verify everything.</p>
        ${onlyComponents.map(c => ConfigForm.checkbox(`only-${c.id}`, c.label, false)).join('')}
      </div>

      <div class="card">
        ${ConfigForm.checkbox('verbose', 'Show detailed log output', this.config._verbose || false, { hint: 'Display extra technical details in the log' })}
      </div>

      ${ConfigForm.collapsible('advanced-section', 'More Settings (Advanced)', TransferConfigScreen.renderAdvancedHtml.call({ config: this.config }), true)}

      <div class="button-row spread">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <div style="display:flex;gap:12px">
          <button class="btn btn-secondary" id="btn-test">${ConfigForm.icon('search')} Test Connections</button>
          <button class="btn btn-primary" id="btn-start">${ConfigForm.icon('check-circle')} Start Verification</button>
        </div>
      </div>
    `;

    ConfigForm.attachHandlers(container);
    container.querySelector('#btn-back').addEventListener('click', () => this.renderStep(container, 1));
    container.querySelector('#btn-test').addEventListener('click', async () => {
      TransferConfigScreen.readAdvancedValues.call({ config: this.config }, container);
      await this.saveConfig();
      App.navigate('connection-test', { command: 'test', configType: 'migrate', returnTo: 'verify-config' });
    });
    container.querySelector('#btn-start').addEventListener('click', async () => {
      TransferConfigScreen.readAdvancedValues.call({ config: this.config }, container);
      await this.saveConfig();
      const args = [];
      if (this.config._verbose) args.push('--verbose');

      const selected = [];
      container.querySelectorAll('[id^="only-"]').forEach(cb => {
        if (cb.checked) selected.push(cb.id.replace('only-', ''));
      });
      if (selected.length > 0) {
        args.push('--only', selected.join(','));
      }

      this.config._verbose = container.querySelector('#verbose')?.checked || false;

      App.navigate('execution', { command: 'verify', args, configType: 'migrate' });
    });
  },

  async saveConfig() {
    // Save as migrateConfig since verify uses the same config shape
    await window.cloudvoyager.config.saveKey('migrateConfig', this.config);
  },

  async saveAndNext(container) {
    await this.saveConfig();
    this.renderStep(container, this.step + 1);
  }
};
