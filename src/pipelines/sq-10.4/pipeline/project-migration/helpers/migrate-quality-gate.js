import { assignQualityGatesToProjects } from '../../../sonarcloud/migrators/quality-gates.js';

// -------- Main Logic --------

/**
 * Migrate quality gate assignment for a project.
 */
export async function migrateQualityGate(scProjectKey, projectSqClient, projectScClient, gateMapping, projectResult, onlyComponents, shouldRun, runGuardedStep) {
  if (!shouldRun('quality-gates')) {
    if (onlyComponents) projectResult.steps.push({ step: 'Assign quality gate', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    return;
  }
  await runGuardedStep('Assign quality gate', 'assign_quality_gate', async () => {
    const gate = await projectSqClient.getQualityGate();
    if (gate && gateMapping.has(gate.name)) {
      await assignQualityGatesToProjects(gateMapping, [{ projectKey: scProjectKey, gateName: gate.name }], projectScClient);
    }
  });
}
