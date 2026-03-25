// -------- Generate Template Mappings CSV --------
import { toCsvRow } from './csv-utils.js';

export function generateTemplateMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Include', 'Template Name', 'Description', 'Key Pattern', 'Permission Key', 'Group Name', 'Target Organization'])];
  if (resourceMappings?.templatesByOrg) {
    for (const [orgKey, templates] of resourceMappings.templatesByOrg) {
      for (const template of templates) {
        rows.push(toCsvRow(['yes', template.name, template.description || '', template.projectKeyPattern || '', '', '', orgKey]));
        if (template.permissions) {
          for (const perm of template.permissions) {
            if (perm.groups) {
              for (const groupName of perm.groups) {
                rows.push(toCsvRow(['yes', template.name, '', '', perm.key, groupName, orgKey]));
              }
            }
          }
        }
      }
    }
  }
  return rows.join('\n') + '\n';
}
