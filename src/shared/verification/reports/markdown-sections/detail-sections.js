// -------- Detail Section Aggregator --------

import { formatIssueDetails } from './helpers/issue-details.js';
import { formatMeasureDetails } from './helpers/measure-details.js';
import { formatHotspotDetails } from './helpers/hotspot-details.js';
import { formatBranchDetails, formatSettingsDetails, formatPermissionDetails } from './helpers/misc-details.js';

/**
 * Format all detail sections for a single project's checks.
 * @param {object} c - The project's checks object
 * @param {string[]} lines - Array to push formatted lines into
 */
export function formatDetailSections(c, lines) {
  formatIssueDetails(c, lines);
  formatMeasureDetails(c, lines);
  formatHotspotDetails(c, lines);
  formatBranchDetails(c, lines);
  formatSettingsDetails(c, lines);
  formatPermissionDetails(c, lines);
}
