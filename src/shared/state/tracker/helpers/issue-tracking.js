// -------- Issue Tracking --------

/**
 * Check if issue was already processed.
 * @param {Set} processedSet - Set of processed issue keys
 * @param {string} issueKey
 * @returns {boolean}
 */
export function isIssueProcessed(processedSet, issueKey) {
  return processedSet.has(issueKey);
}

/**
 * Mark an issue as processed.
 * @param {Set} processedSet - Set of processed issue keys
 * @param {Array} processedList - Array of processed issue keys
 * @param {string} issueKey
 */
export function markIssueProcessed(processedSet, processedList, issueKey) {
  if (!processedSet.has(issueKey)) {
    processedSet.add(issueKey);
    processedList.push(issueKey);
  }
}
