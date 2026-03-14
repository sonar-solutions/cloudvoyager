/**
 * Verify and Sync Metadata config screens — with user-friendly labels.
 */
window.VerifyConfigScreen = {
  async render(container) {
    WizardNav.clear();

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
        <h2>Verify Migration Results</h2>
        <p>Compare data between SonarQube and SonarCloud to check if the migration was successful</p>
      </div>
      <div class="card">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
          This will use your saved SonarQube and SonarCloud connection settings.
        </p>
        ${ConfigForm.folderField('verify-output', 'Reports Output Folder', '', { hint: 'Where to save the comparison report files' })}
        ${ConfigForm.checkbox('verify-verbose', 'Show detailed log output', false, { hint: 'Display extra technical details in the log' })}
      </div>

      <div class="card">
        <div class="card-header">Choose What to Verify (optional)</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Select specific checks to run, or leave all unchecked to verify everything.</p>
        ${onlyComponents.map(c => ConfigForm.checkbox(`vonly-${c.id}`, c.label, false)).join('')}
      </div>

      <div class="button-row spread">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <button class="btn btn-primary" id="btn-start">Start Verification</button>
      </div>
    `;

    ConfigForm.attachHandlers(container);
    container.querySelector('#btn-back').addEventListener('click', () => App.navigate('welcome'));
    container.querySelector('#btn-start').addEventListener('click', () => {
      const args = [];
      if (container.querySelector('#verify-verbose').checked) args.push('--verbose');
      const outputDir = container.querySelector('#verify-output').value.trim();
      if (outputDir) args.push('--output-dir', outputDir);

      const selected = [];
      container.querySelectorAll('[id^="vonly-"]').forEach(cb => {
        if (cb.checked) selected.push(cb.id.replace('vonly-', ''));
      });
      if (selected.length > 0) args.push('--only', selected.join(','));

      App.navigate('execution', { command: 'verify', args, configType: 'migrate' });
    });
  }
};

window.SyncMetadataConfigScreen = {
  async render(container) {
    WizardNav.clear();

    const onlyComponents = [
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
        <h2>Sync Settings & Policies</h2>
        <p>Update coding rules, quality policies, permissions, and settings without moving code analysis data</p>
      </div>
      <div class="card">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
          This will use your saved SonarQube and SonarCloud connection settings.
        </p>
        ${ConfigForm.checkbox('sm-verbose', 'Show detailed log output', false, { hint: 'Display extra technical details in the log' })}
        ${ConfigForm.checkbox('sm-dryrun', 'Preview only (no changes)', false, { hint: 'Simulates the sync so you can see what would happen without actually making changes' })}
      </div>

      <div class="card">
        <div class="card-header">Choose What to Sync (optional)</div>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Select specific items to sync, or leave all unchecked to sync everything.</p>
        ${onlyComponents.map(c => ConfigForm.checkbox(`smonly-${c.id}`, c.label, false)).join('')}
      </div>

      <div class="button-row spread">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <button class="btn btn-primary" id="btn-start">Start Sync</button>
      </div>
    `;

    ConfigForm.attachHandlers(container);
    container.querySelector('#btn-back').addEventListener('click', () => App.navigate('welcome'));
    container.querySelector('#btn-start').addEventListener('click', () => {
      const args = [];
      if (container.querySelector('#sm-verbose').checked) args.push('--verbose');
      if (container.querySelector('#sm-dryrun').checked) args.push('--dry-run');

      const selected = [];
      container.querySelectorAll('[id^="smonly-"]').forEach(cb => {
        if (cb.checked) selected.push(cb.id.replace('smonly-', ''));
      });
      if (selected.length > 0) args.push('--only', selected.join(','));

      App.navigate('execution', { command: 'sync-metadata', args, configType: 'migrate' });
    });
  }
};
