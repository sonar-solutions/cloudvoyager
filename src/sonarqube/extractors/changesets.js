import logger from '../../utils/logger.js';

/**
 * Extract SCM changeset (blame) data from SonarQube
 * Creates minimal stub data for each source file
 * @param {SonarQubeClient} client - SonarQube client
 * @param {Array} sourceFiles - List of source files with component keys
 * @param {Object} components - Component tree with metadata
 * @returns {Promise<Map<string, Object>>} Map of component key to changeset data
 */
export async function extractChangesets(client, sourceFiles, components) {
  logger.info('Extracting SCM changeset data...');

  const changesets = new Map();
  const timestamp = Date.now(); // Current timestamp in milliseconds
  const stubRevision = 'cloudvoyager000000000000000000000000000'; // 40-char stub hash
  const stubAuthor = 'cloudvoyager-migration@sonarcloud.io';

  // Create minimal changeset data for each source file
  for (const file of sourceFiles) {
    try {
      // Use actual source file line count
      const lineCount = file.lines ? file.lines.length : 1;

      // Create minimal changeset: single changeset for all lines
      // changesetIndexByLine maps each line to its changeset index (0-based)
      // With a single changeset, all lines point to index 0
      const changesetData = {
        componentRef: null, // Will be set by builder
        changesets: [{
          revision: stubRevision,
          author: stubAuthor,
          date: timestamp
        }],
        changesetIndexByLine: new Array(lineCount).fill(0) // All lines -> changeset[0]
      };

      changesets.set(file.key, changesetData);
    } catch (error) {
      logger.warn(`Failed to create changeset for ${file.key}: ${error.message}`);
    }
  }

  logger.info(`Created ${changesets.size} changeset entries`);
  return changesets;
}
