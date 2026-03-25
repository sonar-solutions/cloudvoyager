// -------- Verify Project Permissions --------

import logger from '../../../../utils/logger.js';
import { buildPermissionMap } from './build-permission-map.js';

/** Verify project-level permissions for a project. */
export async function verifyProjectPermissions(sqClient, scClient, sqProjectKey, scProjectKey) {
  const result = { status: 'pass', mismatches: [], details: [] };

  let sqGroups, scGroups;
  try { sqGroups = await sqClient.getProjectPermissions(sqProjectKey); } catch (e) { logger.debug(`Failed to get SQ project permissions: ${e.message}`); sqGroups = []; }
  try { scGroups = await scClient.getProjectPermissions(scProjectKey); } catch (e) { logger.debug(`Failed to get SC project permissions: ${e.message}`); scGroups = []; }

  const scPermMap = buildPermissionMap(scGroups);
  for (const sqGroup of sqGroups) {
    const sqPerms = (sqGroup.permissions || []).sort();
    if (sqPerms.length === 0) continue;
    const scPerms = (scPermMap.get(sqGroup.name) || []).sort();
    const missing = sqPerms.filter(p => !scPerms.includes(p));
    if (missing.length > 0) result.mismatches.push({ group: sqGroup.name, missingPermissions: missing });
    result.details.push({
      group: sqGroup.name, sqPermissions: sqPerms, scPermissions: scPerms,
      status: missing.length === 0 ? 'pass' : 'fail',
    });
  }

  if (result.mismatches.length > 0) result.status = 'fail';
  return result;
}
