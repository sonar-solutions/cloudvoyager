import { extractProjectSettings } from '../sonarqube/extractors/project-settings.js';
import { extractProjectTags } from '../sonarqube/extractors/project-tags.js';
import { extractProjectLinks } from '../sonarqube/extractors/project-links.js';
import { extractNewCodePeriods } from '../sonarqube/extractors/new-code-periods.js';
import { extractProjectPermissions } from '../sonarqube/extractors/permissions.js';
import { assignQualityGatesToProjects } from '../sonarcloud/migrators/quality-gates.js';
import { migrateProjectSettings, migrateProjectTags, migrateProjectLinks, migrateNewCodePeriods, migrateDevOpsBinding } from '../sonarcloud/migrators/project-config.js';
import { migrateProjectPermissions } from '../sonarcloud/migrators/permissions.js';
import logger from '../../../shared/utils/logger.js';

export async function migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, onlyComponents, journal = {}) {
  const shouldRun = (comp) => !onlyComponents || onlyComponents.includes(comp);
  const { isStepDone: stepDone, recordStep: recStep } = journal;

  // Journal-guarded project step: skip if already done, record on success
  async function runGuardedStep(stepName, journalKey, fn) {
    if (stepDone && stepDone(journalKey)) {
      logger.info(`${stepName} — already completed, skipping`);
      projectResult.steps.push({ step: stepName, status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
      return;
    }
    await runProjectStep(projectResult, stepName, fn);
    const lastStep = projectResult.steps.at(-1);
    if (recStep && lastStep && lastStep.status !== 'failed') await recStep(journalKey);
  }

  // Project settings, tags, links, new code definitions, devops binding → 'project-settings' component
  if (shouldRun('project-settings')) {
    await Promise.all([
      runGuardedStep('Project settings', 'project_settings', async () => {
        const projectSettings = await extractProjectSettings(projectSqClient, project.key);
        await migrateProjectSettings(scProjectKey, projectSettings, projectScClient);
      }),
      runGuardedStep('Project tags', 'project_tags', async () => {
        const projectTags = await extractProjectTags(projectSqClient);
        await migrateProjectTags(scProjectKey, projectTags, projectScClient);
      }),
      runGuardedStep('Project links', 'project_links', async () => {
        const projectLinks = await extractProjectLinks(projectSqClient, project.key);
        await migrateProjectLinks(scProjectKey, projectLinks, projectScClient);
      }),
      runGuardedStep('New code definitions', 'new_code_definitions', async () => {
        const newCodePeriods = await extractNewCodePeriods(projectSqClient, project.key);
        return await migrateNewCodePeriods(scProjectKey, newCodePeriods, projectScClient);
      }),
      runGuardedStep('DevOps binding', 'devops_binding', async () => {
        const binding = extractedData.projectBindings.get(project.key);
        await migrateDevOpsBinding(scProjectKey, binding, projectScClient);
      }),
    ]);
  } else if (onlyComponents) {
    for (const step of ['Project settings', 'Project tags', 'Project links', 'New code definitions', 'DevOps binding']) {
      projectResult.steps.push({ step, status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    }
  }

  // Quality gate, quality profiles, permissions (parallel)
  await Promise.all([
    (async () => {
      if (shouldRun('quality-gates')) {
        await runGuardedStep('Assign quality gate', 'assign_quality_gate', async () => {
          const projectGate = await projectSqClient.getQualityGate();
          if (projectGate && gateMapping.has(projectGate.name)) {
            await assignQualityGatesToProjects(gateMapping, [{ projectKey: scProjectKey, gateName: projectGate.name }], projectScClient);
          }
        });
      } else if (onlyComponents) {
        projectResult.steps.push({ step: 'Assign quality gate', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
    (async () => {
      if (shouldRun('quality-profiles') && builtInProfileMapping && builtInProfileMapping.size > 0) {
        await runGuardedStep('Assign quality profiles', 'assign_quality_profiles', async () => {
          let assigned = 0;
          for (const [language, profileName] of builtInProfileMapping) {
            try {
              await projectScClient.addQualityProfileToProject(language, profileName, scProjectKey);
              assigned++;
            } catch (error) {
              logger.debug(`Could not assign profile "${profileName}" (${language}) to ${scProjectKey}: ${error.message}`);
            }
          }
          return `${assigned} profiles assigned`;
        });
      } else if (onlyComponents && builtInProfileMapping && builtInProfileMapping.size > 0) {
        projectResult.steps.push({ step: 'Assign quality profiles', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
    (async () => {
      if (shouldRun('permissions')) {
        await runGuardedStep('Project permissions', 'project_permissions', async () => {
          const projectPerms = await extractProjectPermissions(projectSqClient, project.key);
          await migrateProjectPermissions(scProjectKey, projectPerms, projectScClient);
        });
      } else if (onlyComponents) {
        projectResult.steps.push({ step: 'Project permissions', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
  ]);
}

export async function runGuardedStep(projectResult, stepName, journalKey, stepDone, recStep, fn) {
  if (stepDone && stepDone(journalKey)) {
    logger.info(`${stepName} — already completed, skipping`);
    projectResult.steps.push({ step: stepName, status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    return;
  }
  await runProjectStep(projectResult, stepName, fn);
  const lastStep = projectResult.steps.at(-1);
  if (recStep && lastStep && lastStep.status !== 'failed') await recStep(journalKey);
}

export async function runProjectStep(projectResult, stepName, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    if (result && result.skipped) {
      projectResult.steps.push({ step: stepName, status: 'skipped', detail: result.detail || '', durationMs });
    } else {
      projectResult.steps.push({ step: stepName, status: 'success', durationMs });
    }
  } catch (error) {
    projectResult.steps.push({ step: stepName, status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
  }
}
