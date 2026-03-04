import logger from '../../utils/logger.js';

/**
 * Verify user groups between SonarQube and SonarCloud.
 *
 * @param {object} sqClient - SonarQube client
 * @param {object} scClient - SonarCloud client
 * @returns {Promise<object>} Check result
 */
export async function verifyGroups(sqClient, scClient) {
  const result = {
    status: 'pass',
    sqCount: 0,
    scCount: 0,
    missing: [],
    details: []
  };

  const sqGroups = await sqClient.getGroups();
  const scGroups = await scClient.getGroups();

  // Filter out built-in groups (anyone, sonar-users, sonar-administrators)
  const BUILTIN_GROUPS = new Set(['anyone', 'sonar-users', 'sonar-administrators', 'Members', 'Owners']);
  const sqCustomGroups = sqGroups.filter(g => !BUILTIN_GROUPS.has(g.name));

  result.sqCount = sqCustomGroups.length;
  result.scCount = scGroups.length;

  const scGroupNames = new Set(scGroups.map(g => g.name));

  for (const sqGroup of sqCustomGroups) {
    const found = scGroupNames.has(sqGroup.name);
    result.details.push({
      name: sqGroup.name,
      description: sqGroup.description || '',
      status: found ? 'pass' : 'fail'
    });
    if (!found) {
      result.missing.push(sqGroup.name);
    }
  }

  if (result.missing.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Group verification: SQ=${result.sqCount} custom, SC=${result.scCount}, missing=${result.missing.length}`);
  return result;
}
