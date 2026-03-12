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

  // Resolution-based transitions take priority.
  // Also handle SonarQube 10.4+ where WONTFIX/FALSE-POSITIVE can appear as a
  // direct status value (newStatus) rather than only as a resolution.
  if (newResolution === 'FALSE-POSITIVE' || newStatus === 'FALSE-POSITIVE') return 'falsepositive';
  if (newResolution === 'WONTFIX' || newStatus === 'WONTFIX') return 'wontfix';

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
  const userMappings = options.userMappings || null;

  const stats = {
    matched: 0,
    transitioned: 0,
    assigned: 0,
    assignmentFailed: 0,
    assignmentSkipped: 0,
    assignmentMapped: 0,
    failedAssignments: [],
    commented: 0,
    tagged: 0,
    metadataSyncTagged: 0,
    sourceLinked: 0,
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
    const mappingDetail = stats.assignmentMapped > 0 ? `, ${stats.assignmentMapped} mapped` : '';
    const skipDetail = stats.assignmentSkipped > 0 ? `, ${stats.assignmentSkipped} assignment-skipped` : '';
    logger.info(`Issue sync: ${stats.matched} matched, ${stats.transitioned} transitioned, ${stats.assigned} assigned${mappingDetail}, ${stats.assignmentFailed} assignment-failed${skipDetail}, ${stats.commented} comments, ${stats.tagged} tagged, ${stats.metadataSyncTagged} metadata-sync-tagged, ${stats.sourceLinked} source-linked, ${stats.failed} failed`);
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
          // Apply user mapping if available
          const mapping = userMappings?.get(sqIssue.assignee);
          if (mapping && !mapping.include) {
            stats.assignmentSkipped++;
            logger.debug(`Skipping assignment for "${sqIssue.assignee}" (excluded in user-mappings.csv)`);
          } else {
            const targetAssignee = mapping?.scLogin || sqIssue.assignee;
            if (mapping?.scLogin) {
              stats.assignmentMapped++;
              logger.debug(`Mapping assignee "${sqIssue.assignee}" -> "${targetAssignee}" (from user-mappings.csv)`);
            }
            try {
              await client.assignIssue(scIssue.key, targetAssignee);
              stats.assigned++;
            } catch (error) {
              stats.assignmentFailed++;
              stats.failedAssignments.push({ issueKey: scIssue.key, assignee: targetAssignee, sqAssignee: sqIssue.assignee, error: error.message });
              logger.warn(`Failed to assign issue ${scIssue.key} to "${targetAssignee}": ${error.message}`);
            }
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

        // Sync tags and add metadata-synchronized marker in a single call.
        // Use sqIssue.tags as the base (not the stale scIssue.tags) so the
        // second setIssueTags call does not overwrite the tags just applied.
        try {
          const sqTags = sqIssue.tags || [];
          const baseTags = sqTags.length > 0 ? sqTags : (scIssue.tags || []);
          if (!baseTags.includes('metadata-synchronized')) {
            const updatedTags = [...new Set([...baseTags, 'metadata-synchronized'])];
            await client.setIssueTags(scIssue.key, updatedTags);
            if (sqTags.length > 0) stats.tagged++;
            stats.metadataSyncTagged++;
          } else if (sqTags.length > 0) {
            await client.setIssueTags(scIssue.key, sqTags);
            stats.tagged++;
          }
        } catch (error) {
          logger.debug(`Failed to set tags on issue ${scIssue.key}: ${error.message}`);
        }

        // Add comment with link back to original SonarQube issue
        if (sqClient && sqClient.baseURL && sqClient.projectKey) {
          try {
            const sqUrl = `${sqClient.baseURL}/project/issues?id=${encodeURIComponent(sqClient.projectKey)}&issues=${encodeURIComponent(sqIssue.key)}&open=${encodeURIComponent(sqIssue.key)}`;
            await client.addIssueComment(scIssue.key, `[SonarQube Source] Original issue: ${sqUrl}`);
            stats.sourceLinked++;
          } catch (error) {
            logger.debug(`Failed to add source link comment to issue ${scIssue.key}: ${error.message}`);
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

  const mappingDetail = stats.assignmentMapped > 0 ? `, ${stats.assignmentMapped} mapped` : '';
  const skipDetail = stats.assignmentSkipped > 0 ? `, ${stats.assignmentSkipped} assignment-skipped` : '';
  logger.info(`Issue sync: ${stats.matched} matched, ${stats.transitioned} transitioned, ${stats.assigned} assigned${mappingDetail}, ${stats.assignmentFailed} assignment-failed${skipDetail}, ${stats.commented} comments, ${stats.tagged} tagged, ${stats.metadataSyncTagged} metadata-sync-tagged, ${stats.sourceLinked} source-linked, ${stats.failed} failed`);
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
  // Check both resolution and status to handle SonarQube 10.4+ where
  // WONTFIX/FALSE-POSITIVE may appear as a direct status value.
  if (sqIssue.resolution === 'FALSE-POSITIVE' || sqIssue.status === 'FALSE-POSITIVE') return 'falsepositive';
  if (sqIssue.resolution === 'WONTFIX' || sqIssue.status === 'WONTFIX') return 'wontfix';

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
