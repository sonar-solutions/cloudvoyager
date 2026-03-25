import { DataExtractor } from '../../../../sonarqube/extractors/index.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Extract Data --------

/** Extract all data from SonarQube main branch. */
export async function extractData(sqClient, sqConfig, scConfig, transferConfig, isIncremental, stateTracker, perfConfig, journal, cache, shutdownCheck) {
  logger.info('Starting data extraction from SonarQube (main branch)...');
  const config = { sonarqube: sqConfig, sonarcloud: scConfig, transfer: transferConfig };
  const extractor = new DataExtractor(sqClient, config, isIncremental ? stateTracker : null, perfConfig);

  let extractedData;
  if (journal && cache) {
    extractedData = await extractor.extractAllWithCheckpoints(journal, cache, shutdownCheck);
  } else {
    extractedData = await extractor.extractAll();
  }
  return { extractedData, extractor };
}
