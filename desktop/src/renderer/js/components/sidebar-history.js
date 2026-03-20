/**
 * Sidebar history component — shows past successful migration runs.
 */
window.SidebarHistory = {
  MAX_ENTRIES: 50,

  async refresh() {
    const container = document.getElementById('sidebar-history');
    if (!container) return;

    const history = (await window.cloudvoyager.config.loadKey('migrationHistory')) || [];

    if (history.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Show most recent first
    const sorted = [...history].reverse();

    let html = '<div class="sidebar-history-header">📜 Run History</div>';
    html += '<input type="text" class="sidebar-history-search" id="history-search" placeholder="Filter runs..." aria-label="Filter run history">';
    html += '<div class="sidebar-history-list">';

    for (const entry of sorted) {
      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const labelMap = { migrate: '🌐 Migration', transfer: '📦 Transfer', verify: '✅ Verify', 'sync-metadata': '🔄 Sync Metadata' };
      const label = labelMap[entry.command] || `📦 ${entry.command?.charAt(0).toUpperCase()}${entry.command?.slice(1) || 'Transfer'}`;
      const duration = entry.durationMs ? this.formatDuration(entry.durationMs) : '';

      html += `
        <button class="sidebar-history-item" data-history-id="${entry.id}" title="${label} — ${dateStr} ${timeStr}">
          <span class="sidebar-history-label">${label}</span>
          <span class="sidebar-history-meta">${dateStr} ${timeStr}${duration ? ' · ' + duration : ''}</span>
        </button>
      `;
    }

    html += '</div>';
    container.innerHTML = html;

    // Bind clicks
    container.querySelectorAll('.sidebar-history-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.historyId;
        const entry = history.find(e => e.id === id);
        if (entry) {
          App.navigate('results', { reportsDir: entry.reportsDir, historyEntry: entry });
        }
      });
    });

    // Search/filter
    const searchInput = container.querySelector('#history-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        container.querySelectorAll('.sidebar-history-item').forEach(item => {
          const text = item.textContent.toLowerCase();
          item.style.display = text.includes(query) ? '' : 'none';
        });
      });
    }
  },

  async addEntry(entry) {
    const history = (await window.cloudvoyager.config.loadKey('migrationHistory')) || [];
    history.push(entry);

    // Cap at MAX_ENTRIES
    while (history.length > this.MAX_ENTRIES) {
      history.shift();
    }

    await window.cloudvoyager.config.saveKey('migrationHistory', history);
    await this.refresh();
  },

  formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }
};
