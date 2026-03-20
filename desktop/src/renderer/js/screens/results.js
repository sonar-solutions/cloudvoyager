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
        <h2>${ConfigForm.icon('folder')} Reports</h2>
        <p>${ConfigForm.escapeHtml(subtitle)}</p>
      </div>
      <div id="results-loading" style="text-align:center;padding:40px">
        <span class="spinner"></span>
        <p style="margin-top:12px;color:var(--text-secondary)">Loading reports...</p>
      </div>
      <div id="results-content" style="display:none"></div>
      <div class="button-row spread" style="margin-top:24px">
        <button class="btn btn-secondary" id="btn-home">Back to Home</button>
        <button class="btn btn-secondary" id="btn-open-folder">${ConfigForm.icon('folder')} Open Reports Folder</button>
      </div>
    `;

    container.querySelector('#btn-home').addEventListener('click', () => App.navigate('welcome'));

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
          const ext = (f.ext || '.other').replace('.', '');
          if (!grouped[ext]) grouped[ext] = [];
          grouped[ext].push(f);
        }

        // Stats summary
        const totalFiles = files.length;

        let html = `
          <div class="results-summary">
            <div class="stat-card">
              <div class="stat-value">${totalFiles}</div>
              <div class="stat-label">Total Files</div>
            </div>
            ${Object.entries(grouped).map(([ext, list]) => `
              <div class="stat-card">
                <div class="stat-value">${list.length}</div>
                <div class="stat-label">.${ext.toUpperCase()}</div>
              </div>
            `).join('')}
          </div>
          <input type="text" class="report-search" id="report-search" placeholder="Filter reports..." aria-label="Filter reports by name">
        `;

        for (const [ext, fileList] of Object.entries(grouped)) {
          html += `<div class="card report-group">`;
          html += `<div class="card-header">.${ext.toUpperCase()} Files (${fileList.length})</div>`;
          html += `<ul class="report-list">`;
          for (const f of fileList) {
            const fileName = f.name.split('/').pop();
            const badgeClass = ext.toLowerCase();
            const sizeStr = f.size ? this.formatSize(f.size) : '';
            html += `
              <li class="report-item" data-report-name="${ConfigForm.escapeHtml(f.name)}">
                <span class="report-type-badge ${badgeClass}">${ext}</span>
                <div class="report-info">
                  <div class="report-name" title="${ConfigForm.escapeHtml(f.name)}">${ConfigForm.escapeHtml(fileName)}</div>
                  ${sizeStr ? `<div class="report-size">${sizeStr}</div>` : ''}
                </div>
                <button class="btn btn-secondary btn-sm" data-open-file="${ConfigForm.escapeHtml(f.path)}" aria-label="Open ${ConfigForm.escapeHtml(fileName)}">Open</button>
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

        // Search filter
        const searchInput = contentEl.querySelector('#report-search');
        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            contentEl.querySelectorAll('.report-item').forEach(item => {
              const name = item.dataset.reportName?.toLowerCase() || '';
              item.style.display = name.includes(query) ? '' : 'none';
            });
          });
        }
      }

      container.querySelector('#btn-open-folder').addEventListener('click', () => {
        window.cloudvoyager.reports.openFolder(dir);
      });
    } catch (err) {
      container.querySelector('#results-loading').innerHTML = `<p style="color:var(--danger)">Error loading reports: ${err.message}</p>`;
    }
  },

  formatSize(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
};
