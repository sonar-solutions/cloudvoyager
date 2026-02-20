import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../utils/logger.js';
import { toCsvRow, generateGroupMappingsCsv, generateProfileMappingsCsv, generateGateMappingsCsv, generatePortfolioMappingsCsv, generateTemplateMappingsCsv, generateGlobalPermissionsCsv } from './csv-tables.js';

export async function generateMappingCsvs(mappingData, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const files = [
    { name: 'organizations.csv', fn: () => generateOrganizationsCsv(mappingData) },
    { name: 'projects.csv', fn: () => generateProjectsCsv(mappingData) },
    { name: 'group-mappings.csv', fn: () => generateGroupMappingsCsv(mappingData) },
    { name: 'profile-mappings.csv', fn: () => generateProfileMappingsCsv(mappingData) },
    { name: 'gate-mappings.csv', fn: () => generateGateMappingsCsv(mappingData) },
    { name: 'portfolio-mappings.csv', fn: () => generatePortfolioMappingsCsv(mappingData) },
    { name: 'template-mappings.csv', fn: () => generateTemplateMappingsCsv(mappingData) },
    { name: 'global-permissions.csv', fn: () => generateGlobalPermissionsCsv(mappingData) }
  ];
  for (const { name, fn } of files) {
    const content = fn();
    const filePath = join(outputDir, name);
    await writeFile(filePath, content, 'utf-8');
    logger.info(`Generated ${filePath}`);
  }
  logger.info(`All mapping CSVs generated in ${outputDir}`);
}

function generateOrganizationsCsv(data) {
  const { orgAssignments } = data;
  const rows = [toCsvRow(['Include', 'Target Organization', 'Binding Group', 'ALM Platform', 'Projects Count'])];
  for (const assignment of orgAssignments) {
    if (assignment.bindingGroups.length > 0) {
      for (const group of assignment.bindingGroups) {
        rows.push(toCsvRow(['yes', assignment.org.key, group.identifier, group.alm, group.projects.length]));
      }
    }
    const boundKeys = new Set(assignment.bindingGroups.flatMap(g => g.projects.map(p => p.key)));
    const unbound = assignment.projects.filter(p => !boundKeys.has(p.key));
    if (unbound.length > 0) {
      rows.push(toCsvRow(['yes', assignment.org.key, '(no binding)', 'none', unbound.length]));
    }
  }
  return rows.join('\n') + '\n';
}

function generateProjectsCsv(data) {
  const { orgAssignments, projectBindings, projectMetadata } = data;
  const rows = [toCsvRow([
    'Include', 'Project Key', 'Project Name', 'Target Organization', 'ALM Platform',
    'Repository', 'Monorepo', 'Visibility', 'Last Analysis'
  ])];
  for (const assignment of orgAssignments) {
    for (const project of assignment.projects) {
      const binding = projectBindings?.get(project.key);
      const meta = projectMetadata?.get(project.key) || project;
      rows.push(toCsvRow([
        'yes',
        project.key,
        meta.name || project.name || project.key,
        assignment.org.key,
        binding?.alm || 'none',
        binding?.repository || '',
        binding?.monorepo || false,
        meta.visibility || 'public',
        meta.lastAnalysisDate || ''
      ]));
    }
  }
  return rows.join('\n') + '\n';
}
