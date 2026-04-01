// -------- Write Text Reports --------
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { formatTextReport } from '../format-text.js';
import { formatMarkdownReport } from '../format-markdown.js';
import { formatExecutiveSummaryMarkdown } from '../format-markdown-executive.js';
import { formatPerformanceReport } from '../format-performance.js';
import { formatRulesComparisonReport } from '../format-rules-comparison.js';
import { formatIssuesDeltaReport } from '../format-issues-delta.js';

export async function writeTextReports(results, outputDir) {
  const reports = [];
  const jsonPath = join(outputDir, 'migration-report.json');
  await writeFile(jsonPath, JSON.stringify(results, null, 2));
  reports.push('migration-report.json');
  const txtPath = join(outputDir, 'migration-report.txt');
  await writeFile(txtPath, formatTextReport(results));
  reports.push('migration-report.txt');
  const mdPath = join(outputDir, 'migration-report.md');
  await writeFile(mdPath, formatMarkdownReport(results));
  reports.push('migration-report.md');
  const execMdPath = join(outputDir, 'executive-summary.md');
  await writeFile(execMdPath, formatExecutiveSummaryMarkdown(results));
  reports.push('executive-summary.md');
  const perfMdPath = join(outputDir, 'performance-report.md');
  await writeFile(perfMdPath, formatPerformanceReport(results));
  reports.push('performance-report.md');
  const rcMd = formatRulesComparisonReport(results);
  if (rcMd) { await writeFile(join(outputDir, 'rules-comparison-report.md'), rcMd); reports.push('rules-comparison-report.md'); }
  const idMd = formatIssuesDeltaReport(results);
  if (idMd) { await writeFile(join(outputDir, 'issues-delta-report.md'), idMd); reports.push('issues-delta-report.md'); }
  return reports;
}
