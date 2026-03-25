// -------- Create Fresh Journal --------

const JOURNAL_VERSION = 2;

/**
 * Create a fresh checkpoint journal object.
 * @param {object} fingerprint - Session fingerprint
 * @returns {object} New journal data
 */
export function createFreshJournal(fingerprint) {
  return {
    version: JOURNAL_VERSION,
    cloudvoyagerVersion: fingerprint.cloudvoyagerVersion || 'unknown',
    sessionFingerprint: {
      ...fingerprint,
      startedAt: new Date().toISOString(),
    },
    status: 'in_progress',
    phases: {},
    branches: {},
    uploadedCeTasks: {},
  };
}
