// -------- Write Verification Reports --------

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../../utils/logger.js';
import { formatVerificationMarkdown } from '../format-markdown.js';
import { generateVerificationPdf } from '../format-pdf.js';

/**
 * Write all verification report files to the output directory.
 */
export async function writeVerificationReports(results, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const reports = [];

  const jsonPath = join(outputDir, 'verification-report.json');
  await writeFile(jsonPath, JSON.stringify(results, null, 2));
  reports.push('verification-report.json');

  const mdPath = join(outputDir, 'verification-report.md');
  await writeFile(mdPath, formatVerificationMarkdown(results));
  reports.push('verification-report.md');

  try {
    const pdfBuffer = await generateVerificationPdf(results);
    const pdfPath = join(outputDir, 'verification-report.pdf');
    await writeFile(pdfPath, pdfBuffer);
    reports.push('verification-report.pdf');
  } catch (err) {
    logger.warn(`Failed to generate PDF report: ${err.message}`);
  }

  logger.info(`Verification reports saved to: ${outputDir}`);
  for (const report of reports) logger.info(`  - ${report}`);
}
