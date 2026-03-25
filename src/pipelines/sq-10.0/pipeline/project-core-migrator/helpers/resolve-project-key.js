import logger from '../../../../../shared/utils/logger.js';

// -------- Resolve Project Key --------

export async function resolveProjectKey(project, org, scClient) {
  let scProjectKey = project.key;
  let warning = null;
  const globalCheck = await scClient.isProjectKeyTakenGlobally(project.key);
  if (globalCheck.taken && globalCheck.owner !== org.key) {
    scProjectKey = `${org.key}_${project.key}`;
    logger.warn(`Project key "${project.key}" is already taken by organization "${globalCheck.owner}". Using prefixed key "${scProjectKey}" instead.`);
    warning = { sqKey: project.key, scKey: scProjectKey, owner: globalCheck.owner };
  }
  return { scProjectKey, warning };
}
