// -------- Text Report Formatter --------
import { formatReportHeader } from './helpers/format-report-header.js';
import { formatReportSummary } from './helpers/format-report-summary.js';
import { formatKeyConflicts } from './helpers/format-key-conflicts.js';
import { formatNewCodePeriodWarnings } from './helpers/format-ncp-warnings.js';
import { formatServerSteps } from './helpers/format-server-steps.js';
import { formatOrgResults } from './helpers/format-org-results.js';
import { formatProblemProjects } from './helpers/format-problem-projects.js';
import { formatAllProjects } from './helpers/format-all-projects.js';
import { formatFailedAssignments } from './helpers/format-failed-assignments.js';
import { formatEnvironment } from './helpers/format-environment.js';
import { formatConfiguration } from './helpers/format-configuration.js';

export function formatTextReport(results) {
  const lines = [];
  const sep = '='.repeat(70);
  const subsep = '-'.repeat(70);
  formatReportHeader(lines, results, sep);
  formatReportSummary(lines, results, subsep);
  formatKeyConflicts(lines, results, subsep);
  formatNewCodePeriodWarnings(lines, results, subsep);
  formatServerSteps(lines, results, subsep);
  formatOrgResults(lines, results, subsep);
  formatProblemProjects(lines, results, subsep);
  formatAllProjects(lines, results, subsep);
  formatFailedAssignments(lines, results, subsep);
  formatEnvironment(lines, results, subsep);
  formatConfiguration(lines, results, subsep);
  lines.push(sep);
  return lines.join('\n');
}
