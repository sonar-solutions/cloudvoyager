import { isIncluded } from './csv-reader.js';
import logger from '../utils/logger.js';

/**
 * Filter quality gates by Include column. Conditions are always preserved as-is from SonarQube.
 */
export function applyGateMappingsCsv(csvData, qualityGates) {
  if (!qualityGates) return qualityGates;

  const excludedNames = new Set();
  for (const row of csvData.rows) {
    if (!isIncluded(row['Include'])) {
      excludedNames.add(row['Gate Name']);
    }
  }

  if (excludedNames.size === 0) return qualityGates;

  logger.info(`CSV override: excluded ${excludedNames.size} quality gate(s): ${[...excludedNames].join(', ')}`);

  return qualityGates.filter(g => !excludedNames.has(g.name));
}

/**
 * Filter quality profiles by (name, language) tuples.
 */
export function applyProfileMappingsCsv(csvData, qualityProfiles) {
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
export function applyGroupMappingsCsv(csvData, groups) {
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
export function applyGlobalPermissionsCsv(csvData, globalPermissions) {
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
export function applyTemplateMappingsCsv(csvData, permissionTemplates) {
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

  for (const template of (permissionTemplates.templates || [])) {
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
export function applyPortfolioMappingsCsv(csvData, portfolios) {
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

/**
 * Build a user mapping from the user-mappings CSV.
 * Returns a Map<sqLogin, { scLogin: string|null, include: boolean }>.
 * - If Include=no, the user is excluded from assignment entirely.
 * - If SonarCloud Login is filled in, it maps the SQ login to the SC login.
 * - If SonarCloud Login is empty, falls back to the SQ login (current behavior).
 */
export function applyUserMappingsCsv(csvData) {
  const mappings = new Map();
  let mappedCount = 0;
  let excludedCount = 0;

  for (const row of csvData.rows) {
    const sqLogin = row['SonarQube Login'];
    if (!sqLogin) continue;

    const include = isIncluded(row['Include']);
    const scLogin = (row['SonarCloud Login'] || '').trim();

    if (!include) {
      mappings.set(sqLogin, { scLogin: null, include: false });
      excludedCount++;
    } else if (scLogin) {
      mappings.set(sqLogin, { scLogin, include: true });
      mappedCount++;
    }
    // If include=yes and no SC login, don't add to map → falls back to SQ login
  }

  if (mappedCount > 0) {
    logger.info(`CSV override: ${mappedCount} user(s) mapped to SonarCloud logins`);
  }
  if (excludedCount > 0) {
    logger.info(`CSV override: ${excludedCount} user(s) excluded from assignment`);
  }

  return mappings.size > 0 ? mappings : null;
}
