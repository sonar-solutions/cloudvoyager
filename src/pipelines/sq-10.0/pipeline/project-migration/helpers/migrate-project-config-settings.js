import logger from '../../../../../shared/utils/logger.js';
import { extractProjectSettings } from '../../../sonarqube/extractors/project-settings.js';
import { extractProjectTags } from '../../../sonarqube/extractors/project-tags.js';
import { extractProjectLinks } from '../../../sonarqube/extractors/project-links.js';
import { extractNewCodePeriods } from '../../../sonarqube/extractors/new-code-periods.js';
import { migrateProjectSettings, migrateProjectTags, migrateProjectLinks, migrateNewCodePeriods, migrateDevOpsBinding } from '../../../sonarcloud/migrators/project-config.js';

// -------- Migrate Project Config: Settings, Tags, Links --------

export async function migrateProjectConfigSettings(project, scProjectKey, projectSqClient, projectScClient, extractedData, projectResult, onlyComponents, runGuardedStep) {
  const shouldRun = (comp) => !onlyComponents || onlyComponents.includes(comp);
  if (!shouldRun('project-settings')) {
    for (const step of ['Project settings', 'Project tags', 'Project links', 'New code definitions', 'DevOps binding']) {
      projectResult.steps.push({ step, status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    }
    return;
  }
  await Promise.all([
    runGuardedStep('Project settings', 'project_settings', async () => {
      const s = await extractProjectSettings(projectSqClient, project.key);
      await migrateProjectSettings(scProjectKey, s, projectScClient);
    }),
    runGuardedStep('Project tags', 'project_tags', async () => {
      const t = await extractProjectTags(projectSqClient);
      await migrateProjectTags(scProjectKey, t, projectScClient);
    }),
    runGuardedStep('Project links', 'project_links', async () => {
      const l = await extractProjectLinks(projectSqClient, project.key);
      await migrateProjectLinks(scProjectKey, l, projectScClient);
    }),
    runGuardedStep('New code definitions', 'new_code_definitions', async () => {
      const n = await extractNewCodePeriods(projectSqClient, project.key);
      return await migrateNewCodePeriods(scProjectKey, n, projectScClient);
    }),
    runGuardedStep('DevOps binding', 'devops_binding', async () => {
      const binding = extractedData.projectBindings.get(project.key);
      await migrateDevOpsBinding(scProjectKey, binding, projectScClient);
    }),
  ]);
}
