/**
 * Reusable form field helpers for config wizard screens.
 */
window.ConfigForm = {
  /**
   * Create a text input field
   */
  textField(id, label, value, opts = {}) {
    const { placeholder, hint, type, required } = opts;
    const inputType = type || 'text';
    const isPassword = inputType === 'password';

    let html = `<div class="form-group">`;
    html += `<label for="${id}">${label}${required ? ' *' : ''}</label>`;

    if (isPassword) {
      html += `<div class="input-with-toggle">`;
      html += `<input type="password" id="${id}" value="${this.escapeHtml(value || '')}" placeholder="${placeholder || ''}" autocomplete="off">`;
      html += `<button type="button" class="toggle-visibility" data-target="${id}">Show</button>`;
      html += `</div>`;
    } else {
      html += `<input type="${inputType}" id="${id}" value="${this.escapeHtml(value || '')}" placeholder="${placeholder || ''}">`;
    }

    if (hint) {
      html += `<div class="hint">${hint}</div>`;
    }
    html += `</div>`;
    return html;
  },

  /**
   * Create a number input with range
   */
  numberField(id, label, value, opts = {}) {
    const { min, max, step, hint } = opts;
    let html = `<div class="form-group">`;
    html += `<label for="${id}">${label}</label>`;
    html += `<input type="number" id="${id}" value="${value ?? ''}" min="${min ?? ''}" max="${max ?? ''}" step="${step ?? 1}">`;
    if (hint) {
      html += `<div class="hint">${hint}</div>`;
    }
    html += `</div>`;
    return html;
  },

  /**
   * Create a checkbox toggle
   */
  checkbox(id, label, checked, opts = {}) {
    const { hint } = opts;
    let html = `<div class="toggle-group">`;
    html += `<input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>`;
    html += `<label for="${id}">${label}</label>`;
    html += `</div>`;
    if (hint) {
      html += `<div class="hint" style="margin-top:-10px;margin-bottom:16px">${hint}</div>`;
    }
    return html;
  },

  /**
   * Create a radio button group
   */
  radioGroup(name, label, options, selected) {
    let html = `<div class="form-group">`;
    html += `<label>${label}</label>`;
    html += `<div class="radio-group">`;
    for (const opt of options) {
      const isActive = opt.value === selected;
      html += `<label class="radio-option ${isActive ? 'active' : ''}">`;
      html += `<input type="radio" name="${name}" value="${opt.value}" ${isActive ? 'checked' : ''}>`;
      html += `${opt.label}`;
      html += `</label>`;
    }
    html += `</div></div>`;
    return html;
  },

  /**
   * Create a select dropdown
   */
  selectField(id, label, options, selected) {
    let html = `<div class="form-group">`;
    html += `<label for="${id}">${label}</label>`;
    html += `<select id="${id}">`;
    for (const opt of options) {
      html += `<option value="${opt.value}" ${opt.value === selected ? 'selected' : ''}>${opt.label}</option>`;
    }
    html += `</select></div>`;
    return html;
  },

  /**
   * Create a folder picker field
   */
  folderField(id, label, value, opts = {}) {
    const { hint } = opts;
    let html = `<div class="form-group">`;
    html += `<label for="${id}">${label}</label>`;
    html += `<div style="display:flex;gap:8px">`;
    html += `<input type="text" id="${id}" value="${this.escapeHtml(value || '')}" readonly style="flex:1">`;
    html += `<button type="button" class="btn btn-secondary btn-sm" data-folder-picker="${id}">Browse</button>`;
    html += `</div>`;
    if (hint) {
      html += `<div class="hint">${hint}</div>`;
    }
    html += `</div>`;
    return html;
  },

  /**
   * Create a summary table from key-value pairs
   */
  summaryTable(rows) {
    let html = `<table class="summary-table">`;
    for (const [key, value] of rows) {
      const displayValue = value === '' || value === undefined || value === null ? '<span style="color:var(--text-muted)">Not set</span>' : this.escapeHtml(String(value));
      html += `<tr><td>${key}</td><td>${displayValue}</td></tr>`;
    }
    html += `</table>`;
    return html;
  },

  /**
   * Collapsible section
   */
  collapsible(id, title, contentHtml, open = false) {
    let html = `<div class="collapsible-header ${open ? 'open' : ''}" data-collapse="${id}">`;
    html += `<span class="arrow">&#9654;</span> ${title}`;
    html += `</div>`;
    html += `<div id="${id}" class="collapsible-content ${open ? 'open' : ''}">`;
    html += contentHtml;
    html += `</div>`;
    return html;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Attach event listeners for interactive form elements
   */
  attachHandlers(container) {
    // Toggle password visibility
    container.querySelectorAll('.toggle-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = container.querySelector(`#${btn.dataset.target}`);
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = 'Hide';
        } else {
          input.type = 'password';
          btn.textContent = 'Show';
        }
      });
    });

    // Folder picker
    container.querySelectorAll('[data-folder-picker]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const inputId = btn.dataset.folderPicker;
        const folder = await window.cloudvoyager.dialog.selectFolder();
        if (folder) {
          container.querySelector(`#${inputId}`).value = folder;
          container.querySelector(`#${inputId}`).dispatchEvent(new Event('change'));
        }
      });
    });

    // Collapsible sections
    container.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const contentId = header.dataset.collapse;
        const content = container.querySelector(`#${contentId}`);
        header.classList.toggle('open');
        content.classList.toggle('open');
      });
    });

    // Radio group active state
    container.querySelectorAll('.radio-group').forEach(group => {
      group.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
          group.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('active'));
          radio.closest('.radio-option').classList.add('active');
        });
      });
    });
  }
};
