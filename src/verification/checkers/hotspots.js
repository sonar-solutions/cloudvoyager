import logger from '../../utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../utils/concurrency.js';

/**
 * Build a match key for hotspots: ruleKey + file + line.
 * Same logic as hotspot-sync.js buildHotspotMatchKey.
 */
function buildHotspotMatchKey(hotspot) {
  const ruleKey = hotspot.ruleKey || hotspot.rule?.key || hotspot.securityCategory || '';
  const component = hotspot.component || '';
  const filePath = component.includes(':') ? component.split(':').pop() : component;
  const line = hotspot.line || hotspot.textRange?.startLine || 0;
  if (!ruleKey || !filePath) return null;
  return `${ruleKey}|${filePath}|${line}`;
}

/**
 * Verify hotspots between SonarQube and SonarCloud for a project.
 *
 * @param {object} sqClient - SonarQube client
 * @param {object} scClient - SonarCloud client
 * @param {string} scProjectKey - SonarCloud project key
 * @param {object} [options] - { concurrency }
 * @returns {Promise<object>} Check result
 */
export async function verifyHotspots(sqClient, scClient, scProjectKey, options = {}) {
  const concurrency = options.concurrency || 5;
  const result = {
    status: 'pass',
    sqCount: 0,
    scCount: 0,
    matched: 0,
    unmatched: 0,
    statusMismatches: [],
    commentMismatches: [],
    unsyncable: {
      assignments: 0,
      assignmentDetails: []
    }
  };

  // Fetch hotspots from both sides
  logger.info('Fetching hotspots from SonarQube...');
  const sqHotspots = await sqClient.getHotspots();
  result.sqCount = sqHotspots.length;

  logger.info('Fetching hotspots from SonarCloud...');
  const scHotspots = await scClient.searchHotspots(scProjectKey);
  result.scCount = scHotspots.length;

  logger.info(`SQ: ${sqHotspots.length} hotspots, SC: ${scHotspots.length} hotspots`);

  if (sqHotspots.length === 0 && scHotspots.length === 0) {
    return result;
  }

  // Build SC lookup map
  const scHotspotMap = new Map();
  for (const hotspot of scHotspots) {
    const key = buildHotspotMatchKey(hotspot);
    if (key) {
      if (!scHotspotMap.has(key)) scHotspotMap.set(key, []);
      scHotspotMap.get(key).push(hotspot);
    }
  }

  // Match SQ hotspots to SC hotspots
  const matchedPairs = [];
  for (const sqHotspot of sqHotspots) {
    const matchKey = buildHotspotMatchKey(sqHotspot);
    if (!matchKey) continue;

    const candidates = scHotspotMap.get(matchKey);
    if (!candidates || candidates.length === 0) continue;

    const scHotspot = candidates.shift();
    matchedPairs.push({ sqHotspot, scHotspot });
  }

  result.matched = matchedPairs.length;
  result.unmatched = sqHotspots.length - matchedPairs.length;

  logger.info(`Matched ${matchedPairs.length}/${sqHotspots.length} hotspots, verifying details...`);

  // Fetch SC hotspot details for comments (search only returns basic data)
  const progressLogger = createProgressLogger('Hotspot verification', matchedPairs.length);
  await mapConcurrent(
    matchedPairs,
    async ({ sqHotspot, scHotspot }) => {
      // Check status match
      const sqStatusNorm = normalizeHotspotStatus(sqHotspot.status, sqHotspot.resolution);
      const scStatusNorm = normalizeHotspotStatus(scHotspot.status, scHotspot.resolution);
      if (sqStatusNorm !== scStatusNorm) {
        result.statusMismatches.push({
          sqKey: sqHotspot.key,
          scKey: scHotspot.key,
          rule: sqHotspot.ruleKey || sqHotspot.securityCategory,
          file: (sqHotspot.component || '').split(':').pop(),
          line: sqHotspot.line || 0,
          sqStatus: sqHotspot.status,
          sqResolution: sqHotspot.resolution || null,
          scStatus: scHotspot.status,
          scResolution: scHotspot.resolution || null
        });
      }

      // Check comments — fetch SC hotspot details to get comments
      try {
        const sqCommentCount = (sqHotspot.comments || sqHotspot.comment || []).length;
        if (sqCommentCount > 0) {
          const scDetails = await scClient.getHotspotDetails(scHotspot.key);
          const scComments = scDetails.comment || [];
          const scMigratedCount = scComments.filter(
            c => (c.markdown || c.htmlText || '').includes('[Migrated from SonarQube]')
          ).length;
          if (scMigratedCount < sqCommentCount) {
            result.commentMismatches.push({
              sqKey: sqHotspot.key,
              scKey: scHotspot.key,
              rule: sqHotspot.ruleKey || sqHotspot.securityCategory,
              file: (sqHotspot.component || '').split(':').pop(),
              sqCommentCount,
              scMigratedCommentCount: scMigratedCount
            });
          }
        }
      } catch (error) {
        logger.debug(`Failed to fetch SC hotspot details for ${scHotspot.key}: ${error.message}`);
      }

      // Detect unsyncable assignments
      if (sqHotspot.assignee && sqHotspot.assignee !== (scHotspot.assignee || null)) {
        result.unsyncable.assignments++;
        if (result.unsyncable.assignmentDetails.length < 50) {
          result.unsyncable.assignmentDetails.push({
            sqKey: sqHotspot.key,
            rule: sqHotspot.ruleKey || sqHotspot.securityCategory,
            file: (sqHotspot.component || '').split(':').pop(),
            sqAssignee: sqHotspot.assignee,
            scAssignee: scHotspot.assignee || null
          });
        }
      }
    },
    { concurrency, settled: true, onProgress: progressLogger }
  );

  // Set overall status
  if (result.unmatched > 0 || result.statusMismatches.length > 0) {
    result.status = 'fail';
  } else if (result.commentMismatches.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Hotspot verification: ${result.matched} matched, ${result.unmatched} unmatched, ${result.statusMismatches.length} status mismatches, ${result.unsyncable.assignments} unsyncable assignments`);
  return result;
}

/**
 * Normalize hotspot status + resolution into a comparable string.
 */
function normalizeHotspotStatus(status, resolution) {
  if (status === 'REVIEWED' && resolution) return `REVIEWED:${resolution}`;
  if (['SAFE', 'ACKNOWLEDGED', 'FIXED'].includes(status)) return `REVIEWED:${status}`;
  return status || 'TO_REVIEW';
}
