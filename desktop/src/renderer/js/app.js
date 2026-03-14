/**
 * App — main router and initialization.
 */
window.App = {
  currentScreen: null,
  screenParams: null,

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
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 300ms';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
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

    // Load sidebar history
    SidebarHistory.refresh();

    // Start on welcome screen
    this.navigate('welcome');
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
