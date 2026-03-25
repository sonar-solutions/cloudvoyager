// -------- Verify Hotspot Pair --------

import logger from '../../../../utils/logger.js';
import { normalizeHotspotStatus } from './normalize-status.js';

/** Verify a single matched SQ ↔ SC hotspot pair. */
export async function verifyHotspotPair(sqH, scH, scClient, result) {
  const sqNorm = normalizeHotspotStatus(sqH.status, sqH.resolution);
  const scNorm = normalizeHotspotStatus(scH.status, scH.resolution);
  if (sqNorm !== scNorm) {
    result.statusMismatches.push({
      sqKey: sqH.key, scKey: scH.key, rule: sqH.ruleKey || sqH.securityCategory,
      file: (sqH.component || '').split(':').pop(), line: sqH.line || 0,
      sqStatus: sqH.status, sqResolution: sqH.resolution || null,
      scStatus: scH.status, scResolution: scH.resolution || null,
    });
  }

  // Check comments
  try {
    const sqCount = (sqH.comments || sqH.comment || []).length;
    if (sqCount > 0) {
      const scDetails = await scClient.getHotspotDetails(scH.key);
      const scMigrated = (scDetails.comment || []).filter(
        c => (c.markdown || c.htmlText || '').includes('[Migrated from SonarQube]'),
      ).length;
      if (scMigrated < sqCount) {
        result.commentMismatches.push({
          sqKey: sqH.key, scKey: scH.key, rule: sqH.ruleKey || sqH.securityCategory,
          file: (sqH.component || '').split(':').pop(), sqCommentCount: sqCount, scMigratedCommentCount: scMigrated,
        });
      }
    }
  } catch (e) { logger.debug(`Failed to fetch SC hotspot details for ${scH.key}: ${e.message}`); }

  // Unsyncable assignments
  if (sqH.assignee && sqH.assignee !== (scH.assignee || null)) {
    result.unsyncable.assignments++;
    if (result.unsyncable.assignmentDetails.length < 50) {
      result.unsyncable.assignmentDetails.push({
        sqKey: sqH.key, rule: sqH.ruleKey || sqH.securityCategory,
        file: (sqH.component || '').split(':').pop(), sqAssignee: sqH.assignee, scAssignee: scH.assignee || null,
      });
    }
  }
}
