// -------- Log Project Hotspots --------

import logger from '../../../utils/logger.js';

/**
 * Log hotspot-specific details for a project to the console.
 */
export function logProjectHotspots(hs) {
  const parts = [`${hs.matched}/${hs.sqCount} matched`];
  if (hs.unmatched > 0) parts.push(`${hs.unmatched} unmatched`);
  if (hs.scOnlyHotspots?.length > 0) parts.push(`${hs.scOnlyHotspots.length} SC-only`);
  if (hs.statusMismatches?.length > 0) parts.push(`${hs.statusMismatches.length} status mismatches`);
  if (hs.commentMismatches?.length > 0) parts.push(`${hs.commentMismatches.length} comment mismatches`);
  if (hs.unsyncable?.assignments > 0) parts.push(`${hs.unsyncable.assignments} assignment diffs (unsyncable)`);
  logger.info(`         Hotspots: ${parts.join(', ')}`);
}
