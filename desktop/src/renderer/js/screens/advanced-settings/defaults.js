/**
 * Sensible default values for advanced configuration settings.
 */
window.ADVANCED_DEFAULTS = {

  // -------- Request Throttling --------
  rateLimit: {
    maxRetries: 3,
    baseDelay: 1000,
    minRequestInterval: 0
  },

  // -------- Speed & Resources --------
  performance: {
    autoTune: true,
    maxConcurrency: 64,
    maxMemoryMB: 8192,
    sourceExtraction: { concurrency: 50 },
    hotspotExtraction: { concurrency: 50 },
    issueSync: { concurrency: 20 },
    hotspotSync: { concurrency: 20 },
    projectMigration: { concurrency: 8 },
    projectVerification: { concurrency: 3 }
  },

  // -------- Progress Recovery --------
  checkpoint: {
    enabled: true,
    cacheExtractions: true,
    cacheMaxAgeDays: 7,
    strictResume: false
  },

  stateFile: './.cloudvoyager-state.json'
};
