// -------- Try Load JSON File --------

import { readFile } from 'node:fs/promises';
import logger from '../../../utils/logger.js';
import { StateError } from '../../../utils/errors.js';

/**
 * Try to load and parse a JSON file.
 * @param {string} filePath
 * @returns {Promise<object|null>}
 */
export async function tryLoadFile(filePath) {
  try {
    logger.debug(`Loading state from: ${filePath}`);
    const content = await readFile(filePath, 'utf-8');
    if (!content.trim()) return null;
    const state = JSON.parse(content);
    logger.info(`Loaded state from ${filePath}`);
    return state;
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.warn(`Invalid JSON in state file ${filePath}: ${error.message}`);
      return null;
    }
    if (error.code === 'ENOENT') return null;
    throw new StateError(`Failed to load state from ${filePath}: ${error.message}`);
  }
}
