// -------- CSV Generator Orchestrator --------
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../utils/logger.js';
import { buildCsvFileList } from './helpers/build-csv-file-list.js';

export async function generateMappingCsvs(mappingData, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const files = buildCsvFileList(mappingData);

  for (const { name, fn } of files) {
    const content = fn();
    const filePath = join(outputDir, name);
    await writeFile(filePath, content, 'utf-8');
    logger.info(`Generated ${filePath}`);
  }
  logger.info(`All mapping CSVs generated in ${outputDir}`);
}
