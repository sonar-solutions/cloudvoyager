import { join } from 'node:path';
import { writeAllReports } from '../../../../shared/reports/index.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Write Final Migration Reports --------

export async function writeFinalReports(results, outputDir) {
  results.endTime = new Date().toISOString();
  try {
    await writeAllReports(results, join(outputDir, 'reports'));
  } catch (reportError) {
    logger.error(`Failed to write migration report: ${reportError.message}`);
  }
}
