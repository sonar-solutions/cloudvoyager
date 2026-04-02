// -------- Migration Report Orchestrator --------
import { mkdir } from 'node:fs/promises';
import logger from '../utils/logger.js';
import { writeTextReports } from './helpers/write-text-reports.js';
import { writePdfReports } from './helpers/write-pdf-reports.js';

export async function writeAllReports(results, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const [textReports, pdfReports] = await Promise.all([
    writeTextReports(results, outputDir),
    writePdfReports(results, outputDir),
  ]);
  const reports = [...textReports, ...pdfReports];
  logger.info(`Migration reports saved to: ${outputDir}`);
  for (const report of reports) logger.info(`  - ${report}`);
}
