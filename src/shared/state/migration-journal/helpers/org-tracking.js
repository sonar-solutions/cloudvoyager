// -------- Organization Tracking --------

/**
 * Ensure an organization entry exists in the journal.
 * @param {object} journal - Journal data
 * @param {string} orgKey
 */
export function ensureOrgUnsafe(journal, orgKey) {
  if (!journal.organizations[orgKey]) {
    journal.organizations[orgKey] = {
      status: 'pending',
      orgWideResources: 'pending',
      projects: {},
    };
  }
}

/**
 * Check if org-wide resources are completed.
 * @param {object} journal - Journal data
 * @param {string} orgKey
 * @returns {boolean}
 */
export function isOrgWideCompleted(journal, orgKey) {
  return journal.organizations[orgKey]?.orgWideResources === 'completed';
}
