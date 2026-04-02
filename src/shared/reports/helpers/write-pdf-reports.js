// -------- Write PDF Reports --------
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../utils/logger.js';
import { generatePdfReport } from '../format-pdf.js';
import { generateExecutiveSummaryPdf } from '../format-pdf-executive.js';
import { generatePerformanceReportPdf } from '../format-pdf-performance.js';
import { generateRulesComparisonPdf } from '../format-pdf-rules-comparison.js';
import { generateIssuesDeltaPdf } from '../format-pdf-issues-delta.js';

export async function writePdfReports(results, outputDir) {
  const reports = [];
  try {
    const pdfBuffer = await generatePdfReport(results);
    await writeFile(join(outputDir, 'migration-report.pdf'), pdfBuffer);
    reports.push('migration-report.pdf');
  } catch (err) { logger.warn(`Failed to generate PDF report: ${err.message}`); }
  try {
    const execPdfBuffer = await generateExecutiveSummaryPdf(results);
    await writeFile(join(outputDir, 'executive-summary.pdf'), execPdfBuffer);
    reports.push('executive-summary.pdf');
  } catch (err) { logger.warn(`Failed to generate executive summary PDF: ${err.message}`); }
  try {
    const perfPdfBuffer = await generatePerformanceReportPdf(results);
    await writeFile(join(outputDir, 'performance-report.pdf'), perfPdfBuffer);
    reports.push('performance-report.pdf');
  } catch (err) { logger.warn(`Failed to generate performance report PDF: ${err.message}`); }
  try {
    const rcPdf = await generateRulesComparisonPdf(results);
    if (rcPdf) { await writeFile(join(outputDir, 'rules-comparison-report.pdf'), rcPdf); reports.push('rules-comparison-report.pdf'); }
  } catch (err) { logger.warn(`Failed to generate rules comparison PDF: ${err.message}`); }
  try {
    const idPdf = await generateIssuesDeltaPdf(results);
    if (idPdf) { await writeFile(join(outputDir, 'issues-delta-report.pdf'), idPdf); reports.push('issues-delta-report.pdf'); }
  } catch (err) { logger.warn(`Failed to generate issues delta PDF: ${err.message}`); }
  return reports;
}
