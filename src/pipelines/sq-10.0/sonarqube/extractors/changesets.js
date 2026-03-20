import logger from '../../../../shared/utils/logger.js';

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
    if (!file?.key) { logger.warn('Skipping file without key in changesets extraction'); continue; }
    try {
      // Use actual source file line count.
      // file.lines may be an array (SourceFileData) or undefined (raw API component).
      // If it's a string (unlikely), split by newlines to count lines.
      let lineCount = 1;
      if (Array.isArray(file.lines)) {
        lineCount = file.lines.length;
      } else if (typeof file.lines === 'string') {
        lineCount = file.lines.split('\n').length;
      } else {
        // Fallback: look up line count from components measures
        const comp = components?.find?.(c => c.key === file.key);
        const linesMeasure = comp?.measures?.find?.(m => m.metric === 'lines');
        lineCount = linesMeasure ? Number.parseInt(linesMeasure.value, 10) || 1 : 1;
      }

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
