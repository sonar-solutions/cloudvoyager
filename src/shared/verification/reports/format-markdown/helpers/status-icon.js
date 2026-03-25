// -------- Status Icon --------

/**
 * Get a status emoji icon.
 * @param {string} status
 * @returns {string}
 */
export function statusIcon(status) {
  if (status === 'pass') return '✅';
  if (status === 'fail') return '❌';
  if (status === 'skipped') return '⏭️';
  if (status === 'error') return '⚠️';
  return '❓';
}
