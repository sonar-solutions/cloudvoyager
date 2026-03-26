// -------- Main Logic --------

/**
 * Deduplicates an array of SonarQube results by their unique key.
 * Issues use `key`, hotspots use `key` as well.
 *
 * @param {Array} results - Array of result objects
 * @returns {Array} Deduplicated results
 */
export function deduplicateResults(results) {
  const seen = new Map();

  for (const item of results) {
    const key = item.key || item.id;
    if (key && !seen.has(key)) {
      seen.set(key, item);
    }
  }

  return Array.from(seen.values());
}
