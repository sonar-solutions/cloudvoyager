import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import logger from '../utils/logger.js';
import { StateError } from '../utils/errors.js';

/**
 * Persistent state storage
 */
export class StateStorage {
  constructor(stateFilePath) {
    this.filePath = stateFilePath;
  }

  /**
   * Load state from file
   * @returns {Promise<object|null>} State object or null if doesn't exist
   */
  async load() {
    try {
      if (!existsSync(this.filePath)) {
        logger.debug('State file does not exist');
        return null;
      }

      logger.debug(`Loading state from: ${this.filePath}`);

      const content = await readFile(this.filePath, 'utf-8');
      const state = JSON.parse(content);

      logger.info(`Loaded state from ${this.filePath}`);
      return state;

    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new StateError(`Invalid JSON in state file: ${error.message}`);
      }
      throw new StateError(`Failed to load state: ${error.message}`);
    }
  }

  /**
   * Save state to file
   * @param {object} state - State object to save
   */
  async save(state) {
    try {
      logger.debug(`Saving state to: ${this.filePath}`);

      const content = JSON.stringify(state, null, 2);
      await writeFile(this.filePath, content, 'utf-8');

      logger.info(`Saved state to ${this.filePath}`);

    } catch (error) {
      throw new StateError(`Failed to save state: ${error.message}`);
    }
  }

  /**
   * Clear state file
   */
  async clear() {
    try {
      if (existsSync(this.filePath)) {
        logger.info(`Clearing state file: ${this.filePath}`);
        await unlink(this.filePath);
        logger.info('State file cleared');
      } else {
        logger.debug('State file does not exist, nothing to clear');
      }
    } catch (error) {
      throw new StateError(`Failed to clear state: ${error.message}`);
    }
  }

  /**
   * Check if state file exists
   * @returns {boolean}
   */
  exists() {
    return existsSync(this.filePath);
  }
}
