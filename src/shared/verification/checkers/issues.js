import logger from '../../utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../utils/concurrency.js';
// Import from sq-10.4 pipeline — this function is identical across all pipelines
import { extractTransitionsFromChangelog } from '../../../pipelines/sq-10.4/sonarcloud/migrators/issue-sync.js';

/**
 * Normalize a rule key for matching.
 * SC external issues use "external_<engineId>:<ruleId>" while SQ uses "<engineId>:<ruleId>".
 * Strip the "external_" prefix so both sides produce the same key.
 */
function normalizeRule(rule) {
  if (!rule) return rule;
  return rule.startsWith('external_') ? rule.slice('external_'.length) : rule;
}

/**
 * Build a match key from rule + file component + line number.
 * Same logic as issue-sync.js buildMatchKey.
 * Rule keys are normalized so SQ "mulesoft:X" matches SC "external_mulesoft:X".
 */
function buildMatchKey(issue) {
  const rule = normalizeRule(issue.rule);
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
    statusHistoryMismatches: [],
    assignmentMismatches: [],
    commentMismatches: [],
    tagMismatches: [],
    typeBreakdown: { sq: {}, sc: {} },
    severityBreakdown: { sq: {}, sc: {} },
    unmatchedSqIssues: [],
    scOnlyIssues: [],
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

  // Compute type and severity breakdowns
  for (const issue of sqIssues) {
    const type = issue.type || 'UNKNOWN';
    const severity = issue.severity || 'UNKNOWN';
    result.typeBreakdown.sq[type] = (result.typeBreakdown.sq[type] || 0) + 1;
    result.severityBreakdown.sq[severity] = (result.severityBreakdown.sq[severity] || 0) + 1;
  }
  for (const issue of scIssues) {
    const type = issue.type || 'UNKNOWN';
    const severity = issue.severity || 'UNKNOWN';
    result.typeBreakdown.sc[type] = (result.typeBreakdown.sc[type] || 0) + 1;
    result.severityBreakdown.sc[severity] = (result.severityBreakdown.sc[severity] || 0) + 1;
  }

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
  const matchedSqKeys = new Set();
  for (const sqIssue of sqIssues) {
    const matchKey = buildMatchKey(sqIssue);
    if (!matchKey) continue;

    const candidates = scIssueMap.get(matchKey);
    if (!candidates || candidates.length === 0) continue;

    const scIssue = candidates.shift();
    matchedPairs.push({ sqIssue, scIssue });
    matchedSqKeys.add(sqIssue.key);
  }

  result.matched = matchedPairs.length;

  // Classify unmatched SQ issues: separate "rule not in SC" from genuine mismatches.
  // If ALL SQ issues for a given rule are unmatched (SC has 0 for that rule),
  // it's likely a rule that doesn't exist in SC or was reclassified (issue↔hotspot).
  const matchedRules = new Set(matchedPairs.map(p => normalizeRule(p.sqIssue.rule)));
  const scRules = new Set(scIssues.map(i => normalizeRule(i.rule)));

  const MAX_UNMATCHED_DETAILS = 200;
  let genuineUnmatched = 0;
  let ruleNotInSc = 0;
  for (const sqIssue of sqIssues) {
    if (matchedSqKeys.has(sqIssue.key)) continue;
    const normRule = normalizeRule(sqIssue.rule);
    // Rule doesn't exist at all in SC (not even partially matched) — expected platform difference
    if (!matchedRules.has(normRule) && !scRules.has(normRule)) {
      ruleNotInSc++;
      continue;
    }
    genuineUnmatched++;
    if (result.unmatchedSqIssues.length >= MAX_UNMATCHED_DETAILS) continue;
    result.unmatchedSqIssues.push({
      sqKey: sqIssue.key,
      rule: sqIssue.rule,
      file: (sqIssue.component || '').split(':').pop(),
      line: sqIssue.line || sqIssue.textRange?.startLine || 0,
      type: sqIssue.type || 'UNKNOWN',
      severity: sqIssue.severity || 'UNKNOWN',
      message: (sqIssue.message || '').slice(0, 120)
    });
  }
  result.unmatched = genuineUnmatched;
  result.ruleNotInSc = ruleNotInSc;

  // Track SC-only issues (issues in SC with no SQ match) — same classification
  const sqRules = new Set(sqIssues.map(i => normalizeRule(i.rule)));
  const remainingSc = [];
  scIssueMap.forEach(candidates => {
    for (const issue of candidates) remainingSc.push(issue);
  });
  let genuineScOnly = 0;
  for (const scIssue of remainingSc) {
    const normRule = normalizeRule(scIssue.rule);
    if (!matchedRules.has(normRule) && !sqRules.has(normRule)) continue;
    genuineScOnly++;
    if (result.scOnlyIssues.length >= MAX_UNMATCHED_DETAILS) continue;
    result.scOnlyIssues.push({
      scKey: scIssue.key,
      rule: scIssue.rule,
      file: (scIssue.component || '').split(':').pop(),
      line: scIssue.line || scIssue.textRange?.startLine || 0,
      type: scIssue.type || 'UNKNOWN',
      severity: scIssue.severity || 'UNKNOWN',
      message: (scIssue.message || '').slice(0, 120)
    });
  }

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

      // Check status history (changelog transitions)
      try {
        const sqChangelog = await sqClient.getIssueChangelog(sqIssue.key);
        const sqTransitions = extractTransitionsFromChangelog(sqChangelog);
        if (sqTransitions.length > 0) {
          const scChangelog = await scClient.getIssueChangelog(scIssue.key);
          const scTransitions = extractTransitionsFromChangelog(scChangelog);
          // Check that every SQ transition appears in SC in order
          let scIdx = 0;
          const missingTransitions = [];
          for (const sqT of sqTransitions) {
            let found = false;
            while (scIdx < scTransitions.length) {
              if (scTransitions[scIdx] === sqT) { found = true; scIdx++; break; }
              scIdx++;
            }
            if (!found) missingTransitions.push(sqT);
          }
          if (missingTransitions.length > 0) {
            result.statusHistoryMismatches.push({
              sqKey: sqIssue.key,
              scKey: scIssue.key,
              rule: sqIssue.rule,
              file: (sqIssue.component || '').split(':').pop(),
              line: sqIssue.line || sqIssue.textRange?.startLine || 0,
              sqTransitions,
              scTransitions,
              missingTransitions
            });
          }
        }
      } catch (error) {
        logger.debug(`Failed to compare changelogs for issue ${sqIssue.key}: ${error.message}`);
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

      // Check tags — only flag if SQ tags are missing from SC.
      // SC may add its own tags (e.g. "type-dependent") which is expected.
      // Skip tag check for external issues (SC external issues don't preserve tags).
      const isExternal = (scIssue.rule || '').startsWith('external_');
      const sqTags = (sqIssue.tags || []).sort();
      const scTags = (scIssue.tags || []).sort();
      if (sqTags.length > 0 && !isExternal) {
        const scTagSet = new Set(scTags);
        const missingSqTags = sqTags.filter(t => !scTagSet.has(t));
        if (missingSqTags.length > 0) {
          result.tagMismatches.push({
            sqKey: sqIssue.key,
            scKey: scIssue.key,
            rule: sqIssue.rule,
            file: (sqIssue.component || '').split(':').pop(),
            sqTags,
            scTags,
            missingTags: missingSqTags
          });
        }
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
  if (result.unmatched > 0 || result.statusMismatches.length > 0 || result.statusHistoryMismatches.length > 0) {
    result.status = 'fail';
  } else if (result.assignmentMismatches.length > 0 || result.commentMismatches.length > 0 || result.tagMismatches.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Issue verification: ${result.matched} matched, ${result.unmatched} unmatched, ${result.statusMismatches.length} status mismatches, ${result.statusHistoryMismatches.length} status history mismatches, ${result.unsyncable.typeChanges} unsyncable type changes, ${result.unsyncable.severityChanges} unsyncable severity changes`);
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
