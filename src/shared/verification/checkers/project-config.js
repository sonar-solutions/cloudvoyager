import logger from '../../utils/logger.js';

/**
 * Verify project settings between SonarQube and SonarCloud.
 */
export async function verifyProjectSettings(sqClient, scClient, sqProjectKey, scProjectKey) {
  const result = {
    status: 'pass',
    mismatches: [],
    sqOnly: [],
    scOnly: []
  };

  let sqSettings, scSettings;
  try {
    sqSettings = await sqClient.getProjectSettings(sqProjectKey);
  } catch (error) {
    logger.debug(`Failed to get SQ project settings: ${error.message}`);
    sqSettings = [];
  }

  try {
    scSettings = await scClient.getProjectSettings(scProjectKey);
  } catch (error) {
    logger.debug(`Failed to get SC project settings: ${error.message}`);
    scSettings = [];
  }

  // Only compare non-inherited settings
  const sqNonInherited = sqSettings.filter(s => !s.inherited);
  const scMap = new Map(scSettings.map(s => [s.key, s]));

  for (const sqSetting of sqNonInherited) {
    const scSetting = scMap.get(sqSetting.key);
    if (!scSetting) {
      result.sqOnly.push({ key: sqSetting.key, value: sqSetting.value || sqSetting.values });
      continue;
    }

    const sqVal = JSON.stringify(sqSetting.value || sqSetting.values || '');
    const scVal = JSON.stringify(scSetting.value || scSetting.values || '');
    if (sqVal !== scVal) {
      result.mismatches.push({
        key: sqSetting.key,
        sqValue: sqSetting.value || sqSetting.values,
        scValue: scSetting.value || scSetting.values
      });
    }
  }

  if (result.mismatches.length > 0 || result.sqOnly.length > 0) {
    result.status = 'fail';
  }

  return result;
}

/**
 * Verify project tags between SonarQube and SonarCloud.
 */
export async function verifyProjectTags(sqClient, scClient, scProjectKey) {
  const result = {
    status: 'pass',
    sqTags: [],
    scTags: [],
    missing: [],
    extra: []
  };

  // SQ tags are fetched from the project component
  try {
    const sqProject = await sqClient.getProject();
    result.sqTags = (sqProject.tags || []).sort();
  } catch (error) {
    logger.debug(`Failed to get SQ project tags: ${error.message}`);
  }

  try {
    result.scTags = (await scClient.getProjectTagsForProject(scProjectKey)).sort();
  } catch (error) {
    logger.debug(`Failed to get SC project tags: ${error.message}`);
  }

  const sqSet = new Set(result.sqTags);
  const scSet = new Set(result.scTags);

  for (const tag of result.sqTags) {
    if (!scSet.has(tag)) result.missing.push(tag);
  }
  for (const tag of result.scTags) {
    if (!sqSet.has(tag)) result.extra.push(tag);
  }

  if (result.missing.length > 0) {
    result.status = 'fail';
  }

  return result;
}

/**
 * Verify project links between SonarQube and SonarCloud.
 */
export async function verifyProjectLinks(sqClient, scClient, sqProjectKey, scProjectKey) {
  const result = {
    status: 'pass',
    sqCount: 0,
    scCount: 0,
    missing: [],
    details: []
  };

  let sqLinks, scLinks;
  try {
    sqLinks = await sqClient.getProjectLinks(sqProjectKey);
  } catch (error) {
    logger.debug(`Failed to get SQ project links: ${error.message}`);
    sqLinks = [];
  }

  try {
    scLinks = await scClient.getProjectLinks(scProjectKey);
  } catch (error) {
    logger.debug(`Failed to get SC project links: ${error.message}`);
    scLinks = [];
  }

  result.sqCount = sqLinks.length;
  result.scCount = scLinks.length;

  const scLinkMap = new Map(scLinks.map(l => [`${l.name}|${l.url}`, l]));

  for (const sqLink of sqLinks) {
    const key = `${sqLink.name}|${sqLink.url}`;
    if (!scLinkMap.has(key)) {
      result.missing.push({ name: sqLink.name, url: sqLink.url });
    }
  }

  if (result.missing.length > 0) {
    result.status = 'fail';
  }

  return result;
}

/**
 * Verify new code period definitions between SonarQube and SonarCloud.
 */
export async function verifyNewCodePeriods(sqClient, scClient, sqProjectKey, scProjectKey) {
  const result = {
    status: 'pass',
    details: {}
  };

  let sqPeriods, scPeriods;
  try {
    sqPeriods = await sqClient.getNewCodePeriods(sqProjectKey);
  } catch (error) {
    logger.debug(`Failed to get SQ new code periods: ${error.message}`);
    sqPeriods = { projectLevel: null, branchOverrides: [] };
  }

  try {
    scPeriods = await scClient.getNewCodePeriods(scProjectKey);
  } catch (error) {
    logger.debug(`Failed to get SC new code periods: ${error.message}`);
    scPeriods = { projectLevel: null, branchOverrides: [] };
  }

  // Compare project-level setting
  const sqType = sqPeriods.projectLevel?.type || null;
  const scType = scPeriods.projectLevel?.type || null;
  result.details.sqProjectLevel = sqType;
  result.details.scProjectLevel = scType;

  if (sqType && scType && sqType !== scType) {
    result.status = 'fail';
  }

  return result;
}

/**
 * Verify DevOps/ALM binding for a project.
 */
export async function verifyDevOpsBinding(sqClient, scClient, sqProjectKey, scProjectKey) {
  const result = {
    status: 'pass',
    details: {}
  };

  let sqBinding, scBinding;
  try {
    sqBinding = await sqClient.getProjectBinding(sqProjectKey);
  } catch (error) {
    logger.debug(`Failed to get SQ binding: ${error.message}`);
    sqBinding = null;
  }

  try {
    scBinding = await scClient.getProjectBinding(scProjectKey);
  } catch (error) {
    logger.debug(`Failed to get SC binding: ${error.message}`);
    scBinding = null;
  }

  result.details.sqBinding = sqBinding ? { alm: sqBinding.alm, repository: sqBinding.repository } : null;
  result.details.scBinding = scBinding ? { alm: scBinding.alm, repository: scBinding.repository } : null;

  // If SQ has a binding, SC should too
  if (sqBinding && !scBinding) {
    result.status = 'fail';
  } else if (sqBinding && scBinding) {
    if (sqBinding.repository !== scBinding.repository) {
      result.status = 'fail';
    }
  }

  return result;
}
