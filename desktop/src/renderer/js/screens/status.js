/**
 * Status screen — shows current sync state and provides reset option.
 */
window.StatusScreen = {
  unsubLog: null,
  unsubExit: null,

  async render(container) {
    WizardNav.clear();

    container.innerHTML = `
      <div class="page-header">
        <h2>${ConfigForm.icon('chart')} Status</h2>
        <p>Current synchronization state</p>
      </div>
      <div id="status-output">
        <div style="text-align:center;padding:40px">
          <span class="spinner"></span>
          <p style="margin-top:12px;color:var(--text-secondary)">Loading status...</p>
        </div>
      </div>
      <div class="button-row spread" style="margin-top:24px">
        <button class="btn btn-secondary" id="btn-home">Back to Home</button>
        <button class="btn btn-danger" id="btn-reset">${ConfigForm.icon('trash')} Reset State</button>
      </div>
    `;

    container.querySelector('#btn-home').addEventListener('click', () => {
      this.cleanup();
      App.navigate('welcome');
    });

    container.querySelector('#btn-reset').addEventListener('click', () => {
      this.showResetConfirm(container);
    });

    // Run status command and capture output
    this.runStatusCommand(container);
  },

  runStatusCommand(container) {
    const lines = [];
    const outputEl = container.querySelector('#status-output');

    this.unsubLog = window.cloudvoyager.cli.onLog((data) => {
      lines.push(data.line);
    });

    this.unsubExit = window.cloudvoyager.cli.onExit((data) => {
      this.cleanup();
      if (data.code === 0 && lines.length > 0) {
        outputEl.innerHTML = `<div class="card"><pre style="white-space:pre-wrap;font-family:monospace;font-size:13px;color:var(--text-primary);line-height:1.6">${ConfigForm.escapeHtml(lines.join('\n'))}</pre></div>`;
      } else if (lines.length > 0) {
        outputEl.innerHTML = `<div class="card"><pre style="white-space:pre-wrap;font-family:monospace;font-size:13px;color:var(--warning);line-height:1.6">${ConfigForm.escapeHtml(lines.join('\n'))}</pre></div>`;
      } else {
        outputEl.innerHTML = `<div class="card" style="text-align:center;padding:30px"><p style="color:var(--text-secondary)">No state file found. Run a transfer or migration first.</p></div>`;
      }
    });

    window.cloudvoyager.cli.run('status', []).catch(err => {
      this.cleanup();
      outputEl.innerHTML = `<div class="card" style="padding:30px"><p style="color:var(--danger)">Error: ${ConfigForm.escapeHtml(err.message)}</p></div>`;
    });
  },

  showResetConfirm(container) {
    App.showConfirmDialog(
      'Reset State',
      'This will clear all sync history, checkpoint journals, lock files, and extraction caches. This action cannot be undone.',
      async () => {
        try {
          await window.cloudvoyager.cli.run('reset', ['--yes']);
          App.showToast('State has been reset', 'success');
          setTimeout(() => this.render(container), 1000);
        } catch (err) {
          App.showToast(`Reset failed: ${err.message}`, 'error');
        }
      }
    );
  },

  cleanup() {
    if (this.unsubLog) { this.unsubLog(); this.unsubLog = null; }
    if (this.unsubExit) { this.unsubExit(); this.unsubExit = null; }
  }
};
