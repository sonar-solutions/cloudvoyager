// -------- Branch Tracking --------

import logger from '../../../utils/logger.js';

/**
 * Check if branch was completed.
 * @param {Set} completedSet - Set of completed branch names
 * @param {string} branchName
 * @returns {boolean}
 */
export function isBranchCompleted(completedSet, branchName) {
  return completedSet.has(branchName);
}

/**
 * Mark a branch as completed.
 * @param {Set} completedSet - Set of completed branch names
 * @param {Array} completedList - Array of completed branch names
 * @param {string} branchName
 */
export function markBranchCompleted(completedSet, completedList, branchName) {
  if (!completedSet.has(branchName)) {
    completedSet.add(branchName);
    completedList.push(branchName);
    logger.info(`Branch marked as completed: ${branchName}`);
  }
}
