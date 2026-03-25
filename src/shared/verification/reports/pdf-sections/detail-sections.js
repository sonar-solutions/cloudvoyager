// -------- PDF Detail Section Aggregator --------

import { buildIssueDetails } from './helpers/issue-details.js';
import { buildMeasureDetails } from './helpers/measure-details.js';
import { buildHotspotDetails } from './helpers/hotspot-details.js';
import { buildBranchDetails, buildSettingsDetails, buildPermissionDetails } from './helpers/misc-details.js';

/**
 * Build all detail section PDF nodes for a single project's checks.
 * @param {object} c - The project's checks object
 * @param {object[]} nodes - Array to push PDF nodes into
 */
export function buildDetailSections(c, nodes) {
  buildIssueDetails(c, nodes);
  buildMeasureDetails(c, nodes);
  buildHotspotDetails(c, nodes);
  buildBranchDetails(c, nodes);
  buildSettingsDetails(c, nodes);
  buildPermissionDetails(c, nodes);
}
