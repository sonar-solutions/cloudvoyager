import logger from '../logger.js';
import { mapConcurrent } from '../concurrency.js';

/**
 * Batch-fetch changelogs for a list of SQ issues.
 * @returns {Promise<Map<string, Array>>} Map of issueKey → changelog entries
 */
export async function fetchSqChangelogs(sqIssues, sqClient, concurrency = 10) {
  const changelogMap = new Map();
  if (sqIssues.length === 0) return changelogMap;

  logger.info(`Batch-fetching changelogs for ${sqIssues.length} SQ issues (concurrency=${concurrency})`);

  await mapConcurrent(
    sqIssues,
    async (issue) => {
      try {
        const changelog = await sqClient.getIssueChangelog(issue.key);
        changelogMap.set(issue.key, changelog);
      } catch (error) {
        logger.debug(`Failed to fetch changelog for issue ${issue.key}: ${error.message}`);
        changelogMap.set(issue.key, []);
      }
    },
    { concurrency, settled: true },
  );

  logger.info(`Fetched changelogs for ${changelogMap.size} issues`);
  return changelogMap;
}
