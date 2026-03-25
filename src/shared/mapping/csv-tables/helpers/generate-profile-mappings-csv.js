// -------- Generate Profile Mappings CSV --------
import { toCsvRow } from './csv-utils.js';

export function generateProfileMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Include', 'Profile Name', 'Language', 'Is Default', 'Is Built-In', 'Parent', 'Active Rules', 'Target Organization'])];
  if (resourceMappings?.profilesByOrg) {
    for (const [orgKey, profiles] of resourceMappings.profilesByOrg) {
      for (const profile of profiles) {
        rows.push(toCsvRow([
          'yes', profile.name, profile.language, profile.isDefault,
          profile.isBuiltIn, profile.parentName || '', profile.activeRuleCount || 0, orgKey
        ]));
      }
    }
  }
  return rows.join('\n') + '\n';
}
