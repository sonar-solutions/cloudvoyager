import logger from '../../../../../shared/utils/logger.js';

// -------- Project Key Resolution --------

/**
 * Resolve the SonarCloud project key, prefixing with org key
 * if the key is already taken by another org.
 *
 * @param {object} project - SonarQube project
 * @param {object} org - SonarCloud organization
 * @param {object} scClient - SonarCloud client
 * @returns {Promise<{scProjectKey: string, warning: object|null}>}
 */
export async function resolveProjectKey(project, org, scClient) {
  let scProjectKey = project.key;
  let warning = null;

  const globalCheck = await scClient.isProjectKeyTakenGlobally(project.key);
  if (globalCheck.taken && globalCheck.owner !== org.key) {
    scProjectKey = `${org.key}_${project.key}`;
    logger.warn(`Project key "${project.key}" taken by "${globalCheck.owner}". Using "${scProjectKey}" instead.`);
    warning = { sqKey: project.key, scKey: scProjectKey, owner: globalCheck.owner };
  }

  return { scProjectKey, warning };
}
