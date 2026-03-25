// -------- Apply Template Mappings CSV Filter --------
import { isIncluded } from '../../csv-reader.js';
import logger from '../../../utils/logger.js';
import { filterTemplatePermissions } from './filter-template-permissions.js';

export function applyTemplateMappingsCsv(csvData, permissionTemplates) {
  if (!permissionTemplates) return permissionTemplates;

  const templateRows = new Map();
  for (const row of csvData.rows) {
    const name = row['Template Name'];
    if (!templateRows.has(name)) templateRows.set(name, []);
    templateRows.get(name).push(row);
  }

  let excludedCount = 0;
  const filteredTemplates = [];

  for (const template of (permissionTemplates.templates || [])) {
    const rows = templateRows.get(template.name);
    if (!rows) { filteredTemplates.push(template); continue; }
    const headerRow = rows.find(r => !r['Permission Key']);
    if (headerRow && !isIncluded(headerRow['Include'])) { excludedCount++; continue; }
    const newPermissions = filterTemplatePermissions(rows);
    filteredTemplates.push({ ...template, permissions: newPermissions });
  }

  if (excludedCount > 0) logger.info(`CSV override: excluded ${excludedCount} permission template(s)`);

  const filteredNames = new Set(filteredTemplates.map(t => t.name));
  const filteredDefaults = (permissionTemplates.defaultTemplates || []).filter(d => {
    const ref = permissionTemplates.templates.find(t => t.id === d.templateId);
    return !ref || filteredNames.has(ref.name);
  });

  return { templates: filteredTemplates, defaultTemplates: filteredDefaults };
}
