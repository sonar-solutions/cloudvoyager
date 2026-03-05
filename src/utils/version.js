/**
 * SonarQube version parsing and feature detection utilities.
 */

/**
 * Parse a SonarQube version string (e.g., "9.9.0.12345", "10.4.1") into
 * a comparable object.
 * @param {string} versionStr
 * @returns {{ major: number, minor: number, patch: number, raw: string }}
 */
export function parseSonarQubeVersion(versionStr) {
  const raw = versionStr || 'unknown';
  const match = raw.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return { major: 0, minor: 0, patch: 0, raw };
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3] || '0', 10),
    raw
  };
}

/**
 * Check if the SQ version has Clean Code taxonomy support (10.0+).
 * Clean Code attributes, impacts, and software qualities were introduced
 * in SonarQube 10.0.
 * @param {{ major: number }} version - Parsed version
 * @returns {boolean}
 */
export function hasCleanCodeTaxonomy(version) {
  return version.major >= 10;
}
