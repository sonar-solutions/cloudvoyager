// -------- Check Unsyncable Changes --------

/** Detect unsyncable type/severity changes between SQ and SC issue. */
export function checkUnsyncable(sqIssue, scIssue, result) {
  if (sqIssue.type && scIssue.type && sqIssue.type !== scIssue.type) {
    result.unsyncable.typeChanges++;
    if (result.unsyncable.typeChangeDetails.length < 50) {
      result.unsyncable.typeChangeDetails.push({
        sqKey: sqIssue.key, rule: sqIssue.rule,
        file: (sqIssue.component || '').split(':').pop(),
        sqType: sqIssue.type, scType: scIssue.type,
      });
    }
  }
  if (sqIssue.severity && scIssue.severity && sqIssue.severity !== scIssue.severity) {
    result.unsyncable.severityChanges++;
    if (result.unsyncable.severityChangeDetails.length < 50) {
      result.unsyncable.severityChangeDetails.push({
        sqKey: sqIssue.key, rule: sqIssue.rule,
        file: (sqIssue.component || '').split(':').pop(),
        sqSeverity: sqIssue.severity, scSeverity: scIssue.severity,
      });
    }
  }
}
