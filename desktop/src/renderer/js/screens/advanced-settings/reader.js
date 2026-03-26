/**
 * Reads advanced settings form values from the DOM into a config object.
 */
window.AdvancedSettingsReader = {

  readFromForm(container) {
    const val = (id) => container.querySelector(`#${id}`)?.value;
    const chk = (id) => container.querySelector(`#${id}`)?.checked;
    const numVal = (id, fallback) => {
      const n = parseInt(val(id), 10);
      return Number.isNaN(n) ? fallback : n;
    };

    const d = window.ADVANCED_DEFAULTS;

    return {
      rateLimit: {
        maxRetries: numVal('rl-retries', d.rateLimit.maxRetries),
        baseDelay: numVal('rl-delay', d.rateLimit.baseDelay),
        minRequestInterval: numVal('rl-interval', d.rateLimit.minRequestInterval)
      },
      performance: {
        autoTune: chk('perf-autotune') || false,
        maxConcurrency: numVal('perf-concurrency', d.performance.maxConcurrency),
        maxMemoryMB: numVal('perf-memory', d.performance.maxMemoryMB),
        sourceExtraction: { concurrency: numVal('perf-source', d.performance.sourceExtraction.concurrency) },
        hotspotExtraction: { concurrency: numVal('perf-hotspot', d.performance.hotspotExtraction.concurrency) },
        issueSync: { concurrency: numVal('perf-issue-sync', d.performance.issueSync.concurrency) },
        hotspotSync: { concurrency: numVal('perf-hotspot-sync', d.performance.hotspotSync.concurrency) },
        projectMigration: { concurrency: numVal('perf-project', d.performance.projectMigration.concurrency) },
        projectVerification: { concurrency: numVal('perf-verify', d.performance.projectVerification.concurrency) }
      },
      checkpoint: {
        enabled: chk('cp-enabled') !== false,
        cacheExtractions: chk('cp-cache') !== false,
        cacheMaxAgeDays: numVal('cp-maxage', d.checkpoint.cacheMaxAgeDays),
        strictResume: chk('cp-strict') || false
      },
      stateFile: val('cp-statefile') || d.stateFile
    };
  }
};
