/**
 * Welcome / landing screen.
 */
window.WelcomeScreen = {
  render(container) {
    WizardNav.clear();

    container.innerHTML = `
      <div class="welcome-container">
        <div class="welcome-hero">
          <h1>🐳 CloudVoyager Desktop</h1>
          <p>🚀 Migrate data from SonarQube to SonarCloud</p>
        </div>

        <div class="command-cards">
          <div class="command-card" data-command="transfer">
            <h3>📦 Transfer One Project</h3>
            <p>Move a single project from your SonarQube server to SonarCloud.</p>
          </div>
          <div class="command-card" data-command="migrate">
            <h3>🌐 Move All Projects &amp; Settings</h3>
            <p>Move all projects, coding rules, quality policies, permissions, and settings between organizations.</p>
          </div>
        </div>

        <div class="secondary-actions">
          <button class="secondary-action" data-command="verify">✅ Verify Migration Results</button>
          <button class="secondary-action" data-command="sync-metadata">🔄 Sync Settings &amp; Policies</button>
          <button class="secondary-action" data-command="status">📊 Check Progress</button>
          <button class="secondary-action" data-command="reset">🗑️ Clear Migration History</button>
        </div>
      </div>
    `;

    // Bind clicks
    container.querySelectorAll('[data-command]').forEach(el => {
      el.addEventListener('click', () => {
        const command = el.dataset.command;
        switch (command) {
          case 'transfer':
            App.navigate('transfer-config');
            break;
          case 'migrate':
            App.navigate('migrate-config');
            break;
          case 'verify':
            App.navigate('verify-config');
            break;
          case 'sync-metadata':
            App.navigate('sync-metadata-config');
            break;
          case 'status':
            App.navigate('status');
            break;
          case 'reset':
            App.navigate('reset');
            break;
        }
      });
    });
  }
};
