import logger from '../../utils/logger.js';

/**
 * Extract symbol table data from SonarQube
 * Creates empty symbol data for each source file (minimal stub)
 * @param {SonarQubeClient} client - SonarQube client
 * @param {Array} sourceFiles - List of source files with component keys
 * @returns {Promise<Map<string, Object>>} Map of component key to symbols data
 */
export async function extractSymbols(client, sourceFiles) {
  logger.info('Extracting symbol table data...');

  const symbols = new Map();

  // Create empty symbol data for each source file
  for (const file of sourceFiles) {
    try {
      // Create empty symbols array (minimal valid structure)
      const symbolsData = {
        fileRef: null, // Will be set by builder
        symbols: [] // Empty symbols array
      };

      symbols.set(file.key, symbolsData);
    } catch (error) {
      logger.warn(`Failed to create symbols for ${file.key}: ${error.message}`);
    }
  }

  logger.info(`Created ${symbols.size} symbol entries (empty)`);
  return symbols;
}
