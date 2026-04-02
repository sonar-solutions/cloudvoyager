import { extractProjectSettings } from '../../../sonarqube/extractors/project-settings.js';
import { extractProjectTags } from '../../../sonarqube/extractors/project-tags.js';
import { extractProjectLinks } from '../../../sonarqube/extractors/project-links.js';
import { extractNewCodePeriods } from '../../../sonarqube/extractors/new-code-periods.js';
import { migrateProjectSettings, migrateProjectTags, migrateProjectLinks, migrateNewCodePeriods, migrateDevOpsBinding } from '../../../sonarcloud/migrators/project-config.js';
import { runGuardedStep } from './run-guarded-step.js';
import { migrateGateIfNeeded } from './migrate-quality-gate.js';
import { migrateProfilesIfNeeded } from './migrate-quality-profiles.js';
import { migratePermsIfNeeded } from './migrate-project-perms.js';

// -------- Migrate Project Config --------

export async function migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, onlyComponents, journal = {}) {
  const shouldRun = (comp) => !onlyComponents || onlyComponents.includes(comp);
  const { isStepDone: stepDone, recordStep: recStep } = journal;

  // Settings + gates run in parallel (fully independent)
  await Promise.all([
    (async () => {
      if (shouldRun('project-settings')) {
        await Promise.all([
          runGuardedStep(projectResult, 'Project settings', 'project_settings', stepDone, recStep, async () => { const s = await extractProjectSettings(projectSqClient, project.key); await migrateProjectSettings(scProjectKey, s, projectScClient); }),
          runGuardedStep(projectResult, 'Project tags', 'project_tags', stepDone, recStep, async () => { const t = await extractProjectTags(projectSqClient); await migrateProjectTags(scProjectKey, t, projectScClient); }),
          runGuardedStep(projectResult, 'Project links', 'project_links', stepDone, recStep, async () => { const l = await extractProjectLinks(projectSqClient, project.key); await migrateProjectLinks(scProjectKey, l, projectScClient); }),
          runGuardedStep(projectResult, 'New code definitions', 'new_code_definitions', stepDone, recStep, async () => { const n = await extractNewCodePeriods(projectSqClient, project.key); return await migrateNewCodePeriods(scProjectKey, n, projectScClient); }),
          runGuardedStep(projectResult, 'DevOps binding', 'devops_binding', stepDone, recStep, async () => { const b = extractedData.projectBindings.get(project.key); await migrateDevOpsBinding(scProjectKey, b, projectScClient); }),
        ]);
      } else if (onlyComponents) {
        for (const step of ['Project settings', 'Project tags', 'Project links', 'New code definitions', 'DevOps binding']) {
          projectResult.steps.push({ step, status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
        }
      }
    })(),
    migrateGateIfNeeded(scProjectKey, projectSqClient, projectScClient, gateMapping, projectResult, onlyComponents, stepDone, recStep, shouldRun),
    migrateProfilesIfNeeded(scProjectKey, projectScClient, projectResult, builtInProfileMapping, onlyComponents, stepDone, recStep, shouldRun),
    migratePermsIfNeeded(project, scProjectKey, projectSqClient, projectScClient, projectResult, onlyComponents, stepDone, recStep, shouldRun),
  ]);
}
