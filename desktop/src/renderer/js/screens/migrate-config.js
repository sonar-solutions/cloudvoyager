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
    const advancedConfig = await window.cloudvoyager.config.loadKey('advancedConfig');
    this.allowNoEnterpriseKey = advancedConfig?.allowNoEnterpriseKey || false;
    this.sqcCustomUrl = advancedConfig?.sqcCustomUrl?.trim() || '';
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

    const enterprise = this.config.sonarcloud.enterprise || { key: '' };
    const isRequired = !this.allowNoEnterpriseKey;
    const headerLabel = isRequired ? 'Enterprise' : 'Enterprise (optional)';
    const hintText = isRequired
      ? 'Your SonarCloud enterprise key. The key will be validated before proceeding.'
      : 'Optional. Without an enterprise key, portfolios will not be migrated.';

    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('cloud')} SonarCloud Organizations</h2>
        <p>Add the SonarCloud organizations you want to migrate your data into</p>
      </div>
      <div class="card">
        <div class="card-header">${headerLabel}</div>
        ${ConfigForm.textField('enterprise-key', 'Enterprise Key', enterprise.key, { placeholder: 'my-enterprise', required: isRequired, hint: hintText })}
        <div id="enterprise-validation-status" style="margin-top:8px"></div>
        <button class="btn btn-secondary btn-sm" id="btn-validate-enterprise" style="margin-top:8px">Validate Enterprise Key</button>
      </div>
      <div id="org-list">${orgsHtml}</div>
      <button class="add-org-btn" id="add-org">+ Add Organization</button>
      <div class="button-row right" style="margin-top:24px">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <button class="btn btn-primary" id="btn-next">Next</button>
      </div>
    `;

    this.attachOrgHandlers(container);
    this._enterpriseValidated = false;

    container.querySelector('#enterprise-key')?.addEventListener('input', () => {
      this._enterpriseValidated = false;
    });

    container.querySelector('#btn-validate-enterprise').addEventListener('click', async () => {
      await this._validateEnterpriseKey(container);
    });

    container.querySelector('#add-org').addEventListener('click', () => {
      this.readOrgs(container);
      this.config.sonarcloud.organizations.push({ key: '', token: '', url: 'https://sonarcloud.io' });
      this.renderStep(container, 1);
    });
    container.querySelector('#btn-back').addEventListener('click', () => this.renderStep(container, 0));
    container.querySelector('#btn-next').addEventListener('click', async () => {
      const orgResult = ConfigForm.validateOrgs(container);
      if (!orgResult.valid) return;
      this.readOrgs(container);
      const ek = container.querySelector('#enterprise-key')?.value.trim() || '';

      if (isRequired && !ek) return;

      if (ek && !this._enterpriseValidated) {
        const valid = await this._validateEnterpriseKey(container);
        if (!valid) return;
      }

      if (ek) {
        this.config.sonarcloud.enterprise = { key: ek };
      } else {
        delete this.config.sonarcloud.enterprise;
      }
      this.saveAndNext(container);
    });
  },

  async _validateEnterpriseKey(container) {
    const ek = container.querySelector('#enterprise-key')?.value.trim() || '';
    const statusEl = container.querySelector('#enterprise-validation-status');
    if (!ek) {
      statusEl.innerHTML = '<span style="color:var(--warning)">Please enter an enterprise key to validate.</span>';
      this._enterpriseValidated = false;
      return false;
    }

    this.readOrgs(container);
    const firstOrg = (this.config.sonarcloud.organizations || [])[0];
    if (!firstOrg?.token) {
      statusEl.innerHTML = '<span style="color:var(--warning)">Add at least one organization with a token first.</span>';
      this._enterpriseValidated = false;
      return false;
    }

    statusEl.innerHTML = '<span style="color:var(--text-secondary)">Validating...</span>';
    const result = await window.cloudvoyager.enterprise.validate(ek, firstOrg.token, firstOrg.url || 'https://sonarcloud.io');
    if (result.valid) {
      statusEl.innerHTML = '<span style="color:var(--success)">Enterprise key validated successfully.</span>';
      this._enterpriseValidated = true;
      return true;
    }
    statusEl.innerHTML = `<span style="color:var(--error)">${result.error}</span>`;
    this._enterpriseValidated = false;
    return false;
  },

  renderOrgEntry(org, index) {
    const instance = org.url === 'https://sonarqube.us' ? 'us' : 'eu';
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
        ${ConfigForm.radioGroup(`org-instance-${index}`, 'SonarQube Cloud Instance', [
          { value: 'eu', label: 'EU (sonarcloud.io)' },
          { value: 'us', label: 'US (sonarqube.us)' }
        ], instance)}
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
      const instance = container.querySelector(`input[name="org-instance-${i}"]:checked`)?.value || 'eu';
      orgs.push({
        key: container.querySelector(`#org-key-${i}`)?.value.trim() || '',
        token: container.querySelector(`#org-token-${i}`)?.value.trim() || '',
        url: ConfigForm.instanceToUrl(instance, this.sqcCustomUrl)
      });
    });
    this.config.sonarcloud.organizations = orgs;
  },

  renderOptionsStep(container) {
    const m = this.config.migrate;
    const t = this.config.transfer;

    const onlyComponents = [
      { id: 'scan-data', label: 'Scan Data' },
      { id: 'scan-data-all-branches', label: 'Scan Data (All Branches)' },
      { id: 'portfolios', label: 'Portfolios' },
      { id: 'quality-gates', label: 'Quality Gates' },
      { id: 'quality-profiles', label: 'Quality Profiles' },
      { id: 'permission-templates', label: 'Permission Templates' },
      { id: 'permissions', label: 'Permissions' },
      { id: 'issue-metadata', label: 'Issue Metadata' },
      { id: 'hotspot-metadata', label: 'Hotspot Metadata' },
      { id: 'project-settings', label: 'Project Settings' }
    ];

    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('gear')} Migration Settings</h2>
        <p>Choose what to migrate and how</p>
      </div>
      <div class="card">
        ${ConfigForm.folderField('output-dir', 'Reports Output Folder', m.outputDir, { hint: 'Where to save all generated reports, logs, and records' })}
        ${ConfigForm.radioGroup('transfer-mode', 'Transfer Mode', [
          { value: 'full', label: 'Full Transfer (everything)' },
          { value: 'incremental', label: 'Incremental (new & changed data only)' }
        ], t.mode)}
        ${ConfigForm.checkbox('dry-run', 'Dry Run', m.dryRun, { hint: 'Extract data and generate mappings without actually migrating — preview what would happen. CLI flag: --dry-run' })}
        ${ConfigForm.checkbox('skip-issue-meta', 'Skip Issue Metadata Sync', m.skipIssueMetadataSync, { hint: "Skip syncing issue statuses, comments, tags, and assignments. CLI flag: --skip-issue-metadata-sync" })}
        ${ConfigForm.checkbox('skip-hotspot-meta', 'Skip Hotspot Metadata Sync', m.skipHotspotMetadataSync, { hint: "Skip syncing hotspot statuses and comments. CLI flag: --skip-hotspot-metadata-sync" })}
        ${ConfigForm.checkbox('skip-qp-sync', 'Skip Quality Profile Sync', m.skipQualityProfileSync, { hint: "Skip syncing quality profile configurations. CLI flag: --skip-quality-profile-sync" })}
        ${ConfigForm.checkbox('sync-branches', 'Sync All Branches', t.syncAllBranches, { hint: 'When unchecked, only the main branch is transferred. Unchecking is equivalent to CLI flag: --skip-all-branch-sync' })}
        ${ConfigForm.textField('exclude-branches', 'Exclude Branches', (t.excludeBranches || []).join(', '), { hint: 'Comma-separated branch names to skip (e.g. feature/old, release/legacy)' })}
        ${ConfigForm.numberField('batch-size', 'Batch Size', t.batchSize, { min: 1, max: 500, hint: 'How many items to process per batch (1\u2013500). Higher values are faster but use more memory' })}
        ${ConfigForm.checkbox('verbose', 'Verbose', this.config._verbose || false, { hint: 'Enable verbose logging with extra technical details. CLI flag: --verbose' })}
        ${ConfigForm.checkbox('wait-analysis', 'Wait', this.config._waitAnalysis || false, { hint: 'Wait for SonarCloud to complete its analysis before finishing. CLI flag: --wait' })}
      </div>

      ${ConfigForm.collapsible('migrate-components', `${ConfigForm.icon('shield')} Select Components (optional)`,
        `<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Select specific components to migrate, or leave all unchecked to migrate everything. Maps to CLI flag: --only</p>
        ${onlyComponents.map(c => ConfigForm.checkbox(`only-${c.id}`, c.label, false)).join('')}`
      )}

      ${ConfigForm.collapsible('advanced-section', `${ConfigForm.icon('gear')} More Settings (Advanced)`, TransferConfigScreen.renderAdvancedHtml.call({ config: this.config }))}

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
      this.config.transfer.excludeBranches = container.querySelector('#exclude-branches').value.split(',').map(s => s.trim()).filter(Boolean);
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
    const enterprise = this.config.sonarcloud.enterprise || { key: '' };
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
        ${enterprise.key
          ? ConfigForm.summaryTable([['Enterprise Key', enterprise.key]])
          : `<p style="font-size:13px;color:var(--warning);margin:8px 0">No enterprise key provided — portfolios will not be migrated.</p>`}
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
          ['Excluded branches', (t.excludeBranches || []).join(', ') || 'None'],
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
      const buildArgs = (extra = []) => {
        const args = [...extra];
        if (this.config._verbose) args.push('--verbose');
        if (this.config._waitAnalysis) args.push('--wait');
        if (this.config._onlyComponents && this.config._onlyComponents.length > 0) {
          args.push('--only', this.config._onlyComponents.join(','));
        }
        return args;
      };
      const checkpoint = await window.cloudvoyager.checkpoint.detect('migrate');
      if (checkpoint.found) {
        const choice = await App.showResumeDialog(checkpoint);
        if (choice === 'cancel') return;
        if (choice === 'resume') {
          App.navigate('execution', { command: 'migrate', args: buildArgs(), configType: 'migrate', resumeRunDir: checkpoint.runDir });
          return;
        }
      }
      const freshArgs = checkpoint.found ? ['--force-restart'] : [];
      App.navigate('execution', { command: 'migrate', args: buildArgs(freshArgs), configType: 'migrate' });
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
