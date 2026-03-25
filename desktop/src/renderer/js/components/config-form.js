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
    const hintId = hint ? `${id}-hint` : '';
    const errorId = `${id}-error`;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ');

    let html = `<div class="form-group">`;
    html += `<label for="${id}">${required ? '<span class="required-dot" aria-hidden="true"></span>' : ''}${label}${required ? ' *' : ''}</label>`;

    const ariaAttrs = `${required ? ' aria-required="true"' : ''}${describedBy ? ` aria-describedby="${describedBy}"` : ''}`;

    if (isPassword) {
      html += `<div class="input-with-toggle">`;
      html += `<input type="password" id="${id}" value="${this.escapeHtml(value || '')}" placeholder="${placeholder || ''}" autocomplete="off"${ariaAttrs}>`;
      html += `<button type="button" class="toggle-visibility" data-target="${id}" aria-label="Toggle password visibility">Show</button>`;
      html += `</div>`;
    } else {
      html += `<input type="${inputType}" id="${id}" value="${this.escapeHtml(value || '')}" placeholder="${placeholder || ''}"${ariaAttrs}>`;
    }

    if (hint) {
      html += `<div class="hint" id="${hintId}">${hint}</div>`;
    }
    html += `<div class="error-message" id="${errorId}"></div>`;
    html += `</div>`;
    return html;
  },

  /**
   * Create a number input with range
   */
  numberField(id, label, value, opts = {}) {
    const { min, max, step, hint } = opts;
    const hintId = hint ? `${id}-hint` : '';
    let html = `<div class="form-group">`;
    html += `<label for="${id}">${label}</label>`;
    html += `<input type="number" id="${id}" value="${value ?? ''}" min="${min ?? ''}" max="${max ?? ''}" step="${step ?? 1}"${hintId ? ` aria-describedby="${hintId}"` : ''}>`;
    if (hint) {
      html += `<div class="hint" id="${hintId}">${hint}</div>`;
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
    let html = `<div class="collapsible-header ${open ? 'open' : ''}" data-collapse="${id}" role="button" tabindex="0" aria-expanded="${open}" aria-controls="${id}">`;
    html += `<span class="arrow" aria-hidden="true">&#9654;</span> ${title}`;
    html += `</div>`;
    html += `<div id="${id}" class="collapsible-content ${open ? 'open' : ''}">`;
    html += contentHtml;
    html += `</div>`;
    return html;
  },

  /**
   * Inline SVG icon helper
   */
  icon(name) {
    const icons = {
      plug: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 1v4M10 1v4M4 5h8v3a4 4 0 01-4 4 4 4 0 01-4-4V5zM8 12v3"/></svg>',
      cloud: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 13h7a3.5 3.5 0 00.5-6.965A5 5 0 003.1 8.5 3 3 0 004.5 13z"/></svg>',
      gear: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5l.7 2.1a4 4 0 011.7 1l2.1-.7.5.9-1.4 1.6a4 4 0 010 1.2l1.4 1.6-.5.9-2.1-.7a4 4 0 01-1.7 1L8 14.5l-.7-2.1a4 4 0 01-1.7-1l-2.1.7-.5-.9 1.4-1.6a4 4 0 010-1.2L2.9 6.8l.5-.9 2.1.7a4 4 0 011.7-1L8 1.5z"/></svg>',
      rocket: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1s5 2 5 8l-2 2H5L3 9c0-6 5-8 5-8zM5 11l-2 3M11 11l2 3M8 6.5v0"/><circle cx="8" cy="6.5" r="0.5" fill="currentColor"/></svg>',
      clipboard: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="2" width="10" height="13" rx="1.5"/><path d="M6 2V1.5a2 2 0 014 0V2M6 7h4M6 10h2"/></svg>',
      search: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
      folder: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4.5V12a1.5 1.5 0 001.5 1.5h9A1.5 1.5 0 0014 12V6a1.5 1.5 0 00-1.5-1.5H8L6.5 3H3.5A1.5 1.5 0 002 4.5z"/></svg>',
      'check-circle': '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M5.5 8l2 2 3-4"/></svg>',
      warning: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1.5L1 14h14L8 1.5zM8 6v4M8 12v0"/><circle cx="8" cy="12" r="0.5" fill="currentColor"/></svg>',
      trash: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M5.5 4V2.5h5V4M4.5 4v9a1 1 0 001 1h5a1 1 0 001-1V4"/></svg>',
      sync: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8a6 6 0 0110.5-4M14 8a6 6 0 01-10.5 4M12.5 2v2.5H10M3.5 14v-2.5H6"/></svg>',
      chart: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 14V6l4-4 3 3 5-3v12H2z"/></svg>',
      shield: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1.5L2.5 4v4c0 3.5 2.5 5.5 5.5 6.5 3-1 5.5-3 5.5-6.5V4L8 1.5z"/></svg>',
      history: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 4v4.5l3 1.5"/></svg>',
      globe: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5c-2 2.5-2 9.5 0 13M8 1.5c2 2.5 2 9.5 0 13"/></svg>',
      box: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 5l6-3 6 3v6l-6 3-6-3V5zM2 5l6 3M8 8v6.5M14 5l-6 3"/></svg>',
      building: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M5 5h2v2H5zM9 5h2v2H9zM5 9h2v2H5zM9 9h2v2H9z"/></svg>'
    };
    const svg = icons[name] || '';
    return `<span class="icon" aria-hidden="true" style="display:inline-flex;vertical-align:middle;margin-right:6px">${svg}</span>`;
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
   * Validate org entries — at least one org required, each with valid fields
   */
  validateOrgs(container) {
    const errors = [];
    this.clearErrors(container);

    const orgEntries = container.querySelectorAll('.org-entry');

    // Must have at least one organization
    if (orgEntries.length === 0) {
      errors.push('At least one organization is required');
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Please add at least one SonarCloud organization', 'error');
      }
      return { valid: false, errors };
    }

    // Validate required fields within each org entry
    orgEntries.forEach((entry) => {
      const idx = entry.dataset.orgIndex;
      entry.querySelectorAll('.form-group').forEach(group => {
        const input = group.querySelector('input');
        if (!input) return;

        const label = group.querySelector('label')?.textContent?.replace(' *', '') || input.id;
        const value = input.value.trim();

        if (input.getAttribute('aria-required') === 'true' && !value) {
          errors.push(`Organization ${Number(idx) + 1}: ${label} is required`);
          this.setFieldError(group, `${label} is required`);
        }
      });
    });

    return { valid: errors.length === 0, errors };
  },

  /**
   * Validate form fields in a container
   */
  validate(container) {
    const errors = [];
    this.clearErrors(container);

    container.querySelectorAll('.form-group').forEach(group => {
      const input = group.querySelector('input, select');
      if (!input) return;

      const label = group.querySelector('label')?.textContent?.replace(' *', '') || input.id;
      const value = input.value.trim();

      // Check required
      if (input.id && group.querySelector('label')?.textContent?.includes('*') && !value) {
        errors.push(`${label} is required`);
        this.setFieldError(group, `${label} is required`);
        return;
      }

      // URL validation
      if (value && (input.id.includes('url') || input.id.includes('URL'))) {
        if (!/^https?:\/\/.+/.test(value)) {
          errors.push(`${label} must start with http:// or https://`);
          this.setFieldError(group, 'Must start with http:// or https://');
          return;
        }
      }

      // Token min length
      if (value && input.type === 'password' && value.length < 3) {
        errors.push(`${label} is too short`);
        this.setFieldError(group, 'Token is too short');
        return;
      }
    });

    return { valid: errors.length === 0, errors };
  },

  /**
   * Set error on a form group
   */
  setFieldError(group, message) {
    group.classList.add('has-error');
    let errEl = group.querySelector('.error-message');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'error-message';
      group.appendChild(errEl);
    }
    errEl.textContent = message;
    errEl.style.display = 'block';
  },

  /**
   * Clear all validation errors
   */
  clearErrors(container) {
    container.querySelectorAll('.form-group.has-error').forEach(group => {
      group.classList.remove('has-error');
      const errEl = group.querySelector('.error-message');
      if (errEl) errEl.style.display = 'none';
    });
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
      const toggle = () => {
        const contentId = header.dataset.collapse;
        const content = container.querySelector(`#${contentId}`);
        header.classList.toggle('open');
        content.classList.toggle('open');
        header.setAttribute('aria-expanded', header.classList.contains('open'));
      };
      header.addEventListener('click', toggle);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
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
