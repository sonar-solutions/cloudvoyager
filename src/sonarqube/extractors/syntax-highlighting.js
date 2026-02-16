import logger from '../../utils/logger.js';

/**
 * Extract syntax highlighting data from SonarQube
 * Creates empty syntax highlighting data for each source file (minimal stub)
 * @param {SonarQubeClient} client - SonarQube client
 * @param {Array} sourceFiles - List of source files with component keys
 * @returns {Promise<Map<string, Object>>} Map of component key to syntax highlighting data
 */
export async function extractSyntaxHighlighting(client, sourceFiles) {
  logger.info('Extracting syntax highlighting data...');

  const syntaxHighlightings = new Map();

  // Create empty syntax highlighting data for each source file
  for (const file of sourceFiles) {
    try {
      // Create empty syntax highlighting rules (minimal valid structure)
      const highlightingData = {
        fileRef: null, // Will be set by builder
        rules: [] // Empty rules array
      };

      syntaxHighlightings.set(file.key, highlightingData);
    } catch (error) {
      logger.warn(`Failed to create syntax highlighting for ${file.key}: ${error.message}`);
    }
  }

  logger.info(`Created ${syntaxHighlightings.size} syntax highlighting entries (empty)`);
  return syntaxHighlightings;
}
