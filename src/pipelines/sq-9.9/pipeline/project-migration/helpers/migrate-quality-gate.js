import { assignQualityGatesToProjects } from '../../../sonarcloud/migrators/quality-gates.js';
import { runGuardedStep } from './run-guarded-step.js';

// -------- Migrate Quality Gate --------

export async function migrateGateIfNeeded(scProjectKey, projectSqClient, projectScClient, gateMapping, projectResult, onlyComponents, stepDone, recStep, shouldRun) {
  if (shouldRun('quality-gates')) {
    await runGuardedStep(projectResult, 'Assign quality gate', 'assign_quality_gate', stepDone, recStep, async () => {
      const projectGate = await projectSqClient.getQualityGate();
      if (projectGate && gateMapping.has(projectGate.name)) {
        await assignQualityGatesToProjects(gateMapping, [{ projectKey: scProjectKey, gateName: projectGate.name }], projectScClient);
      }
    });
  } else if (onlyComponents) {
    projectResult.steps.push({ step: 'Assign quality gate', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  }
}
