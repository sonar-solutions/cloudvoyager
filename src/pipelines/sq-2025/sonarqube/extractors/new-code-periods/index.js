import { processProjectLevel } from './helpers/process-project-level.js';
import { processBranchOverrides } from './helpers/process-branch-overrides.js';

// -------- Extract New Code Periods --------

/**
 * Extract new code period definitions for a project.
 * Fetches both the project-level definition and branch-level overrides.
 */
export async function extractNewCodePeriods(client, projectKey = null) {
  const { projectLevel, branchOverrides } = await client.getNewCodePeriods(projectKey);

  return {
    projectLevel: processProjectLevel(projectLevel),
    branchOverrides: processBranchOverrides(branchOverrides),
  };
}
