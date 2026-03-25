import { mapVulnerabilityProbability } from './map-vulnerability-probability.js';

// -------- Convert Hotspot to Issue --------

/** Convert a single hotspot to issue-compatible format. */
export function convertHotspotToIssue(hotspot) {
  return {
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
  };
}
