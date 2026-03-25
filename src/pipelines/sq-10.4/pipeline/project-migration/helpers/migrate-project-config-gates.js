import { migrateQualityGate } from './migrate-quality-gate.js';
import { migrateQualityProfiles } from './migrate-quality-profiles.js';
import { migrateProjectPermissionsStep } from './migrate-project-permissions.js';

// -------- Main Logic --------

/**
 * Migrate quality gates, quality profiles, and permissions for a project.
 */
export async function migrateProjectConfigGates(scProjectKey, projectSqClient, projectScClient, gateMapping, projectResult, builtInProfileMapping, onlyComponents, shouldRun, runGuardedStep) {
  await Promise.all([
    migrateQualityGate(scProjectKey, projectSqClient, projectScClient, gateMapping, projectResult, onlyComponents, shouldRun, runGuardedStep),
    migrateQualityProfiles(scProjectKey, projectScClient, projectResult, builtInProfileMapping, onlyComponents, shouldRun, runGuardedStep),
    migrateProjectPermissionsStep(scProjectKey, projectSqClient, projectScClient, projectResult, onlyComponents, shouldRun, runGuardedStep),
  ]);
}
