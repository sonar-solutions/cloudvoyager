/**
 * Migration report orchestrator.
 * Generates all report formats after a migration run.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../utils/logger.js';
import { formatTextReport } from './format-text.js';
import { formatMarkdownReport } from './format-markdown.js';
import { formatExecutiveSummaryMarkdown } from './format-markdown-executive.js';
import { formatPerformanceReport } from './format-performance.js';
import { generatePdfReport } from './format-pdf.js';
import { generateExecutiveSummaryPdf } from './format-pdf-executive.js';
import { generatePerformanceReportPdf } from './format-pdf-performance.js';

/**
 * Write all migration report files to the output directory.
 *
 * Text and markdown reports are always generated.
 * PDF reports are best-effort (logged as warnings on failure, never block migration).
 */
export async function writeAllReports(results, outputDir) {
  await mkdir(outputDir, { recursive: true });

  const reports = [];

  // JSON — structured data (always)
  const jsonPath = join(outputDir, 'migration-report.json');
  await writeFile(jsonPath, JSON.stringify(results, null, 2));
  reports.push('migration-report.json');

  // TXT — plain text (always)
  const txtPath = join(outputDir, 'migration-report.txt');
  await writeFile(txtPath, formatTextReport(results));
  reports.push('migration-report.txt');

  // MD — full markdown report (always)
  const mdPath = join(outputDir, 'migration-report.md');
  await writeFile(mdPath, formatMarkdownReport(results));
  reports.push('migration-report.md');

  // MD — executive summary (always)
  const execMdPath = join(outputDir, 'executive-summary.md');
  await writeFile(execMdPath, formatExecutiveSummaryMarkdown(results));
  reports.push('executive-summary.md');

  // MD — performance report (always)
  const perfMdPath = join(outputDir, 'performance-report.md');
  await writeFile(perfMdPath, formatPerformanceReport(results));
  reports.push('performance-report.md');

  // PDF — full report (best-effort)
  try {
    const pdfBuffer = await generatePdfReport(results);
    const pdfPath = join(outputDir, 'migration-report.pdf');
    await writeFile(pdfPath, pdfBuffer);
    reports.push('migration-report.pdf');
  } catch (err) {
    logger.warn(`Failed to generate PDF report: ${err.message}`);
  }

  // PDF — executive summary (best-effort)
  try {
    const execPdfBuffer = await generateExecutiveSummaryPdf(results);
    const execPdfPath = join(outputDir, 'executive-summary.pdf');
    await writeFile(execPdfPath, execPdfBuffer);
    reports.push('executive-summary.pdf');
  } catch (err) {
    logger.warn(`Failed to generate executive summary PDF: ${err.message}`);
  }

  // PDF — performance report (best-effort)
  try {
    const perfPdfBuffer = await generatePerformanceReportPdf(results);
    const perfPdfPath = join(outputDir, 'performance-report.pdf');
    await writeFile(perfPdfPath, perfPdfBuffer);
    reports.push('performance-report.pdf');
  } catch (err) {
    logger.warn(`Failed to generate performance report PDF: ${err.message}`);
  }

  logger.info(`Migration reports saved to: ${outputDir}`);
  for (const report of reports) {
    logger.info(`  - ${report}`);
  }
}
