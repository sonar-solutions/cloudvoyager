// -------- Format Unsyncable Warnings --------

/**
 * Format the unsyncable warnings section.
 * @param {object} results - Verification results
 * @returns {string}
 */
export function formatUnsyncableWarnings(results) {
  if (results.summary.warnings === 0) return '';

  const lines = ['## Unsyncable Items (Expected Differences)\n'];
  lines.push('> These differences are expected and cannot be synced via the SonarCloud API:\n');
  lines.push('- **Issue type changes** — In SonarQube Standard Experience, issue types can be manually changed. This is not API-syncable to SonarCloud. In MQR mode, issue type changes do not exist.');
  lines.push('- **Issue severity changes** — Severity overrides are not API-syncable in either Standard or MQR mode.');
  lines.push('- **Hotspot assignments** — The hotspot sync API does not support assignment transfers.');
  lines.push('');

  let totalTypeChanges = 0;
  let totalSeverityChanges = 0;
  let totalHotspotAssignments = 0;

  for (const project of results.projectResults) {
    if (project.checks.issues?.unsyncable) {
      totalTypeChanges += project.checks.issues.unsyncable.typeChanges || 0;
      totalSeverityChanges += project.checks.issues.unsyncable.severityChanges || 0;
    }
    if (project.checks.hotspots?.unsyncable) {
      totalHotspotAssignments += project.checks.hotspots.unsyncable.assignments || 0;
    }
  }

  if (totalTypeChanges > 0) lines.push(`- Issue type changes: **${totalTypeChanges}** across all projects`);
  if (totalSeverityChanges > 0) lines.push(`- Issue severity changes: **${totalSeverityChanges}** across all projects`);
  if (totalHotspotAssignments > 0) lines.push(`- Hotspot assignment diffs: **${totalHotspotAssignments}** across all projects`);
  lines.push('');
  return lines.join('\n');
}
