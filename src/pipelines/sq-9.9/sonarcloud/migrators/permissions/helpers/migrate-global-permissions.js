import { grantGlobalPermissions } from '../../../../../../shared/utils/permission-grants.js';

// -------- Grant All Global Permissions --------

export async function migrateGlobalPermissions(_globalPermissions, client) {
  await grantGlobalPermissions(client);
}
