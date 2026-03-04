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

  const sqBranchNames = new Set(sqBranches.map(b => b.name));
  const scBranchNames = new Set(scBranches.map(b => b.name));

  result.sqCount = sqBranchNames.size;
  result.scCount = scBranchNames.size;

  // Branches in SQ but not in SC
  for (const name of sqBranchNames) {
    if (!scBranchNames.has(name)) {
      result.missing.push(name);
    }
  }

  // Branches in SC but not in SQ
  for (const name of scBranchNames) {
    if (!sqBranchNames.has(name)) {
      result.extra.push(name);
    }
  }

  if (result.missing.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Branch verification: SQ=${result.sqCount}, SC=${result.scCount}, missing=${result.missing.length}, extra=${result.extra.length}`);
  return result;
}
