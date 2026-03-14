/**
 * Results screen — lists generated reports after a migration/verify run.
 */
window.ResultsScreen = {
  async render(container, params) {
    WizardNav.clear();

    const historyEntry = params?.historyEntry;
    const subtitle = historyEntry
      ? `${historyEntry.command} — ${new Date(historyEntry.timestamp).toLocaleString()}`
      : 'Generated report files from the last run';

    container.innerHTML = `
      <div class="page-header">
        <h2>Reports</h2>
        <p>${ConfigForm.escapeHtml(subtitle)}</p>
      </div>
      <div id="results-loading" style="text-align:center;padding:40px">
        <span class="spinner"></span>
        <p style="margin-top:12px;color:var(--text-secondary)">Loading reports...</p>
      </div>
      <div id="results-content" style="display:none"></div>
      <div class="button-row spread" style="margin-top:24px">
        <button class="btn btn-secondary" id="btn-home">Back to Home</button>
        <button class="btn btn-secondary" id="btn-open-folder">Open Reports Folder</button>
      </div>
    `;

    container.querySelector('#btn-home').addEventListener('click', () => App.navigate('welcome'));

    // Load reports
    try {
      const paramDir = params?.reportsDir;
      const reportsDir = paramDir || await window.cloudvoyager.config.loadKey('reportsDir');
      const defaultDir = await window.cloudvoyager.app.getDefaultReportsDir();
      const dir = reportsDir || defaultDir;

      const files = await window.cloudvoyager.reports.list(dir);

      container.querySelector('#results-loading').style.display = 'none';
      const contentEl = container.querySelector('#results-content');
      contentEl.style.display = '';

      if (files.length === 0) {
        contentEl.innerHTML = `
          <div class="card" style="text-align:center;padding:40px">
            <p style="color:var(--text-secondary)">No report files found in ${ConfigForm.escapeHtml(dir)}</p>
          </div>
        `;
      } else {
        // Group by extension
        const grouped = {};
        for (const f of files) {
          const ext = f.ext || 'other';
          if (!grouped[ext]) grouped[ext] = [];
          grouped[ext].push(f);
        }

        let html = '';
        for (const [ext, fileList] of Object.entries(grouped)) {
          html += `<div class="card">`;
          html += `<div class="card-header">${ext.toUpperCase()} Files (${fileList.length})</div>`;
          html += `<ul class="report-list">`;
          for (const f of fileList) {
            html += `
              <li class="report-item">
                <span>
                  <span class="report-name">${ConfigForm.escapeHtml(f.name)}</span>
                </span>
                <button class="btn btn-secondary btn-sm" data-open-file="${ConfigForm.escapeHtml(f.path)}">Open</button>
              </li>
            `;
          }
          html += `</ul></div>`;
        }
        contentEl.innerHTML = html;

        // Bind open buttons
        contentEl.querySelectorAll('[data-open-file]').forEach(btn => {
          btn.addEventListener('click', () => {
            window.cloudvoyager.reports.openFolder(btn.dataset.openFile);
          });
        });
      }

      container.querySelector('#btn-open-folder').addEventListener('click', () => {
        window.cloudvoyager.reports.openFolder(dir);
      });
    } catch (err) {
      container.querySelector('#results-loading').innerHTML = `<p style="color:var(--danger)">Error loading reports: ${err.message}</p>`;
    }
  }
};
