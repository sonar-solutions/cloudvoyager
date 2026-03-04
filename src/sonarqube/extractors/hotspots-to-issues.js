import logger from '../../utils/logger.js';

/**
 * Extract security hotspots from SonarQube and convert them to issue format
 * so they can be included in the scanner report protobuf.
 *
 * SonarQube's /api/issues/search does NOT return security hotspots — they live
 * in a separate /api/hotspots/search endpoint.  However, in a real sonarscanner
 * report, hotspots are submitted as regular Issue messages (the CE infers the
 * SECURITY_HOTSPOT type from the rule definition).  This function bridges that
 * gap by fetching hotspots and returning them in the same shape as issues.
 *
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {string} [branch] - Optional branch name
 * @returns {Promise<Array>} Hotspots converted to issue-compatible objects
 */
export async function extractHotspotsAsIssues(client, branch = null) {
  const filters = {};
  if (branch) {
    filters.branch = branch;
  }

  const hotspots = await client.getHotspots(filters);
  logger.info(`Extracted ${hotspots.length} security hotspots for inclusion in scanner report`);

  if (hotspots.length === 0) return [];

  return hotspots.map(hotspot => ({
    key: hotspot.key,
    rule: hotspot.ruleKey,
    severity: mapVulnerabilityProbability(hotspot.vulnerabilityProbability),
    component: hotspot.component,
    project: hotspot.project,
    line: hotspot.line,
    textRange: hotspot.textRange || null,
    flows: hotspot.flows || [],
    status: hotspot.status,
    message: hotspot.message,
    author: hotspot.author,
    creationDate: hotspot.creationDate,
    updateDate: hotspot.updateDate,
    type: 'SECURITY_HOTSPOT',
  }));
}

/**
 * Map SonarQube vulnerability probability to a severity string.
 * This is used as the overriddenSeverity in the protobuf Issue message.
 */
function mapVulnerabilityProbability(probability) {
  switch (probability) {
    case 'HIGH': return 'CRITICAL';
    case 'MEDIUM': return 'MAJOR';
    case 'LOW': return 'MINOR';
    default: return 'MAJOR';
  }
}
