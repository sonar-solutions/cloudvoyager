import logger from '../../../../../shared/utils/logger.js';

// -------- Resolve SonarCloud Project Key --------

export async function resolveProjectKey(project, org, scClient) {
  let scProjectKey = project.key;
  let warning = null;
  const globalCheck = await scClient.isProjectKeyTakenGlobally(project.key);
  if (globalCheck.taken && globalCheck.owner !== org.key) {
    scProjectKey = `${org.key}_${project.key}`;
    logger.warn(`Project key "${project.key}" taken by "${globalCheck.owner}". Using "${scProjectKey}".`);
    warning = { sqKey: project.key, scKey: scProjectKey, owner: globalCheck.owner };
  }
  return { scProjectKey, warning };
}
