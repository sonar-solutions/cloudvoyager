// -------- Set Gate Permissions --------

import logger from '../../../../../../shared/utils/logger.js';

export async function setGatePermissions(gate, client) {
  for (const group of (gate.permissions.groups || [])) {
    if (!group.selected) continue;

    try {
      await client.addGroupPermission(group.name, 'gateadmin');
    } catch (error) {
      logger.debug(`Failed to set gate permission for group ${group.name}: ${error.message}`);
    }
  }
}
