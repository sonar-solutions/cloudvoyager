/**
 * Connection test screen — runs the `test` command and shows results.
 */
window.ConnectionTestScreen = {
  params: null,
  unsubLog: null,
  unsubExit: null,

  async render(container, params) {
    this.params = params || {};
    WizardNav.clear();

    container.innerHTML = `
      <div class="page-header">
        <h2>🔍 Testing Connections</h2>
        <p>Verifying connectivity to SonarQube and SonarCloud</p>
      </div>
      <div id="test-status" style="margin-bottom:20px">
        <span class="badge badge-running"><span class="spinner" style="width:14px;height:14px;margin-right:6px"></span> Running...</span>
      </div>
      <div id="test-log"></div>
      <div class="button-row right" style="margin-top:24px">
        <button class="btn btn-secondary" id="btn-back" disabled>⬅️ Back</button>
      </div>
    `;

    const logContainer = container.querySelector('#test-log');
    LogViewer.create(logContainer);

    this.unsubLog = window.cloudvoyager.cli.onLog((data) => {
      LogViewer.addLine(data);
    });

    this.unsubExit = window.cloudvoyager.cli.onExit((data) => {
      const statusEl = container.querySelector('#test-status');
      if (data.code === 0) {
        statusEl.innerHTML = '<span class="badge badge-completed">✅ Connection Successful</span>';
        App.showToast('✅ Connection test passed', 'success');
      } else {
        statusEl.innerHTML = '<span class="badge badge-failed">❌ Connection Failed</span>';
        App.showToast('❌ Connection test failed', 'error');
      }
      container.querySelector('#btn-back').disabled = false;
    });

    container.querySelector('#btn-back').addEventListener('click', () => {
      this.cleanup();
      if (this.params.returnTo) {
        App.navigate(this.params.returnTo);
      } else {
        App.navigate('welcome');
      }
    });

    // Start the test
    try {
      await window.cloudvoyager.cli.run('test', ['--verbose']);
    } catch (err) {
      container.querySelector('#test-status').innerHTML = `<span class="badge badge-failed">💥 Error: ${err.message}</span>`;
      container.querySelector('#btn-back').disabled = false;
    }
  },

  cleanup() {
    if (this.unsubLog) { this.unsubLog(); this.unsubLog = null; }
    if (this.unsubExit) { this.unsubExit(); this.unsubExit = null; }
  }
};
