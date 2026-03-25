import logger from '../../../../../../shared/utils/logger.js';
import { mapVulnerabilityProbability } from './map-vulnerability-probability.js';

// -------- Main Logic --------

// Extract security hotspots and convert them to issue format for protobuf.
export async function extractHotspotsAsIssues(client, branch = null) {
  const filters = {};
  if (branch) filters.branch = branch;

  const hotspots = await client.getHotspots(filters);
  logger.info(`Extracted ${hotspots.length} security hotspots for inclusion in scanner report`);
  if (hotspots.length === 0) return [];

  const validHotspots = hotspots.filter(h => h.key && h.ruleKey && h.component);
  if (validHotspots.length < hotspots.length) {
    logger.warn(`Filtered out ${hotspots.length - validHotspots.length} hotspots missing required fields`);
  }

  return validHotspots.map(hotspot => ({
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
