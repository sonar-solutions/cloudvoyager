import logger from '../../utils/logger.js';

/**
 * Verify global permissions between SonarQube and SonarCloud.
 *
 * @param {object} sqClient - SonarQube client
 * @param {object} scClient - SonarCloud client
 * @returns {Promise<object>} Check result
 */
export async function verifyGlobalPermissions(sqClient, scClient) {
  const result = {
    status: 'pass',
    mismatches: [],
    details: []
  };

  const sqGroups = await sqClient.getGlobalPermissions();
  const scGroups = await scClient.getGlobalPermissions();

  const scPermMap = buildPermissionMap(scGroups);

  for (const sqGroup of sqGroups) {
    const sqPerms = (sqGroup.permissions || []).sort();
    const scPerms = (scPermMap.get(sqGroup.name) || []).sort();

    const missing = sqPerms.filter(p => !scPerms.includes(p));
    if (missing.length > 0) {
      result.mismatches.push({
        group: sqGroup.name,
        missingPermissions: missing
      });
    }

    result.details.push({
      group: sqGroup.name,
      sqPermissions: sqPerms,
      scPermissions: scPerms,
      status: missing.length === 0 ? 'pass' : 'fail'
    });
  }

  if (result.mismatches.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Global permission verification: ${result.mismatches.length} groups with missing permissions`);
  return result;
}

/**
 * Verify project-level permissions for a project.
 *
 * @param {object} sqClient - SonarQube client (projectKey set)
 * @param {object} scClient - SonarCloud client
 * @param {string} sqProjectKey - SonarQube project key
 * @param {string} scProjectKey - SonarCloud project key
 * @returns {Promise<object>} Check result
 */
export async function verifyProjectPermissions(sqClient, scClient, sqProjectKey, scProjectKey) {
  const result = {
    status: 'pass',
    mismatches: [],
    details: []
  };

  let sqGroups, scGroups;
  try {
    sqGroups = await sqClient.getProjectPermissions(sqProjectKey);
  } catch (error) {
    logger.debug(`Failed to get SQ project permissions: ${error.message}`);
    sqGroups = [];
  }

  try {
    scGroups = await scClient.getProjectPermissions(scProjectKey);
  } catch (error) {
    logger.debug(`Failed to get SC project permissions: ${error.message}`);
    scGroups = [];
  }

  const scPermMap = buildPermissionMap(scGroups);

  for (const sqGroup of sqGroups) {
    const sqPerms = (sqGroup.permissions || []).sort();
    if (sqPerms.length === 0) continue;

    const scPerms = (scPermMap.get(sqGroup.name) || []).sort();
    const missing = sqPerms.filter(p => !scPerms.includes(p));

    if (missing.length > 0) {
      result.mismatches.push({
        group: sqGroup.name,
        missingPermissions: missing
      });
    }

    result.details.push({
      group: sqGroup.name,
      sqPermissions: sqPerms,
      scPermissions: scPerms,
      status: missing.length === 0 ? 'pass' : 'fail'
    });
  }

  if (result.mismatches.length > 0) {
    result.status = 'fail';
  }

  return result;
}

/**
 * Verify permission templates between SonarQube and SonarCloud.
 */
export async function verifyPermissionTemplates(sqClient, scClient) {
  const result = {
    status: 'pass',
    sqCount: 0,
    scCount: 0,
    missing: [],
    details: []
  };

  let sqData, scData;
  try {
    sqData = await sqClient.getPermissionTemplates();
  } catch (error) {
    logger.debug(`Failed to get SQ permission templates: ${error.message}`);
    sqData = { permissionTemplates: [] };
  }

  try {
    scData = await scClient.getPermissionTemplates();
  } catch (error) {
    logger.debug(`Failed to get SC permission templates: ${error.message}`);
    scData = { permissionTemplates: [] };
  }

  const sqTemplates = sqData.permissionTemplates || [];
  const scTemplates = scData.permissionTemplates || [];

  result.sqCount = sqTemplates.length;
  result.scCount = scTemplates.length;

  const scTemplateNames = new Set(scTemplates.map(t => t.name));

  for (const sqTemplate of sqTemplates) {
    const found = scTemplateNames.has(sqTemplate.name);
    result.details.push({
      name: sqTemplate.name,
      status: found ? 'pass' : 'fail'
    });
    if (!found) {
      result.missing.push(sqTemplate.name);
    }
  }

  if (result.missing.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Permission template verification: SQ=${result.sqCount}, SC=${result.scCount}, missing=${result.missing.length}`);
  return result;
}

function buildPermissionMap(groups) {
  const map = new Map();
  for (const group of groups) {
    map.set(group.name, group.permissions || []);
  }
  return map;
}
