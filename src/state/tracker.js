import logger from '../utils/logger.js';
import { StateStorage } from './storage.js';

/**
 * State tracker for incremental transfers
 */
export class StateTracker {
  constructor(stateFilePath) {
    this.storage = new StateStorage(stateFilePath);
    this.state = {
      lastSync: null,
      processedIssues: [],
      completedBranches: [],
      syncHistory: []
    };
  }

  /**
   * Initialize state (load from file if exists)
   */
  async initialize() {
    logger.info('Initializing state tracker...');

    const savedState = await this.storage.load();

    if (savedState) {
      this.state = {
        ...this.state,
        ...savedState
      };

      logger.info(`Loaded existing state (last sync: ${this.state.lastSync || 'never'})`);
      logger.info(`Processed ${this.state.processedIssues.length} issues previously`);
    } else {
      logger.info('No existing state found, starting fresh');
    }
  }

  /**
   * Get last sync timestamp
   * @returns {string|null}
   */
  getLastSync() {
    return this.state.lastSync;
  }

  /**
   * Check if issue was already processed
   * @param {string} issueKey - Issue key
   * @returns {boolean}
   */
  isIssueProcessed(issueKey) {
    return this.state.processedIssues.includes(issueKey);
  }

  /**
   * Mark issue as processed
   * @param {string} issueKey - Issue key
   */
  markIssueProcessed(issueKey) {
    if (!this.state.processedIssues.includes(issueKey)) {
      this.state.processedIssues.push(issueKey);
    }
  }

  /**
   * Mark multiple issues as processed
   * @param {Array<string>} issueKeys - Array of issue keys
   */
  markIssuesProcessed(issueKeys) {
    issueKeys.forEach(key => this.markIssueProcessed(key));
  }

  /**
   * Check if branch was completed
   * @param {string} branchName - Branch name
   * @returns {boolean}
   */
  isBranchCompleted(branchName) {
    return this.state.completedBranches.includes(branchName);
  }

  /**
   * Mark branch as completed
   * @param {string} branchName - Branch name
   */
  markBranchCompleted(branchName) {
    if (!this.state.completedBranches.includes(branchName)) {
      this.state.completedBranches.push(branchName);
      logger.info(`Branch marked as completed: ${branchName}`);
    }
  }

  /**
   * Update last sync timestamp
   * @param {string} timestamp - ISO timestamp
   */
  updateLastSync(timestamp = null) {
    this.state.lastSync = timestamp || new Date().toISOString();
    logger.info(`Last sync updated to: ${this.state.lastSync}`);
  }

  /**
   * Add sync history entry
   * @param {object} syncInfo - Sync information
   */
  addSyncHistory(syncInfo) {
    this.state.syncHistory.push({
      timestamp: new Date().toISOString(),
      ...syncInfo
    });

    // Keep only last 10 sync history entries
    if (this.state.syncHistory.length > 10) {
      this.state.syncHistory = this.state.syncHistory.slice(-10);
    }
  }

  /**
   * Save current state to file
   */
  async save() {
    await this.storage.save(this.state);
  }

  /**
   * Clear state and reset
   */
  async reset() {
    logger.info('Resetting state...');

    this.state = {
      lastSync: null,
      processedIssues: [],
      completedBranches: [],
      syncHistory: []
    };

    await this.storage.clear();
    logger.info('State reset complete');
  }

  /**
   * Get state summary
   * @returns {object}
   */
  getSummary() {
    return {
      lastSync: this.state.lastSync,
      processedIssuesCount: this.state.processedIssues.length,
      completedBranchesCount: this.state.completedBranches.length,
      syncHistoryCount: this.state.syncHistory.length,
      completedBranches: this.state.completedBranches
    };
  }

  /**
   * Record successful transfer
   * @param {object} stats - Transfer statistics
   */
  async recordTransfer(stats) {
    this.updateLastSync();

    this.addSyncHistory({
      success: true,
      stats
    });

    await this.save();

    logger.info('Transfer recorded in state');
  }
}
