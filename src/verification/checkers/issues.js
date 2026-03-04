import logger from '../../utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../utils/concurrency.js';

/**
 * Build a match key from rule + file component + line number.
 * Same logic as issue-sync.js buildMatchKey.
 */
function buildMatchKey(issue) {
  const rule = issue.rule;
  const component = issue.component || '';
  const filePath = component.includes(':') ? component.split(':').pop() : component;
  const line = issue.line || issue.textRange?.startLine || 0;
  if (!rule || !filePath) return null;
  return `${rule}|${filePath}|${line}`;
}

/**
 * Verify issues between SonarQube and SonarCloud for a project.
 *
 * @param {object} sqClient - SonarQube client (with projectKey set)
 * @param {object} scClient - SonarCloud client
 * @param {string} scProjectKey - SonarCloud project key
 * @param {object} [options] - { concurrency }
 * @returns {Promise<object>} Check result
 */
export async function verifyIssues(sqClient, scClient, scProjectKey, options = {}) {
  const concurrency = options.concurrency || 5;
  const result = {
    status: 'pass',
    sqCount: 0,
    scCount: 0,
    matched: 0,
    unmatched: 0,
    statusMismatches: [],
    assignmentMismatches: [],
    commentMismatches: [],
    tagMismatches: [],
    unsyncable: {
      typeChanges: 0,
      severityChanges: 0,
      typeChangeDetails: [],
      severityChangeDetails: []
    }
  };

  // Fetch issues from both sides
  logger.info('Fetching issues from SonarQube...');
  const sqIssues = await sqClient.getIssuesWithComments();
  result.sqCount = sqIssues.length;

  logger.info('Fetching issues from SonarCloud...');
  const scIssues = await scClient.searchIssuesWithComments(scProjectKey);
  result.scCount = scIssues.length;

  logger.info(`SQ: ${sqIssues.length} issues, SC: ${scIssues.length} issues`);

  if (sqIssues.length === 0 && scIssues.length === 0) {
    return result;
  }

  // Build SC lookup map: rule + file + line -> SC issues[]
  const scIssueMap = new Map();
  for (const issue of scIssues) {
    const key = buildMatchKey(issue);
    if (key) {
      if (!scIssueMap.has(key)) scIssueMap.set(key, []);
      scIssueMap.get(key).push(issue);
    }
  }

  // Match SQ issues to SC issues
  const matchedPairs = [];
  for (const sqIssue of sqIssues) {
    const matchKey = buildMatchKey(sqIssue);
    if (!matchKey) continue;

    const candidates = scIssueMap.get(matchKey);
    if (!candidates || candidates.length === 0) continue;

    const scIssue = candidates.shift();
    matchedPairs.push({ sqIssue, scIssue });
  }

  result.matched = matchedPairs.length;
  result.unmatched = sqIssues.length - matchedPairs.length;

  logger.info(`Matched ${matchedPairs.length}/${sqIssues.length} issues, verifying details...`);

  // Detect unsyncable type/severity changes from SQ changelogs
  const progressLogger = createProgressLogger('Issue verification', matchedPairs.length);
  await mapConcurrent(
    matchedPairs,
    async ({ sqIssue, scIssue }) => {
      // Check status match
      const sqStatus = normalizeStatus(sqIssue.status, sqIssue.resolution);
      const scStatus = normalizeStatus(scIssue.status, scIssue.resolution);
      if (sqStatus !== scStatus) {
        result.statusMismatches.push({
          sqKey: sqIssue.key,
          scKey: scIssue.key,
          rule: sqIssue.rule,
          file: (sqIssue.component || '').split(':').pop(),
          line: sqIssue.line || sqIssue.textRange?.startLine || 0,
          sqStatus: sqIssue.status,
          sqResolution: sqIssue.resolution || null,
          scStatus: scIssue.status,
          scResolution: scIssue.resolution || null
        });
      }

      // Check assignment match
      if ((sqIssue.assignee || null) !== (scIssue.assignee || null)) {
        result.assignmentMismatches.push({
          sqKey: sqIssue.key,
          scKey: scIssue.key,
          rule: sqIssue.rule,
          file: (sqIssue.component || '').split(':').pop(),
          sqAssignee: sqIssue.assignee || null,
          scAssignee: scIssue.assignee || null
        });
      }

      // Check comments — count migrated comments in SC
      const sqCommentCount = (sqIssue.comments || []).length;
      const scMigratedCommentCount = (scIssue.comments || []).filter(
        c => (c.markdown || c.htmlText || '').includes('[Migrated from SonarQube]')
      ).length;
      if (sqCommentCount > 0 && scMigratedCommentCount < sqCommentCount) {
        result.commentMismatches.push({
          sqKey: sqIssue.key,
          scKey: scIssue.key,
          rule: sqIssue.rule,
          file: (sqIssue.component || '').split(':').pop(),
          sqCommentCount,
          scMigratedCommentCount
        });
      }

      // Check tags
      const sqTags = (sqIssue.tags || []).sort();
      const scTags = (scIssue.tags || []).sort();
      if (sqTags.length > 0 && JSON.stringify(sqTags) !== JSON.stringify(scTags)) {
        result.tagMismatches.push({
          sqKey: sqIssue.key,
          scKey: scIssue.key,
          rule: sqIssue.rule,
          file: (sqIssue.component || '').split(':').pop(),
          sqTags,
          scTags
        });
      }

      // Detect unsyncable type changes (type differs between SQ and SC)
      if (sqIssue.type && scIssue.type && sqIssue.type !== scIssue.type) {
        result.unsyncable.typeChanges++;
        if (result.unsyncable.typeChangeDetails.length < 50) {
          result.unsyncable.typeChangeDetails.push({
            sqKey: sqIssue.key,
            rule: sqIssue.rule,
            file: (sqIssue.component || '').split(':').pop(),
            sqType: sqIssue.type,
            scType: scIssue.type
          });
        }
      }

      // Detect unsyncable severity changes
      if (sqIssue.severity && scIssue.severity && sqIssue.severity !== scIssue.severity) {
        result.unsyncable.severityChanges++;
        if (result.unsyncable.severityChangeDetails.length < 50) {
          result.unsyncable.severityChangeDetails.push({
            sqKey: sqIssue.key,
            rule: sqIssue.rule,
            file: (sqIssue.component || '').split(':').pop(),
            sqSeverity: sqIssue.severity,
            scSeverity: scIssue.severity
          });
        }
      }
    },
    { concurrency, settled: true, onProgress: progressLogger }
  );

  // Set overall status
  if (result.unmatched > 0 || result.statusMismatches.length > 0) {
    result.status = 'fail';
  } else if (result.assignmentMismatches.length > 0 || result.commentMismatches.length > 0 || result.tagMismatches.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Issue verification: ${result.matched} matched, ${result.unmatched} unmatched, ${result.statusMismatches.length} status mismatches, ${result.unsyncable.typeChanges} unsyncable type changes, ${result.unsyncable.severityChanges} unsyncable severity changes`);
  return result;
}

/**
 * Normalize status + resolution into a single comparable string.
 */
function normalizeStatus(status, resolution) {
  if (resolution === 'FALSE-POSITIVE') return 'FALSE-POSITIVE';
  if (resolution === 'WONTFIX') return 'WONTFIX';
  if (resolution === 'FIXED') return 'FIXED';
  return status || 'OPEN';
}
