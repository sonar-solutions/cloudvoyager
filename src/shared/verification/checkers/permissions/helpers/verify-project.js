// -------- Verify Project Permissions (Grant-All Mode) --------

import logger from '../../../../utils/logger.js';
import { buildPermissionMap } from './build-permission-map.js';
import { TARGET_PERMISSION_GROUP, ALL_PROJECT_PERMISSIONS } from '../../../../utils/permission-constants.js';

export async function verifyProjectPermissions(sqClient, scClient, sqProjectKey, scProjectKey) {
  const result = { status: 'pass', mismatches: [], details: [] };

  let scGroups;
  try { scGroups = await scClient.getProjectPermissions(scProjectKey); }
  catch (e) { logger.debug(`Failed to get SC project permissions: ${e.message}`); scGroups = []; }

  const scPermMap = buildPermissionMap(scGroups);
  const scPerms = (scPermMap.get(TARGET_PERMISSION_GROUP) || []).sort();
  const missing = ALL_PROJECT_PERMISSIONS.filter(p => !scPerms.includes(p));

  result.details.push({
    group: TARGET_PERMISSION_GROUP,
    expectedPermissions: ALL_PROJECT_PERMISSIONS,
    scPermissions: scPerms,
    status: missing.length === 0 ? 'pass' : 'fail',
  });

  if (missing.length > 0) {
    result.status = 'fail';
    result.mismatches.push({ group: TARGET_PERMISSION_GROUP, missingPermissions: missing });
  }

  return result;
}
