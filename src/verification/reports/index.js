import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../utils/logger.js';
import { formatVerificationMarkdown } from './format-markdown.js';
import { generateVerificationPdf } from './format-pdf.js';

/**
 * Write all verification report files to the output directory.
 */
export async function writeVerificationReports(results, outputDir) {
  await mkdir(outputDir, { recursive: true });

  const reports = [];

  // JSON report
  const jsonPath = join(outputDir, 'verification-report.json');
  await writeFile(jsonPath, JSON.stringify(results, null, 2));
  reports.push('verification-report.json');

  // Markdown report
  const mdPath = join(outputDir, 'verification-report.md');
  await writeFile(mdPath, formatVerificationMarkdown(results));
  reports.push('verification-report.md');

  // PDF report (best-effort)
  try {
    const pdfBuffer = await generateVerificationPdf(results);
    const pdfPath = join(outputDir, 'verification-report.pdf');
    await writeFile(pdfPath, pdfBuffer);
    reports.push('verification-report.pdf');
  } catch (err) {
    logger.warn(`Failed to generate PDF report: ${err.message}`);
  }

  logger.info(`Verification reports saved to: ${outputDir}`);
  for (const report of reports) {
    logger.info(`  - ${report}`);
  }
}

/**
 * Log verification summary to console.
 */
export function logVerificationSummary(results) {
  const s = results.summary;
  logger.info('');
  logger.info('=== Verification Summary ===');
  logger.info(`Total checks:  ${s.totalChecks}`);
  logger.info(`Passed:        ${s.passed}`);
  logger.info(`Failed:        ${s.failed}`);
  logger.info(`Warnings:      ${s.warnings} (unsyncable items)`);
  logger.info(`Skipped:       ${s.skipped}`);
  logger.info(`Errors:        ${s.errors}`);
  logger.info('');

  if (s.failed === 0 && s.errors === 0) {
    logger.info('Result: ALL CHECKS PASSED');
  } else {
    logger.error(`Result: ${s.failed} FAILED, ${s.errors} ERRORS`);
  }

  // Log per-project summary
  if (results.projectResults.length > 0) {
    logger.info('');
    logger.info('--- Per-Project Results ---');
    for (const project of results.projectResults) {
      const checks = Object.values(project.checks || {});
      const fails = checks.filter(c => c.status === 'fail').length;
      const passes = checks.filter(c => c.status === 'pass').length;
      const errored = checks.filter(c => c.status === 'error').length;
      const icon = fails === 0 && errored === 0 ? 'PASS' : 'FAIL';
      logger.info(`  ${icon}  ${project.sqProjectKey} -> ${project.scProjectKey}  (${passes} pass, ${fails} fail, ${errored} error)`);

      // Show issue/hotspot specifics
      if (project.checks.issues) {
        const iss = project.checks.issues;
        const parts = [`${iss.matched}/${iss.sqCount} matched`];
        if (iss.statusMismatches?.length > 0) parts.push(`${iss.statusMismatches.length} status mismatches`);
        if (iss.assignmentMismatches?.length > 0) parts.push(`${iss.assignmentMismatches.length} assignment mismatches`);
        if (iss.commentMismatches?.length > 0) parts.push(`${iss.commentMismatches.length} comment mismatches`);
        if (iss.tagMismatches?.length > 0) parts.push(`${iss.tagMismatches.length} tag mismatches`);
        if (iss.unsyncable?.typeChanges > 0) parts.push(`${iss.unsyncable.typeChanges} type changes (unsyncable)`);
        if (iss.unsyncable?.severityChanges > 0) parts.push(`${iss.unsyncable.severityChanges} severity changes (unsyncable)`);
        logger.info(`         Issues: ${parts.join(', ')}`);
      }

      if (project.checks.hotspots) {
        const hs = project.checks.hotspots;
        const parts = [`${hs.matched}/${hs.sqCount} matched`];
        if (hs.statusMismatches?.length > 0) parts.push(`${hs.statusMismatches.length} status mismatches`);
        if (hs.commentMismatches?.length > 0) parts.push(`${hs.commentMismatches.length} comment mismatches`);
        if (hs.unsyncable?.assignments > 0) parts.push(`${hs.unsyncable.assignments} assignment diffs (unsyncable)`);
        logger.info(`         Hotspots: ${parts.join(', ')}`);
      }
    }
  }

  // Unsyncable items warning
  if (s.warnings > 0) {
    logger.info('');
    logger.warn('=== Unsyncable Items ===');
    logger.warn('The following differences are expected and cannot be synced via API:');
    logger.warn('  - Issue type changes (SonarQube Standard Experience → SonarCloud): type changes are not API-syncable');
    logger.warn('  - Issue severity changes: severity overrides are not API-syncable in either Standard or MQR mode');
    logger.warn('  - Hotspot assignments: the hotspot sync API does not support assignment changes');
  }
}
