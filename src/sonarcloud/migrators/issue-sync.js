import logger from '../../utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../utils/concurrency.js';

/**
 * Map SonarQube issue statuses to SonarCloud transitions
 */
const STATUS_TRANSITION_MAP = {
  'CONFIRMED': 'confirm',
  'RESOLVED': 'resolve',
  'CLOSED': 'resolve',
  'ACCEPTED': 'accept',
  // Resolutions
  'FALSE-POSITIVE': 'falsepositive',
  'WONTFIX': 'wontfix'
};

/**
 * Sync issue statuses, assignments, comments, and tags from SonarQube to SonarCloud
 * After scanner report creates issues in SonarCloud, match them with SonarQube issues
 * and sync metadata.
 *
 * @param {string} projectKey - SonarCloud project key
 * @param {Array} sqIssues - Issues extracted from SonarQube (with comments, tags, assignments)
 * @param {import('../api-client.js').SonarCloudClient} client - SonarCloud client
 * @param {object} [options] - Performance options
 * @param {number} [options.concurrency=5] - Max concurrent issue sync operations
 * @returns {Promise<object>} Sync statistics
 */
export async function syncIssues(projectKey, sqIssues, client, options = {}) {
  const concurrency = options.concurrency || 5;

  const stats = {
    matched: 0,
    transitioned: 0,
    assigned: 0,
    commented: 0,
    tagged: 0,
    failed: 0
  };

  // Fetch all issues from SonarCloud for this project
  const scIssues = await client.searchIssues(projectKey);
  logger.info(`Found ${scIssues.length} issues in SonarCloud, matching against ${sqIssues.length} SonarQube issues`);

  // Build lookup map: rule + component + line -> SC issue
  const scIssueMap = new Map();
  for (const issue of scIssues) {
    const key = buildMatchKey(issue);
    if (key) {
      // Store as array since multiple issues can match the same location
      if (!scIssueMap.has(key)) {
        scIssueMap.set(key, []);
      }
      scIssueMap.get(key).push(issue);
    }
  }

  // Pre-match all issues (sequential, fast in-memory)
  const matchedPairs = [];
  for (const sqIssue of sqIssues) {
    const matchKey = buildMatchKey(sqIssue);
    if (!matchKey) continue;

    const candidates = scIssueMap.get(matchKey);
    if (!candidates || candidates.length === 0) continue;

    // Use the first unmatched candidate
    const scIssue = candidates.shift();
    matchedPairs.push({ sqIssue, scIssue });
  }

  stats.matched = matchedPairs.length;
  logger.info(`Matched ${matchedPairs.length} issues, syncing with concurrency=${concurrency}`);

  if (matchedPairs.length === 0) {
    logger.info(`Issue sync: ${stats.matched} matched, ${stats.transitioned} transitioned, ${stats.assigned} assigned, ${stats.commented} comments, ${stats.tagged} tagged, ${stats.failed} failed`);
    return stats;
  }

  const progressLogger = createProgressLogger('Issue sync', matchedPairs.length);

  await mapConcurrent(
    matchedPairs,
    async ({ sqIssue, scIssue }) => {
      try {
        // Sync status
        const transitioned = await syncIssueStatus(scIssue, sqIssue, client);
        if (transitioned) stats.transitioned++;

        // Sync assignment
        if (sqIssue.assignee && sqIssue.assignee !== scIssue.assignee) {
          try {
            await client.assignIssue(scIssue.key, sqIssue.assignee);
            stats.assigned++;
          } catch (error) {
            logger.debug(`Failed to assign issue ${scIssue.key}: ${error.message}`);
          }
        }

        // Sync comments
        const comments = sqIssue.comments || [];
        for (const comment of comments) {
          try {
            const text = `[Migrated from SonarQube] ${comment.login || 'unknown'} (${comment.createdAt || ''}): ${comment.markdown || comment.htmlText || ''}`;
            await client.addIssueComment(scIssue.key, text);
            stats.commented++;
          } catch (error) {
            logger.debug(`Failed to add comment to issue ${scIssue.key}: ${error.message}`);
          }
        }

        // Sync tags
        if (sqIssue.tags && sqIssue.tags.length > 0) {
          try {
            await client.setIssueTags(scIssue.key, sqIssue.tags);
            stats.tagged++;
          } catch (error) {
            logger.debug(`Failed to set tags on issue ${scIssue.key}: ${error.message}`);
          }
        }
      } catch (error) {
        stats.failed++;
        logger.debug(`Failed to sync issue ${sqIssue.key}: ${error.message}`);
      }
    },
    {
      concurrency,
      settled: true,
      onProgress: progressLogger
    }
  );

  logger.info(`Issue sync: ${stats.matched} matched, ${stats.transitioned} transitioned, ${stats.assigned} assigned, ${stats.commented} comments, ${stats.tagged} tagged, ${stats.failed} failed`);
  return stats;
}

/**
 * Build a match key from rule + file component + line number
 */
function buildMatchKey(issue) {
  const rule = issue.rule;
  // Extract just the file path from the component key
  const component = issue.component || '';
  const filePath = component.includes(':') ? component.split(':').pop() : component;
  const line = issue.line || issue.textRange?.startLine || 0;

  if (!rule || !filePath) return null;
  return `${rule}|${filePath}|${line}`;
}

/**
 * Sync issue status using appropriate transition
 */
async function syncIssueStatus(scIssue, sqIssue, client) {
  // Only transition if statuses differ
  if (scIssue.status === sqIssue.status) return false;

  // Determine the appropriate transition
  let transition = null;

  if (sqIssue.resolution === 'FALSE-POSITIVE') {
    transition = 'falsepositive';
  } else if (sqIssue.resolution === 'WONTFIX') {
    transition = 'wontfix';
  } else if (sqIssue.status === 'CONFIRMED') {
    transition = 'confirm';
  } else if (sqIssue.status === 'RESOLVED' || sqIssue.status === 'CLOSED') {
    transition = 'resolve';
  } else if (sqIssue.status === 'ACCEPTED') {
    transition = 'accept';
  } else {
    transition = STATUS_TRANSITION_MAP[sqIssue.status] || null;
  }

  if (!transition) return false;

  try {
    await client.transitionIssue(scIssue.key, transition);
    return true;
  } catch (error) {
    logger.debug(`Failed to transition issue ${scIssue.key} to ${transition}: ${error.message}`);
    return false;
  }
}
