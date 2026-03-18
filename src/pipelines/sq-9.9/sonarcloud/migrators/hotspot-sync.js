import logger from '../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../shared/utils/concurrency.js';

/**
 * Map a hotspot changelog diff entry to a SonarCloud action { status, resolution }.
 * Returns null if no actionable status change is found.
 */
export function mapHotspotChangelogDiffToAction(diffs) {
  const statusDiff = diffs.find(d => d.key === 'status');
  const resolutionDiff = diffs.find(d => d.key === 'resolution');

  const newStatus = statusDiff?.newValue;
  const newResolution = resolutionDiff?.newValue;

  if (!newStatus) return null;

  // Reopened
  if (newStatus === 'TO_REVIEW') {
    return { status: 'TO_REVIEW', resolution: null };
  }

  // Reviewed with explicit resolution
  if (newStatus === 'REVIEWED') {
    return { status: 'REVIEWED', resolution: newResolution || 'SAFE' };
  }

  // In newer SQ versions, status can be SAFE/ACKNOWLEDGED/FIXED directly
  if (['SAFE', 'ACKNOWLEDGED', 'FIXED'].includes(newStatus)) {
    return { status: 'REVIEWED', resolution: newStatus };
  }

  return null;
}

/**
 * Extract the ordered list of status transitions from a SonarQube hotspot changelog.
 * Only includes entries that contain a status change diff.
 */
export function extractHotspotTransitionsFromChangelog(changelog) {
  const transitions = [];
  for (const entry of changelog) {
    const diffs = entry.diffs || [];
    const hasStatusChange = diffs.some(d => d.key === 'status');
    if (!hasStatusChange) continue;

    const action = mapHotspotChangelogDiffToAction(diffs);
    if (action) {
      transitions.push(action);
    }
  }
  return transitions;
}

/**
 * Sync hotspot statuses, assignments, and comments from SonarQube to SonarCloud.
 * For status sync, replays the SonarQube changelog transitions in order.
 *
 * @param {string} projectKey - SonarCloud project key
 * @param {Array} sqHotspots - Hotspots extracted from SonarQube (with details and changelog)
 * @param {import('../api-client.js').SonarCloudClient} client - SonarCloud client
 * @param {object} [options] - Performance options
 * @param {number} [options.concurrency=3] - Max concurrent hotspot sync operations
 * @returns {Promise<object>} Sync statistics
 */
export async function syncHotspots(projectKey, sqHotspots, client, options = {}) {
  const concurrency = options.concurrency || 3;

  const stats = {
    matched: 0,
    statusChanged: 0,
    commented: 0,
    metadataSyncCommented: 0,
    sourceLinked: 0,
    failed: 0
  };

  // Fetch all hotspots from SonarCloud for this project
  const scHotspots = await client.searchHotspots(projectKey);
  logger.info(`Found ${scHotspots.length} hotspots in SonarCloud, matching against ${sqHotspots.length} SonarQube hotspots`);

  // Build lookup map: rule + component + line -> SC hotspot
  const scHotspotMap = new Map();
  for (const hotspot of scHotspots) {
    const key = buildHotspotMatchKey(hotspot);
    if (key) {
      if (!scHotspotMap.has(key)) {
        scHotspotMap.set(key, []);
      }
      scHotspotMap.get(key).push(hotspot);
    }
  }

  // Pre-match all hotspots (sequential, fast in-memory)
  const matchedPairs = [];
  for (const sqHotspot of sqHotspots) {
    const matchKey = buildHotspotMatchKey(sqHotspot);
    if (!matchKey) continue;

    const candidates = scHotspotMap.get(matchKey);
    if (!candidates || candidates.length === 0) continue;

    const scHotspot = candidates.shift();
    matchedPairs.push({ sqHotspot, scHotspot });
  }

  stats.matched = matchedPairs.length;
  logger.info(`Matched ${matchedPairs.length} hotspots, syncing with concurrency=${concurrency}`);

  if (matchedPairs.length === 0) {
    logger.info(`Hotspot sync: ${stats.matched} matched, ${stats.statusChanged} status changed, ${stats.commented} comments, ${stats.metadataSyncCommented} metadata-sync-commented, ${stats.sourceLinked} source-linked, ${stats.failed} failed`);
    return stats;
  }

  const progressLogger = createProgressLogger('Hotspot sync', matchedPairs.length);

  await mapConcurrent(
    matchedPairs,
    async ({ sqHotspot, scHotspot }) => {
      try {
        // Sync status via changelog replay (or fallback to single transition)
        const changed = await syncHotspotStatus(scHotspot, sqHotspot, client);
        if (changed) stats.statusChanged++;

        // Sync comments
        for (const comment of (sqHotspot.comments || [])) {
          try {
            const text = `[Migrated from SonarQube] ${comment.login || 'unknown'} (${comment.createdAt || ''}): ${comment.markdown || comment.htmlText || ''}`;
            await client.addHotspotComment(scHotspot.key, text);
            stats.commented++;
          } catch (error) {
            logger.debug(`Failed to add comment to hotspot ${scHotspot.key}: ${error.message}`);
          }
        }

        // Mark hotspot as metadata-synchronized via comment
        try {
          await client.addHotspotComment(scHotspot.key, '[Metadata Synchronized] This hotspot\'s metadata has been synced from SonarQube.');
          stats.metadataSyncCommented++;
        } catch (error) {
          logger.debug(`Failed to add metadata-synchronized comment to hotspot ${scHotspot.key}: ${error.message}`);
        }

        // Add comment with link back to original SonarQube hotspot
        const sonarqubeUrl = options.sonarqubeUrl;
        const sonarqubeProjectKey = options.sonarqubeProjectKey;
        if (sonarqubeUrl && sonarqubeProjectKey) {
          try {
            const sqUrl = `${sonarqubeUrl}/security_hotspots?id=${encodeURIComponent(sonarqubeProjectKey)}&hotspots=${encodeURIComponent(sqHotspot.key)}`;
            await client.addHotspotComment(scHotspot.key, `[SonarQube Source] Original hotspot: ${sqUrl}`);
            stats.sourceLinked++;
          } catch (error) {
            logger.debug(`Failed to add source link comment to hotspot ${scHotspot.key}: ${error.message}`);
          }
        }
      } catch (error) {
        stats.failed++;
        logger.debug(`Failed to sync hotspot ${sqHotspot.key}: ${error.message}`);
      }
    },
    {
      concurrency,
      settled: true,
      onProgress: progressLogger
    }
  );

  logger.info(`Hotspot sync: ${stats.matched} matched, ${stats.statusChanged} status changed, ${stats.commented} comments, ${stats.metadataSyncCommented} metadata-sync-commented, ${stats.sourceLinked} source-linked, ${stats.failed} failed`);
  return stats;
}

/**
 * Build a match key for hotspots: rule + file + line
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
 * Sync hotspot status by replaying the full changelog transition sequence.
 * Falls back to a single transition when no changelog is available.
 */
async function syncHotspotStatus(scHotspot, sqHotspot, client) {
  // Skip if statuses and resolutions already match
  if (scHotspot.status === sqHotspot.status && (scHotspot.resolution || null) === (sqHotspot.resolution || null)) {
    return false;
  }

  // Try changelog replay if changelog is available on the hotspot
  const changelog = sqHotspot.changelog;
  if (changelog && changelog.length > 0) {
    const transitions = extractHotspotTransitionsFromChangelog(changelog);

    if (transitions.length > 0) {
      let applied = false;
      for (const action of transitions) {
        try {
          await applyHotspotAction(client, scHotspot.key, action);
          applied = true;
        } catch (error) {
          logger.debug(`Failed to apply hotspot transition ${JSON.stringify(action)} on ${scHotspot.key}: ${error.message}`);
        }
      }
      return applied;
    }
  }

  // Fallback: single transition based on current SQ state
  return await applyFallbackAction(client, scHotspot, sqHotspot);
}

/**
 * Apply a single hotspot action (status + resolution) to SonarCloud.
 */
async function applyHotspotAction(client, hotspotKey, action) {
  if (action.resolution) {
    await client.changeHotspotStatus(hotspotKey, action.status, action.resolution);
  } else {
    await client.changeHotspotStatus(hotspotKey, action.status);
  }
}

/**
 * Determine a single fallback action from the current SQ hotspot state.
 * Handles both forward (TO_REVIEW → REVIEWED) and backward (REVIEWED → TO_REVIEW) transitions,
 * as well as resolution changes.
 */
async function applyFallbackAction(client, scHotspot, sqHotspot) {
  const action = getFallbackAction(scHotspot, sqHotspot);
  if (!action) return false;

  try {
    // If we need to change resolution on an already-reviewed hotspot, reopen first
    if (action.needsReopen) {
      await client.changeHotspotStatus(scHotspot.key, 'TO_REVIEW');
    }
    await applyHotspotAction(client, scHotspot.key, action);
    return true;
  } catch (error) {
    logger.debug(`Failed to change hotspot ${scHotspot.key} status: ${error.message}`);
    return false;
  }
}

/**
 * Determine the fallback action for a hotspot based on current SQ/SC state.
 */
function getFallbackAction(scHotspot, sqHotspot) {
  const sqStatus = sqHotspot.status;
  const scStatus = scHotspot.status;

  // SQ is TO_REVIEW, SC is REVIEWED → reopen
  if (sqStatus === 'TO_REVIEW' && scStatus !== 'TO_REVIEW') {
    return { status: 'TO_REVIEW', resolution: null };
  }

  // SQ is not TO_REVIEW → need to review with resolution
  if (sqStatus !== 'TO_REVIEW') {
    const resolution = mapHotspotResolution(sqHotspot);
    if (!resolution) return null;

    // SC is already REVIEWED but with different resolution → reopen then re-review
    if (scStatus !== 'TO_REVIEW') {
      return { status: 'REVIEWED', resolution, needsReopen: true };
    }

    return { status: 'REVIEWED', resolution };
  }

  return null;
}

/**
 * Map SonarQube hotspot status/resolution to SonarCloud resolution.
 * Prioritizes explicit resolution over status-based inference.
 */
function mapHotspotResolution(sqHotspot) {
  if (sqHotspot.resolution === 'ACKNOWLEDGED') {
    return 'ACKNOWLEDGED';
  }
  if (sqHotspot.resolution === 'FIXED') {
    return 'FIXED';
  }
  if (sqHotspot.resolution === 'SAFE' || sqHotspot.status === 'REVIEWED') {
    return 'SAFE';
  }
  return null;
}
