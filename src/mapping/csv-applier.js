import { isIncluded } from './csv-reader.js';
import { mapResourcesToOrganizations } from './org-mapper.js';
import logger from '../utils/logger.js';

/**
 * Apply CSV overrides from a previous dry-run to filter/modify extracted data.
 * Returns new objects via structuredClone — never mutates originals.
 *
 * @param {Map<string, { headers: string[], rows: object[] }>} parsedCsvs
 * @param {object} extractedData
 * @param {object} resourceMappings
 * @param {Array} orgAssignments
 * @returns {{ filteredExtractedData: object, filteredResourceMappings: object, filteredOrgAssignments: Array }}
 */
export function applyCsvOverrides(parsedCsvs, extractedData, resourceMappings, orgAssignments) {
  const filtered = structuredClone(extractedData);
  let filteredAssignments = structuredClone(orgAssignments);

  if (parsedCsvs.has('projects.csv')) {
    filteredAssignments = applyProjectsCsv(parsedCsvs.get('projects.csv'), filteredAssignments);
  }
  if (parsedCsvs.has('gate-mappings.csv')) {
    filtered.qualityGates = applyGateMappingsCsv(parsedCsvs.get('gate-mappings.csv'), filtered.qualityGates);
  }
  if (parsedCsvs.has('profile-mappings.csv')) {
    filtered.qualityProfiles = applyProfileMappingsCsv(parsedCsvs.get('profile-mappings.csv'), filtered.qualityProfiles);
  }
  if (parsedCsvs.has('group-mappings.csv')) {
    filtered.groups = applyGroupMappingsCsv(parsedCsvs.get('group-mappings.csv'), filtered.groups);
  }
  if (parsedCsvs.has('global-permissions.csv')) {
    filtered.globalPermissions = applyGlobalPermissionsCsv(parsedCsvs.get('global-permissions.csv'), filtered.globalPermissions);
  }
  if (parsedCsvs.has('template-mappings.csv')) {
    filtered.permissionTemplates = applyTemplateMappingsCsv(parsedCsvs.get('template-mappings.csv'), filtered.permissionTemplates);
  }
  if (parsedCsvs.has('portfolio-mappings.csv')) {
    filtered.portfolios = applyPortfolioMappingsCsv(parsedCsvs.get('portfolio-mappings.csv'), filtered.portfolios);
  }

  const filteredResourceMappings = mapResourcesToOrganizations(filtered, filteredAssignments);

  return { filteredExtractedData: filtered, filteredResourceMappings, filteredOrgAssignments: filteredAssignments };
}

/**
 * Filter org assignments to exclude projects marked Include!=yes.
 */
function applyProjectsCsv(csvData, orgAssignments) {
  const excludedKeys = new Set();
  for (const row of csvData.rows) {
    if (!isIncluded(row['Include'])) {
      excludedKeys.add(row['Project Key']);
    }
  }

  if (excludedKeys.size === 0) return orgAssignments;

  logger.info(`CSV override: excluding ${excludedKeys.size} project(s): ${[...excludedKeys].join(', ')}`);

  for (const assignment of orgAssignments) {
    assignment.projects = assignment.projects.filter(p => !excludedKeys.has(p.key));
  }
  return orgAssignments;
}

/**
 * Filter quality gates and rebuild conditions from CSV (supports threshold/operator edits).
 */
function applyGateMappingsCsv(csvData, qualityGates) {
  if (!qualityGates) return qualityGates;

  // Group CSV rows by gate name
  const gateRows = new Map();
  for (const row of csvData.rows) {
    const name = row['Gate Name'];
    if (!gateRows.has(name)) gateRows.set(name, []);
    gateRows.get(name).push(row);
  }

  const result = [];
  let excludedCount = 0;
  let conditionChanges = 0;

  for (const gate of qualityGates) {
    const rows = gateRows.get(gate.name);
    if (!rows) {
      // Gate not in CSV — keep as-is
      result.push(gate);
      continue;
    }

    // Find header row (Condition Metric is empty)
    const headerRow = rows.find(r => !r['Condition Metric']);
    if (headerRow && !isIncluded(headerRow['Include'])) {
      excludedCount++;
      continue;
    }

    // Rebuild conditions from included condition rows
    const conditionRows = rows.filter(r => r['Condition Metric']);
    const newConditions = [];
    for (const cr of conditionRows) {
      if (!isIncluded(cr['Include'])) {
        conditionChanges++;
        continue;
      }
      newConditions.push({
        metric: cr['Condition Metric'],
        op: cr['Condition Operator'],
        error: cr['Condition Threshold']
      });
    }

    result.push({ ...gate, conditions: newConditions });
    if (newConditions.length !== (gate.conditions?.length || 0)) {
      conditionChanges++;
    }
  }

  if (excludedCount > 0) logger.info(`CSV override: excluded ${excludedCount} quality gate(s)`);
  if (conditionChanges > 0) logger.info('CSV override: modified conditions in quality gate(s)');

  return result;
}

/**
 * Filter quality profiles by (name, language) tuples.
 */
function applyProfileMappingsCsv(csvData, qualityProfiles) {
  if (!qualityProfiles) return qualityProfiles;

  const excludedTuples = new Set();
  for (const row of csvData.rows) {
    if (!isIncluded(row['Include'])) {
      excludedTuples.add(`${row['Profile Name']}::${row.Language}`);
    }
  }

  if (excludedTuples.size === 0) return qualityProfiles;

  logger.info(`CSV override: excluding ${excludedTuples.size} quality profile(s)`);

  return qualityProfiles.filter(p => !excludedTuples.has(`${p.name}::${p.language}`));
}

/**
 * Filter groups by name.
 */
function applyGroupMappingsCsv(csvData, groups) {
  if (!groups) return groups;

  const excludedNames = new Set();
  for (const row of csvData.rows) {
    if (!isIncluded(row['Include'])) {
      excludedNames.add(row['Group Name']);
    }
  }

  if (excludedNames.size === 0) return groups;

  logger.info(`CSV override: excluding ${excludedNames.size} group(s): ${[...excludedNames].join(', ')}`);

  return groups.filter(g => !excludedNames.has(g.name));
}

/**
 * Filter global permissions by (group, permission) tuples.
 */
function applyGlobalPermissionsCsv(csvData, globalPermissions) {
  if (!globalPermissions) return globalPermissions;

  const excludedTuples = new Set();
  for (const row of csvData.rows) {
    if (!isIncluded(row['Include'])) {
      excludedTuples.add(`${row['Group Name']}::${row['Permission']}`);
    }
  }

  if (excludedTuples.size === 0) return globalPermissions;

  logger.info(`CSV override: excluding ${excludedTuples.size} global permission assignment(s)`);

  const result = [];
  for (const group of globalPermissions) {
    const filteredPerms = group.permissions.filter(p => !excludedTuples.has(`${group.name}::${p}`));
    if (filteredPerms.length > 0) {
      result.push({ ...group, permissions: filteredPerms });
    }
  }
  return result;
}

/**
 * Filter permission templates and their permission assignments.
 */
function applyTemplateMappingsCsv(csvData, permissionTemplates) {
  if (!permissionTemplates) return permissionTemplates;

  // Group rows by template name
  const templateRows = new Map();
  for (const row of csvData.rows) {
    const name = row['Template Name'];
    if (!templateRows.has(name)) templateRows.set(name, []);
    templateRows.get(name).push(row);
  }

  let excludedCount = 0;
  const filteredTemplates = [];

  for (const template of permissionTemplates.templates) {
    const rows = templateRows.get(template.name);
    if (!rows) {
      filteredTemplates.push(template);
      continue;
    }

    // Header row has empty Permission Key
    const headerRow = rows.find(r => !r['Permission Key']);
    if (headerRow && !isIncluded(headerRow['Include'])) {
      excludedCount++;
      continue;
    }

    // Rebuild permissions from included rows
    const permRows = rows.filter(r => r['Permission Key']);
    // Group by permission key
    const permGroupMap = new Map();
    for (const pr of permRows) {
      if (!isIncluded(pr['Include'])) continue;
      const key = pr['Permission Key'];
      if (!permGroupMap.has(key)) permGroupMap.set(key, []);
      permGroupMap.get(key).push(pr['Group Name']);
    }

    const newPermissions = [];
    for (const [key, groups] of permGroupMap) {
      newPermissions.push({ key, groupsCount: groups.length, groups });
    }

    filteredTemplates.push({ ...template, permissions: newPermissions });
  }

  if (excludedCount > 0) logger.info(`CSV override: excluded ${excludedCount} permission template(s)`);

  // Remove default templates that reference excluded templates
  const filteredTemplateNames = new Set(filteredTemplates.map(t => t.name));
  const filteredDefaults = (permissionTemplates.defaultTemplates || []).filter(d => {
    const refTemplate = permissionTemplates.templates.find(t => t.id === d.templateId);
    return !refTemplate || filteredTemplateNames.has(refTemplate.name);
  });

  return { templates: filteredTemplates, defaultTemplates: filteredDefaults };
}

/**
 * Filter portfolios and their project memberships.
 */
function applyPortfolioMappingsCsv(csvData, portfolios) {
  if (!portfolios) return portfolios;

  // Group rows by portfolio key
  const portfolioRows = new Map();
  for (const row of csvData.rows) {
    const key = row['Portfolio Key'];
    if (!portfolioRows.has(key)) portfolioRows.set(key, []);
    portfolioRows.get(key).push(row);
  }

  let excludedCount = 0;
  const result = [];

  for (const portfolio of portfolios) {
    const rows = portfolioRows.get(portfolio.key);
    if (!rows) {
      result.push(portfolio);
      continue;
    }

    // Header row has empty Member Project Key
    const headerRow = rows.find(r => !r['Member Project Key']);
    if (headerRow && !isIncluded(headerRow['Include'])) {
      excludedCount++;
      continue;
    }

    // Rebuild projects from included member rows
    const memberRows = rows.filter(r => r['Member Project Key']);
    const newProjects = [];
    for (const mr of memberRows) {
      if (!isIncluded(mr['Include'])) continue;
      newProjects.push({ key: mr['Member Project Key'], name: mr['Member Project Name'] });
    }

    result.push({ ...portfolio, projects: newProjects });
  }

  if (excludedCount > 0) logger.info(`CSV override: excluded ${excludedCount} portfolio(s)`);

  return result;
}
