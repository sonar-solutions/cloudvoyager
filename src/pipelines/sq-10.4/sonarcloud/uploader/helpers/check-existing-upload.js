import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Check if a CE task already exists from the current session (upload deduplication).
 *
 * @param {object} client - SonarCloud API client
 * @param {string} sessionStartTime - ISO timestamp of when the session started
 * @returns {Promise<object|null>} Existing CE task or null
 */
export async function checkExistingUpload(client, sessionStartTime) {
  try {
    const task = await client.getMostRecentCeTask();
    if (!task) return null;

    const taskSubmittedAt = task.submittedAt ? new Date(task.submittedAt).getTime() : 0;
    const sessionStart = new Date(sessionStartTime).getTime();

    if (taskSubmittedAt >= sessionStart) {
      const status = task.status || 'UNKNOWN';
      if (status === 'SUCCESS' || status === 'IN_PROGRESS' || status === 'PENDING') {
        logger.info(`Found existing CE task ${task.id} (status: ${status}) — skipping re-upload`);
        return { id: task.id, status };
      }
      logger.info(`Found CE task ${task.id} with status ${status} — will re-upload`);
    }

    return null;
  } catch (error) {
    logger.debug(`Could not check for existing upload: ${error.message}`);
    return null;
  }
}
