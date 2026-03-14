/**
 * Log viewer component with ANSI color support and auto-scroll.
 */
window.LogViewer = {
  MAX_LINES: 50000,
  lines: [],
  autoScroll: true,
  container: null,
  outputEl: null,
  countEl: null,

  create(parentEl) {
    this.lines = [];
    this.autoScroll = true;

    parentEl.innerHTML = `
      <div class="log-container">
        <div class="log-toolbar">
          <div class="log-toolbar-left">
            <span class="log-count" id="log-count">0 lines</span>
          </div>
          <div class="log-toolbar-right">
            <label style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px">
              <input type="checkbox" id="log-autoscroll" checked style="width:14px;height:14px">
              Auto-scroll
            </label>
            <button class="btn btn-secondary btn-sm" id="log-clear">Clear</button>
            <button class="btn btn-secondary btn-sm" id="log-save">Save Logs</button>
          </div>
        </div>
        <div class="log-output" id="log-output"></div>
      </div>
    `;

    this.container = parentEl.querySelector('.log-container');
    this.outputEl = parentEl.querySelector('#log-output');
    this.countEl = parentEl.querySelector('#log-count');

    // Auto-scroll toggle
    parentEl.querySelector('#log-autoscroll').addEventListener('change', (e) => {
      this.autoScroll = e.target.checked;
    });

    // Detect manual scroll
    this.outputEl.addEventListener('scroll', () => {
      const el = this.outputEl;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
      if (!isAtBottom && this.autoScroll) {
        this.autoScroll = false;
        parentEl.querySelector('#log-autoscroll').checked = false;
      }
    });

    // Clear
    parentEl.querySelector('#log-clear').addEventListener('click', () => {
      this.clear();
    });

    // Save
    parentEl.querySelector('#log-save').addEventListener('click', () => {
      this.saveToFile();
    });

    return this;
  },

  addLine(data) {
    if (this.lines.length >= this.MAX_LINES) {
      this.lines.shift();
      if (this.outputEl.firstChild) {
        this.outputEl.removeChild(this.outputEl.firstChild);
      }
    }

    this.lines.push(data);

    const lineEl = document.createElement('div');
    lineEl.className = `log-line ${data.stream === 'stderr' ? 'stderr' : ''}`;

    const html = this.convertAnsi(data.line);
    lineEl.innerHTML = html;

    this.outputEl.appendChild(lineEl);
    this.countEl.textContent = `${this.lines.length} lines`;

    if (this.autoScroll) {
      this.outputEl.scrollTop = this.outputEl.scrollHeight;
    }
  },

  clear() {
    this.lines = [];
    this.outputEl.innerHTML = '';
    this.countEl.textContent = '0 lines';
  },

  saveToFile() {
    const text = this.lines.map(l => l.line).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudvoyager-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  },

  getRawText() {
    return this.lines.map(l => l.line).join('\n');
  },

  /**
   * Basic ANSI escape code to HTML conversion.
   * Handles common color codes from Winston.
   */
  convertAnsi(text) {
    // Escape HTML first
    let safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Replace ANSI codes with spans
    const ansiMap = {
      '30': 'ansi-gray', '31': 'ansi-red', '32': 'ansi-green',
      '33': 'ansi-yellow', '34': 'ansi-blue', '35': 'ansi-magenta',
      '36': 'ansi-cyan', '37': 'ansi-white', '1': 'ansi-bold',
      '90': 'ansi-gray'
    };

    // Track open spans to avoid mismatch
    let openSpans = 0;

    // Match \x1b[<code>m patterns
    safe = safe.replace(/\x1b\[([0-9;]+)m/g, (match, codes) => {
      if (codes === '0' || codes === '39') {
        if (openSpans > 0) {
          openSpans--;
          return '</span>';
        }
        return '';
      }
      const classes = codes.split(';').map(c => ansiMap[c]).filter(Boolean).join(' ');
      if (classes) {
        openSpans++;
        return `<span class="${classes}">`;
      }
      return '';
    });

    // Close any unclosed spans
    while (openSpans > 0) {
      safe += '</span>';
      openSpans--;
    }

    // Clean up any remaining escape sequences
    safe = safe.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

    return safe;
  }
};
