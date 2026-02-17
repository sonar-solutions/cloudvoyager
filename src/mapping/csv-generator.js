import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../utils/logger.js';

/**
 * Generate all mapping CSV files for the migration
 * @param {object} mappingData - All mapping data
 * @param {string} outputDir - Output directory path
 */
export async function generateMappingCsvs(mappingData, outputDir) {
  await mkdir(outputDir, { recursive: true });

  const files = [
    { name: 'organizations.csv', fn: () => generateOrganizationsCsv(mappingData) },
    { name: 'projects.csv', fn: () => generateProjectsCsv(mappingData) },
    { name: 'group-mappings.csv', fn: () => generateGroupMappingsCsv(mappingData) },
    { name: 'profile-mappings.csv', fn: () => generateProfileMappingsCsv(mappingData) },
    { name: 'gate-mappings.csv', fn: () => generateGateMappingsCsv(mappingData) },
    { name: 'portfolio-mappings.csv', fn: () => generatePortfolioMappingsCsv(mappingData) },
    { name: 'template-mappings.csv', fn: () => generateTemplateMappingsCsv(mappingData) }
  ];

  for (const { name, fn } of files) {
    const content = fn();
    const filePath = join(outputDir, name);
    await writeFile(filePath, content, 'utf-8');
    logger.info(`Generated ${filePath}`);
  }

  logger.info(`All mapping CSVs generated in ${outputDir}`);
}

function escapeCsv(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

function toCsvRow(values) {
  return values.map(escapeCsv).join(',');
}

function generateOrganizationsCsv(data) {
  const { orgAssignments } = data;
  const rows = [toCsvRow(['Target Organization', 'Binding Group', 'ALM Platform', 'Projects Count'])];

  for (const assignment of orgAssignments) {
    if (assignment.bindingGroups.length > 0) {
      for (const group of assignment.bindingGroups) {
        rows.push(toCsvRow([
          assignment.org.key,
          group.identifier,
          group.alm,
          group.projects.length
        ]));
      }
    }

    // Unbound projects assigned to this org
    const boundKeys = new Set(assignment.bindingGroups.flatMap(g => g.projects.map(p => p.key)));
    const unbound = assignment.projects.filter(p => !boundKeys.has(p.key));
    if (unbound.length > 0) {
      rows.push(toCsvRow([
        assignment.org.key,
        '(no binding)',
        'none',
        unbound.length
      ]));
    }
  }

  return rows.join('\n') + '\n';
}

function generateProjectsCsv(data) {
  const { orgAssignments, projectBindings, projectMetadata } = data;
  const rows = [toCsvRow([
    'Project Key', 'Project Name', 'Target Organization', 'ALM Platform',
    'Repository', 'Monorepo', 'Visibility', 'Last Analysis'
  ])];

  for (const assignment of orgAssignments) {
    for (const project of assignment.projects) {
      const binding = projectBindings?.get(project.key);
      const meta = projectMetadata?.get(project.key) || project;

      rows.push(toCsvRow([
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

function generateGroupMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Group Name', 'Description', 'Target Organization'])];

  if (resourceMappings?.groupsByOrg) {
    for (const [orgKey, groups] of resourceMappings.groupsByOrg) {
      for (const group of groups) {
        rows.push(toCsvRow([group.name, group.description || '', orgKey]));
      }
    }
  }

  return rows.join('\n') + '\n';
}

function generateProfileMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Profile Name', 'Language', 'Is Default', 'Parent', 'Active Rules', 'Target Organization'])];

  if (resourceMappings?.profilesByOrg) {
    for (const [orgKey, profiles] of resourceMappings.profilesByOrg) {
      for (const profile of profiles) {
        rows.push(toCsvRow([
          profile.name,
          profile.language,
          profile.isDefault,
          profile.parentName || '',
          profile.activeRuleCount || 0,
          orgKey
        ]));
      }
    }
  }

  return rows.join('\n') + '\n';
}

function generateGateMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Gate Name', 'Is Default', 'Is Built-In', 'Conditions Count', 'Target Organization'])];

  if (resourceMappings?.gatesByOrg) {
    for (const [orgKey, gates] of resourceMappings.gatesByOrg) {
      for (const gate of gates) {
        rows.push(toCsvRow([
          gate.name,
          gate.isDefault,
          gate.isBuiltIn,
          gate.conditions?.length || 0,
          orgKey
        ]));
      }
    }
  }

  return rows.join('\n') + '\n';
}

function generatePortfolioMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Portfolio Key', 'Portfolio Name', 'Projects Count', 'Visibility', 'Target Organization'])];

  if (resourceMappings?.portfoliosByOrg) {
    for (const [orgKey, portfolios] of resourceMappings.portfoliosByOrg) {
      for (const portfolio of portfolios) {
        rows.push(toCsvRow([
          portfolio.key,
          portfolio.name,
          portfolio.projects?.length || 0,
          portfolio.visibility || 'public',
          orgKey
        ]));
      }
    }
  }

  return rows.join('\n') + '\n';
}

function generateTemplateMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Template Name', 'Description', 'Key Pattern', 'Target Organization'])];

  if (resourceMappings?.templatesByOrg) {
    for (const [orgKey, templates] of resourceMappings.templatesByOrg) {
      for (const template of templates) {
        rows.push(toCsvRow([
          template.name,
          template.description || '',
          template.projectKeyPattern || '',
          orgKey
        ]));
      }
    }
  }

  return rows.join('\n') + '\n';
}
