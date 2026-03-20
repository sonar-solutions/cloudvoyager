const Store = require('electron-store');

const schema = {
  lastCommand: {
    type: 'string',
    default: ''
  },
  transferConfig: {
    type: 'object',
    default: {
      sonarqube: { url: '', token: '', projectKey: '' },
      sonarcloud: { url: 'https://sonarcloud.io', token: '', organization: '', projectKey: '' },
      transfer: {
        mode: 'incremental',
        stateFile: './.cloudvoyager-state.json',
        batchSize: 100,
        syncAllBranches: true,
        excludeBranches: [],
        checkpoint: { enabled: true, cacheExtractions: true, cacheMaxAgeDays: 7, strictResume: false }
      },
      rateLimit: { maxRetries: 3, baseDelay: 1000, minRequestInterval: 0 },
      performance: { autoTune: false, maxConcurrency: 8, maxMemoryMB: 0 }
    }
  },
  migrateConfig: {
    type: 'object',
    default: {
      sonarqube: { url: '', token: '' },
      sonarcloud: { organizations: [] },
      transfer: {
        mode: 'incremental',
        stateFile: './.cloudvoyager-state.json',
        batchSize: 100,
        syncAllBranches: true,
        excludeBranches: [],
        checkpoint: { enabled: true, cacheExtractions: true, cacheMaxAgeDays: 7, strictResume: false }
      },
      migrate: {
        outputDir: './migration-output',
        skipIssueMetadataSync: false,
        skipHotspotMetadataSync: false,
        skipQualityProfileSync: false,
        dryRun: false
      },
      rateLimit: { maxRetries: 3, baseDelay: 1000, minRequestInterval: 0 },
      performance: { autoTune: false, maxConcurrency: 8, maxMemoryMB: 0 }
    }
  },
  envVars: {
    type: 'object',
    default: {}
  },
  reportsDir: {
    type: 'string',
    default: ''
  },
  migrationHistory: {
    type: 'array',
    default: []
  },
  ui: {
    type: 'object',
    properties: {
      theme: { type: 'string', enum: ['light', 'dark', 'system'], default: 'system' }
    },
    default: {
      windowBounds: { width: 1400, height: 850 },
      currentScreen: 'welcome',
      currentWizardStep: 0,
      theme: 'system'
    }
  }
};

let store = null;

function getStore() {
  if (!store) {
    store = new Store({
      name: 'cloudvoyager-config',
      schema,
      encryptionKey: 'cloudvoyager-desktop-v1'
    });
  }
  return store;
}

function loadConfig(key) {
  return getStore().get(key);
}

function saveConfig(key, value) {
  getStore().set(key, value);
}

function loadAll() {
  const s = getStore();
  return {
    lastCommand: s.get('lastCommand'),
    transferConfig: s.get('transferConfig'),
    migrateConfig: s.get('migrateConfig'),
    envVars: s.get('envVars'),
    reportsDir: s.get('reportsDir'),
    ui: s.get('ui')
  };
}

function saveAll(data) {
  const s = getStore();
  for (const [key, value] of Object.entries(data)) {
    s.set(key, value);
  }
}

module.exports = { getStore, loadConfig, saveConfig, loadAll, saveAll };
