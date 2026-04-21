// -------- Normalize Issue Status --------

/**
 * Normalize status + resolution into a single comparable string.
 * SonarQube uses FALSE_POSITIVE (underscore), SonarCloud may use FALSE-POSITIVE (hyphen).
 */
export function normalizeStatus(status, resolution) {
  const normalizedResolution = resolution ? resolution.replaceAll('-', '_') : resolution;
  if (normalizedResolution === 'FALSE_POSITIVE') return 'FALSE_POSITIVE';
  if (normalizedResolution === 'ACCEPTED') return 'WONTFIX';
  if (normalizedResolution === 'WONTFIX') return 'WONTFIX';
  if (normalizedResolution === 'FIXED') return 'FIXED';
  return status || 'OPEN';
}
