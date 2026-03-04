import logger from '../../utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../utils/concurrency.js';

/**
 * Map a changelog diff entry (newStatus + newResolution) to a SonarCloud transition.
 * Returns null if no transition is needed.
 */
export function mapChangelogDiffToTransition(diffs) {
  const statusDiff = diffs.find(d => d.key === 'status');
  const resolutionDiff = diffs.find(d => d.key === 'resolution');

  const newStatus = statusDiff?.newValue;
  const newResolution = resolutionDiff?.newValue;

  if (!newStatus) return null;

  // Resolution-based transitions take priority
  if (newResolution === 'FALSE-POSITIVE') return 'falsepositive';
  if (newResolution === 'WONTFIX') return 'wontfix';

  switch (newStatus) {
    case 'CONFIRMED': return 'confirm';
    case 'REOPENED': return 'reopen';
    case 'OPEN': return 'unconfirm';
    case 'RESOLVED': return 'resolve';
    case 'CLOSED': return 'resolve';
    case 'ACCEPTED': return 'accept';
    default: return null;
  }
}

/**
 * Extract the ordered list of status transitions from a SonarQube issue changelog.
 * Only includes entries that contain a status change diff.
 */
export function extractTransitionsFromChangelog(changelog) {
  const transitions = [];
  for (const entry of changelog) {
    const diffs = entry.diffs || [];
    const hasStatusChange = diffs.some(d => d.key === 'status');
    if (!hasStatusChange) continue;

    const transition = mapChangelogDiffToTransition(diffs);
    if (transition) {
      transitions.push(transition);
    }
  }
  return transitions;
}

/**
 * Sync issue statuses, assignments, comments, and tags from SonarQube to SonarCloud.
 * For status sync, fetches the SonarQube changelog and replays all transitions in order.
 *
 * @param {string} projectKey - SonarCloud project key
 * @param {Array} sqIssues - Issues extracted from SonarQube (with comments, tags, assignments)
 * @param {import('../api-client.js').SonarCloudClient} client - SonarCloud client
 * @param {object} [options] - Performance options
 * @param {number} [options.concurrency=5] - Max concurrent issue sync operations
 * @param {object} [options.sqClient] - SonarQube client (needed for changelog-based status replay)
 * @returns {Promise<object>} Sync statistics
 */
export async function syncIssues(projectKey, sqIssues, client, options = {}) {
  const concurrency = options.concurrency || 5;
  const sqClient = options.sqClient || null;

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
        // Sync status via changelog replay (or fallback to single-transition)
        const transitioned = await syncIssueStatus(scIssue, sqIssue, client, sqClient);
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
 * Determine a single fallback transition from the current SQ status/resolution.
 * Used when no SQ client is available for changelog replay.
 */
function getFallbackTransition(sqIssue) {
  if (sqIssue.resolution === 'FALSE-POSITIVE') return 'falsepositive';
  if (sqIssue.resolution === 'WONTFIX') return 'wontfix';

  switch (sqIssue.status) {
    case 'CONFIRMED': return 'confirm';
    case 'RESOLVED':
    case 'CLOSED': return 'resolve';
    case 'ACCEPTED': return 'accept';
    case 'REOPENED': return 'reopen';
    default: return null;
  }
}

/**
 * Sync issue status by replaying the full changelog transition sequence.
 * Falls back to single-transition when no SQ client is provided.
 */
async function syncIssueStatus(scIssue, sqIssue, client, sqClient) {
  // Only transition if statuses differ
  if (scIssue.status === sqIssue.status) return false;

  // If SQ client available, replay the full changelog
  if (sqClient) {
    try {
      const changelog = await sqClient.getIssueChangelog(sqIssue.key);
      const transitions = extractTransitionsFromChangelog(changelog);

      if (transitions.length === 0) {
        // No status changes in changelog — try fallback
        return await applyFallbackTransition(scIssue, sqIssue, client);
      }

      let applied = false;
      for (const transition of transitions) {
        try {
          await client.transitionIssue(scIssue.key, transition);
          applied = true;
        } catch (error) {
          logger.debug(`Failed to apply transition '${transition}' on issue ${scIssue.key}: ${error.message}`);
        }
      }
      return applied;
    } catch (error) {
      logger.debug(`Failed to fetch changelog for issue ${sqIssue.key}, falling back to single transition: ${error.message}`);
      return await applyFallbackTransition(scIssue, sqIssue, client);
    }
  }

  // No SQ client — single-transition fallback
  return await applyFallbackTransition(scIssue, sqIssue, client);
}

/**
 * Apply a single transition based on the current SQ issue state (legacy behavior).
 */
async function applyFallbackTransition(scIssue, sqIssue, client) {
  const transition = getFallbackTransition(sqIssue);
  if (!transition) return false;

  try {
    await client.transitionIssue(scIssue.key, transition);
    return true;
  } catch (error) {
    logger.debug(`Failed to transition issue ${scIssue.key} to ${transition}: ${error.message}`);
    return false;
  }
}
