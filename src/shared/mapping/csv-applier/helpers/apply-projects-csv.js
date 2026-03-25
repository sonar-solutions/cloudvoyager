// -------- Apply Projects CSV Filter --------
import { isIncluded } from '../../csv-reader.js';
import logger from '../../../utils/logger.js';
import { buildProjectBranchIncludes } from './build-project-branch-includes.js';

export function applyProjectsCsv(csvData, orgAssignments) {
  const hasBranchColumn = csvData.headers.includes('Branch');
  const excludedKeys = new Set();
  let projectBranchIncludes = new Map();

  if (!hasBranchColumn) {
    for (const row of csvData.rows) {
      if (!isIncluded(row['Include'])) excludedKeys.add(row['Project Key']);
    }
  } else {
    const result = buildProjectBranchIncludes(csvData.rows);
    for (const key of result.excludedKeys) excludedKeys.add(key);
    projectBranchIncludes = result.projectBranchIncludes;
  }

  if (excludedKeys.size > 0) {
    logger.info(`CSV override: excluding ${excludedKeys.size} project(s): ${[...excludedKeys].join(', ')}`);
    for (const a of orgAssignments) a.projects = a.projects.filter(p => !excludedKeys.has(p.key));
  }
  if (projectBranchIncludes.size > 0) {
    logger.info(`CSV override: branch-level filtering for ${projectBranchIncludes.size} project(s)`);
  }

  return { orgAssignments, projectBranchIncludes };
}
