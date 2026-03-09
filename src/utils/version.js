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

/**
 * Check if the parsed SQ version is at least major.minor.
 * Works for both old numbering (9.9, 10.4) and 2025.x scheme.
 * @param {{ major: number, minor: number }} version
 * @param {number} major
 * @param {number} [minor=0]
 * @returns {boolean}
 */
export function isAtLeast(version, major, minor = 0) {
  if (version.major !== major) return version.major > major;
  return version.minor >= minor;
}
