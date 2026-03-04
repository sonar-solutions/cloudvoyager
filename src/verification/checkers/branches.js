import logger from '../../utils/logger.js';

/**
 * Verify branches between SonarQube and SonarCloud for a project.
 *
 * @param {object} sqClient - SonarQube client
 * @param {object} scClient - SonarCloud client
 * @param {string} scProjectKey - SonarCloud project key
 * @returns {Promise<object>} Check result
 */
export async function verifyBranches(sqClient, scClient, scProjectKey) {
  const result = {
    status: 'pass',
    sqCount: 0,
    scCount: 0,
    missing: [],
    extra: []
  };

  const sqBranches = await sqClient.getBranches();
  const scBranches = await scClient.getProjectBranches(scProjectKey);

  // Identify default/main branches on each side
  const sqDefault = sqBranches.find(b => b.isMain)?.name || null;
  const scDefault = scBranches.find(b => b.isMain)?.name || null;

  const sqBranchNames = new Set(sqBranches.map(b => b.name));
  const scBranchNames = new Set(scBranches.map(b => b.name));

  result.sqCount = sqBranchNames.size;
  result.scCount = scBranchNames.size;

  // Branches in SQ but not in SC.
  // Treat default branch names as equivalent (e.g. "main" in SQ ↔ "master" in SC).
  for (const name of sqBranchNames) {
    if (scBranchNames.has(name)) continue;
    // If this is SQ's default branch and SC has its own default, they're equivalent
    if (name === sqDefault && scDefault && !sqBranchNames.has(scDefault)) continue;
    result.missing.push(name);
  }

  // Branches in SC but not in SQ
  for (const name of scBranchNames) {
    if (sqBranchNames.has(name)) continue;
    if (name === scDefault && sqDefault && !scBranchNames.has(sqDefault)) continue;
    result.extra.push(name);
  }

  if (result.missing.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Branch verification: SQ=${result.sqCount}, SC=${result.scCount}, missing=${result.missing.length}, extra=${result.extra.length}`);
  return result;
}
