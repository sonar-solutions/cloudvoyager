/**
 * Migrate config wizard — 4 steps for full org migration.
 */
window.MigrateConfigScreen = {
  config: null,
  step: 0,

  STEPS: [
    'SonarQube Connection',
    'SonarCloud Organizations',
    'Migration Settings',
    'Review & Start'
  ],

  async init() {
    const stored = await window.cloudvoyager.config.loadKey('migrateConfig');
    this.config = stored || {
      sonarqube: { url: '', token: '' },
      sonarcloud: { organizations: [] },
      transfer: { mode: 'incremental', batchSize: 100, syncAllBranches: true, excludeBranches: [] },
      migrate: { outputDir: './migration-output', skipIssueMetadataSync: false, skipHotspotMetadataSync: false, skipQualityProfileSync: false, dryRun: false },
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
      case 1: this.renderOrgsStep(container); break;
      case 2: this.renderOptionsStep(container); break;
      case 3: this.renderReviewStep(container); break;
    }
  },

  renderSonarQubeStep(container) {
    const sq = this.config.sonarqube;
    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('plug')} SonarQube Connection</h2>
        <p>Connect to your SonarQube server to migrate from</p>
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
      orgsHtml += this.renderOrgEntry(org, i);
    });

    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('cloud')} SonarCloud Organizations</h2>
        <p>Add the SonarCloud organizations you want to migrate your data into</p>
      </div>
      <div id="org-list">${orgsHtml}</div>
      <button class="add-org-btn" id="add-org">+ Add Organization</button>
      <div class="button-row right" style="margin-top:24px">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <button class="btn btn-primary" id="btn-next">Next</button>
      </div>
    `;

    this.attachOrgHandlers(container);
    container.querySelector('#add-org').addEventListener('click', () => {
      this.readOrgs(container);
      this.config.sonarcloud.organizations.push({ key: '', token: '', url: 'https://sonarcloud.io' });
      this.renderStep(container, 1);
    });
    container.querySelector('#btn-back').addEventListener('click', () => this.renderStep(container, 0));
    container.querySelector('#btn-next').addEventListener('click', () => {
      this.readOrgs(container);
      this.saveAndNext(container);
    });
  },

  renderOrgEntry(org, index) {
    return `
      <div class="org-entry" data-org-index="${index}">
        <div class="org-entry-header">
          <span class="org-entry-title">Organization ${index + 1}</span>
          <button class="org-remove-btn" data-remove-org="${index}" title="Remove organization ${index + 1}" aria-label="Remove organization ${index + 1}">&times;</button>
        </div>
        <div class="form-grid">
          ${ConfigForm.textField(`org-key-${index}`, 'Organization Key', org.key, { placeholder: 'my-org', required: true, hint: 'Your organization identifier in SonarCloud' })}
          ${ConfigForm.textField(`org-token-${index}`, 'Token', org.token, { type: 'password', required: true, hint: 'Authentication token for this organization' })}
        </div>
        ${ConfigForm.textField(`org-url-${index}`, 'SonarCloud Address (URL)', org.url || 'https://sonarcloud.io', { hint: 'Leave as default unless you are using a staging or custom environment' })}
      </div>
    `;
  },

  attachOrgHandlers(container) {
    ConfigForm.attachHandlers(container);
    container.querySelectorAll('.org-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.readOrgs(container);
        const idx = parseInt(btn.dataset.removeOrg, 10);
        this.config.sonarcloud.organizations.splice(idx, 1);
        this.renderStep(container, 1);
      });
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

  renderOptionsStep(container) {
    const m = this.config.migrate;
    const t = this.config.transfer;

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
        <h2>${ConfigForm.icon('gear')} Migration Settings</h2>
        <p>Choose what to migrate and how</p>
      </div>
      <div class="card">
        ${ConfigForm.folderField('output-dir', 'Reports Output Folder', m.outputDir, { hint: 'Where to save all generated reports, logs, and records' })}
        ${ConfigForm.radioGroup('transfer-mode', 'What to transfer', [
          { value: 'full', label: 'Everything (full transfer)' },
          { value: 'incremental', label: 'Only new & changed data' }
        ], t.mode)}
        ${ConfigForm.checkbox('dry-run', 'Preview only (no changes)', m.dryRun, { hint: 'Simulates the migration so you can see what would happen without actually making changes' })}
        ${ConfigForm.checkbox('skip-issue-meta', 'Skip updating issue details', m.skipIssueMetadataSync, { hint: "Don't update issue statuses and comments" })}
        ${ConfigForm.checkbox('skip-hotspot-meta', 'Skip updating security hotspot details', m.skipHotspotMetadataSync, { hint: "Don't update security hotspot statuses and comments" })}
        ${ConfigForm.checkbox('skip-qp-sync', 'Skip updating coding rules', m.skipQualityProfileSync, { hint: "Don't transfer quality profile configurations" })}
        ${ConfigForm.checkbox('sync-branches', 'Include all code branches', t.syncAllBranches, { hint: 'When unchecked, only the main branch is transferred' })}
        ${ConfigForm.numberField('batch-size', 'Items per group', t.batchSize, { min: 1, max: 500, hint: 'How many items to process at once (1\u2013500)' })}
        ${ConfigForm.checkbox('verbose', 'Show detailed log output', this.config._verbose || false, { hint: 'Display extra technical details in the log' })}
        ${ConfigForm.checkbox('wait-analysis', 'Wait for SonarCloud to finish reviewing', this.config._waitAnalysis || false, { hint: 'Keep running until SonarCloud completes its analysis' })}
      </div>

      <div class="card">
        <div class="card-header">${ConfigForm.icon('shield')} Choose What to Migrate (optional)</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Select specific items to move, or leave all unchecked to move everything.</p>
        ${onlyComponents.map(c => ConfigForm.checkbox(`only-${c.id}`, c.label, false)).join('')}
      </div>

      ${ConfigForm.collapsible('advanced-section', 'More Settings (Advanced)', TransferConfigScreen.renderAdvancedHtml.call({ config: this.config }))}

      <div class="button-row right">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <button class="btn btn-primary" id="btn-next">Next</button>
      </div>
    `;
    ConfigForm.attachHandlers(container);
    container.querySelector('#btn-back').addEventListener('click', () => this.renderStep(container, 1));
    container.querySelector('#btn-next').addEventListener('click', () => {
      this.config.migrate.outputDir = container.querySelector('#output-dir').value.trim() || './migration-output';
      this.config.transfer.mode = container.querySelector('input[name="transfer-mode"]:checked')?.value || 'incremental';
      this.config.migrate.dryRun = container.querySelector('#dry-run').checked;
      this.config.migrate.skipIssueMetadataSync = container.querySelector('#skip-issue-meta').checked;
      this.config.migrate.skipHotspotMetadataSync = container.querySelector('#skip-hotspot-meta').checked;
      this.config.migrate.skipQualityProfileSync = container.querySelector('#skip-qp-sync').checked;
      this.config.transfer.syncAllBranches = container.querySelector('#sync-branches').checked;
      this.config.transfer.batchSize = parseInt(container.querySelector('#batch-size').value, 10) || 100;
      this.config._verbose = container.querySelector('#verbose').checked;
      this.config._waitAnalysis = container.querySelector('#wait-analysis')?.checked;

      const selected = [];
      container.querySelectorAll('[id^="only-"]').forEach(cb => {
        if (cb.checked) selected.push(cb.id.replace('only-', ''));
      });
      this.config._onlyComponents = selected;

      TransferConfigScreen.readAdvancedValues.call({ config: this.config }, container);
      this.saveAndNext(container);
    });
  },

  renderReviewStep(container) {
    const sq = this.config.sonarqube;
    const orgs = this.config.sonarcloud.organizations || [];
    const m = this.config.migrate;
    const t = this.config.transfer;

    const modeLabel = t.mode === 'full' ? 'Everything (full transfer)' : 'Only new & changed data';
    let orgRows = orgs.map((o, i) => [`Organization ${i + 1}`, `${o.key} (${o.url})`]);

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
          ['Token', sq.token ? '********' : '']
        ])}
      </div>

      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <span>${ConfigForm.icon('cloud')} SonarCloud Organizations (${orgs.length})</span>
          <button class="btn btn-sm btn-secondary" data-edit-step="1">Edit</button>
        </div>
        ${ConfigForm.summaryTable(orgRows)}
      </div>

      <div class="card">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
          <span>${ConfigForm.icon('gear')} Migration Settings</span>
          <button class="btn btn-sm btn-secondary" data-edit-step="2">Edit</button>
        </div>
        ${ConfigForm.summaryTable([
          ['What to transfer', modeLabel],
          ['Preview only', m.dryRun ? 'Yes' : 'No'],
          ['Reports output folder', m.outputDir],
          ['Include all branches', t.syncAllBranches ? 'Yes' : 'No'],
          ['Items per group', t.batchSize]
        ])}
      </div>

      <div class="button-row spread">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <div style="display:flex;gap:12px">
          <button class="btn btn-secondary" id="btn-test">${ConfigForm.icon('search')} Test Connections</button>
          <button class="btn btn-primary" id="btn-start">${ConfigForm.icon('rocket')} Start Migration</button>
        </div>
      </div>
    `;

    container.querySelector('#btn-back').addEventListener('click', () => this.renderStep(container, 2));
    container.querySelector('#btn-test').addEventListener('click', async () => {
      await this.saveConfig();
      App.navigate('connection-test', { command: 'test', configType: 'migrate', returnTo: 'migrate-config' });
    });
    container.querySelector('#btn-start').addEventListener('click', async () => {
      await this.saveConfig();
      const args = ['--force-restart'];
      if (this.config._verbose) args.push('--verbose');
      if (this.config._waitAnalysis) args.push('--wait');
      if (this.config._onlyComponents && this.config._onlyComponents.length > 0) {
        args.push('--only', this.config._onlyComponents.join(','));
      }
      App.navigate('execution', { command: 'migrate', args, configType: 'migrate' });
    });
    container.querySelectorAll('[data-edit-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.renderStep(container, parseInt(btn.dataset.editStep, 10));
      });
    });
  },

  async saveConfig() {
    await window.cloudvoyager.config.saveKey('migrateConfig', this.config);
    await window.cloudvoyager.config.saveKey('lastCommand', 'migrate');
  },

  async saveAndNext(container) {
    await this.saveConfig();
    this.renderStep(container, this.step + 1);
  }
};
