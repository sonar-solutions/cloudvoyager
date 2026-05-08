import logger from '../logger.js';

/**
 * Resolve the source SonarQube project version for a given branch.
 *
 * Calls `GET /api/navigation/component` on the source SQS to read the
 * `version` of the project (or a specific branch). This lets the migration
 * preserve real source versions like "3.20" instead of using the hardcoded
 * "1.0.0" fallback when uploading to SonarCloud.
 *
 * @param {object} sqClient - SonarQube client (must expose `client.get`).
 * @param {string} projectKey - Source project key.
 * @param {string|null} [branchName] - Branch to resolve. Pass null/undefined for the main branch.
 * @returns {Promise<string|null>} The version string, or null when the setting
 *   is missing/blank, the branch is unknown, or the API call fails.
 */
export async function resolveSourceProjectVersion(sqClient, projectKey, branchName) {
  if (!sqClient || !sqClient.client || !projectKey) return null;

  const params = { component: projectKey };
  if (branchName) params.branch = branchName;

  try {
    const response = await sqClient.client.get('/api/navigation/component', { params });
    const version = response?.data?.version;
    if (typeof version === 'string' && version.trim()) return version.trim();
    return null;
  } catch (error) {
    const branchLabel = branchName ? ` branch '${branchName}'` : '';
    logger.debug(`Failed to resolve source project version for '${projectKey}'${branchLabel}: ${error.message}`);
    return null;
  }
}
