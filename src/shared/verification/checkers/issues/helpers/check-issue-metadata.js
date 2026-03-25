// -------- Check Issue Metadata --------

/** Check assignment mismatch between SQ and SC issue. */
export function checkAssignment(sqIssue, scIssue, result) {
  if ((sqIssue.assignee || null) !== (scIssue.assignee || null)) {
    result.assignmentMismatches.push({
      sqKey: sqIssue.key, scKey: scIssue.key, rule: sqIssue.rule,
      file: (sqIssue.component || '').split(':').pop(),
      sqAssignee: sqIssue.assignee || null, scAssignee: scIssue.assignee || null,
    });
  }
}

/** Check comment mismatch between SQ and SC issue. */
export function checkComments(sqIssue, scIssue, result) {
  const sqCount = (sqIssue.comments || []).length;
  const scMigrated = (scIssue.comments || []).filter(
    c => (c.markdown || c.htmlText || '').includes('[Migrated from SonarQube]'),
  ).length;
  if (sqCount > 0 && scMigrated < sqCount) {
    result.commentMismatches.push({
      sqKey: sqIssue.key, scKey: scIssue.key, rule: sqIssue.rule,
      file: (sqIssue.component || '').split(':').pop(),
      sqCommentCount: sqCount, scMigratedCommentCount: scMigrated,
    });
  }
}

/** Check tag mismatch between SQ and SC issue. */
export function checkTags(sqIssue, scIssue, result) {
  const isExternal = (scIssue.rule || '').startsWith('external_');
  const sqTags = (sqIssue.tags || []).sort();
  if (sqTags.length === 0 || isExternal) return;
  const scTagSet = new Set((scIssue.tags || []).sort());
  const missing = sqTags.filter(t => !scTagSet.has(t));
  if (missing.length > 0) {
    result.tagMismatches.push({
      sqKey: sqIssue.key, scKey: scIssue.key, rule: sqIssue.rule,
      file: (sqIssue.component || '').split(':').pop(),
      sqTags, scTags: (scIssue.tags || []).sort(), missingTags: missing,
    });
  }
}
