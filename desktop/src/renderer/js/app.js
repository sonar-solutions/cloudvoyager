/**
 * App — main router and initialization.
 */
window.App = {
  currentScreen: null,
  screenParams: null,

  theme: {
    current: 'system',

    async init() {
      const saved = await window.cloudvoyager.config.loadKey('ui.theme');
      this.current = saved || 'system';
      await this.apply();

      // Listen for OS theme changes
      if (window.cloudvoyager.theme) {
        window.cloudvoyager.theme.onSystemChange((isDark) => {
          if (this.current === 'system') {
            this.setThemeAttribute(isDark ? 'dark' : 'light');
          }
        });
      }
    },

    async apply() {
      if (this.current === 'system') {
        let isDark = true; // default
        if (window.cloudvoyager.theme) {
          isDark = await window.cloudvoyager.theme.getSystem();
        }
        this.setThemeAttribute(isDark ? 'dark' : 'light');
      } else {
        this.setThemeAttribute(this.current);
      }
      this.updateToggleIcon();
    },

    setThemeAttribute(theme) {
      document.documentElement.dataset.theme = theme;
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) meta.content = theme;
    },

    async setPreference(mode) {
      this.current = mode;
      await window.cloudvoyager.config.saveKey('ui.theme', mode);
      await this.apply();
    },

    cycle() {
      const order = ['system', 'light', 'dark'];
      const next = order[(order.indexOf(this.current) + 1) % order.length];
      this.setPreference(next);
    },

    updateToggleIcon() {
      const btn = document.getElementById('btn-theme');
      if (!btn) return;
      const icons = { system: 'monitor', light: 'sun', dark: 'moon' };
      const labels = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };
      const svgs = {
        monitor: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="9" rx="1"/><line x1="8" y1="11" x2="8" y2="14"/><line x1="5" y1="14" x2="11" y2="14"/></svg>',
        sun: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="15"/><line x1="1" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="15" y2="8"/><line x1="3.05" y1="3.05" x2="4.46" y2="4.46"/><line x1="11.54" y1="11.54" x2="12.95" y2="12.95"/><line x1="3.05" y1="12.95" x2="4.46" y2="11.54"/><line x1="11.54" y1="4.46" x2="12.95" y2="3.05"/></svg>',
        moon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 8.5a5.5 5.5 0 0 1-7-7 5.5 5.5 0 1 0 7 7z"/></svg>'
      };
      btn.innerHTML = svgs[icons[this.current]];
      btn.title = labels[this.current];
      btn.setAttribute('aria-label', labels[this.current]);
    }
  },

  screens: {
    'welcome': () => WelcomeScreen.render(App.getContent()),
    'transfer-config': () => TransferConfigScreen.render(App.getContent()),
    'migrate-config': () => MigrateConfigScreen.render(App.getContent()),
    'verify-config': () => VerifyConfigScreen.render(App.getContent()),
    'sync-metadata-config': () => SyncMetadataConfigScreen.render(App.getContent()),
    'connection-test': () => ConnectionTestScreen.render(App.getContent(), App.screenParams),
    'execution': () => ExecutionScreen.render(App.getContent(), App.screenParams),
    'results': () => ResultsScreen.render(App.getContent(), App.screenParams),
    'status': () => StatusScreen.render(App.getContent()),
    'reset': () => StatusScreen.render(App.getContent()) // Reset is part of status screen
  },

  getContent() {
    return document.getElementById('content');
  },

  navigate(screen, params) {
    // Cleanup IPC listeners from the previous screen before switching
    this.cleanupCurrentScreen();

    this.currentScreen = screen;
    this.screenParams = params || null;

    const renderFn = this.screens[screen];
    if (renderFn) {
      renderFn();
      // Add screen-enter animation
      const contentEl = this.getContent();
      contentEl.classList.add('screen-enter');
      setTimeout(() => contentEl.classList.remove('screen-enter'), 200);
      // Move focus to the main content heading for screen reader users
      requestAnimationFrame(() => {
        const heading = this.getContent().querySelector('h1, h2');
        if (heading) {
          heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: false });
        }
      });
    } else {
      this.getContent().innerHTML = `<p style="color:var(--danger)">Unknown screen: ${screen}</p>`;
    }

    // Save current screen
    window.cloudvoyager.config.saveKey('ui.currentScreen', screen);
  },

  cleanupCurrentScreen() {
    const screensWithCleanup = [
      typeof ExecutionScreen !== 'undefined' && ExecutionScreen,
      typeof ConnectionTestScreen !== 'undefined' && ConnectionTestScreen,
      typeof StatusScreen !== 'undefined' && StatusScreen
    ];
    for (const s of screensWithCleanup) {
      if (s && typeof s.cleanup === 'function') s.cleanup();
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 300ms';
      setTimeout(() => toast.remove(), 300);
    });
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 300ms';
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  },

  showConfirmDialog(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);

    overlay.innerHTML = `
      <div class="dialog-box">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="button-row right">
          <button class="btn btn-secondary" id="dialog-cancel">Cancel</button>
          <button class="btn btn-danger" id="dialog-confirm">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const confirmBtn = overlay.querySelector('#dialog-confirm');
    const cancelBtn = overlay.querySelector('#dialog-cancel');

    // Focus trap
    const focusableEls = overlay.querySelectorAll('button');
    const firstFocusable = focusableEls[0];
    const lastFocusable = focusableEls[focusableEls.length - 1];
    confirmBtn.focus();

    const trapFocus = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        } else if (!e.shiftKey && document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
      if (e.key === 'Escape') {
        close();
      }
    };

    const close = () => {
      overlay.removeEventListener('keydown', trapFocus);
      overlay.remove();
    };

    overlay.addEventListener('keydown', trapFocus);
    cancelBtn.addEventListener('click', close);
    confirmBtn.addEventListener('click', () => {
      close();
      if (onConfirm) onConfirm();
    });
  },

  async init() {
    // Display version
    try {
      const version = await window.cloudvoyager.app.getVersion();
      document.getElementById('app-version').textContent = `v${version}`;
    } catch {
      document.getElementById('app-version').textContent = '';
    }

    // Home button
    document.getElementById('btn-home').addEventListener('click', () => {
      this.navigate('welcome');
    });

    // Theme toggle
    document.getElementById('btn-theme')?.addEventListener('click', () => App.theme.cycle());
    await App.theme.init();

    // Load sidebar history
    SidebarHistory.refresh();

    // Start on welcome screen
    this.navigate('welcome');
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
