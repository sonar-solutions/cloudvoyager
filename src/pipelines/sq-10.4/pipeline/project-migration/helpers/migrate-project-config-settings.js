import { extractProjectSettings } from '../../../sonarqube/extractors/project-settings.js';
import { extractProjectTags } from '../../../sonarqube/extractors/project-tags.js';
import { extractProjectLinks } from '../../../sonarqube/extractors/project-links.js';
import { extractNewCodePeriods } from '../../../sonarqube/extractors/new-code-periods.js';
import { migrateProjectSettings, migrateProjectTags, migrateProjectLinks, migrateNewCodePeriods, migrateDevOpsBinding } from '../../../sonarcloud/migrators/project-config.js';

// -------- Main Logic --------

/**
 * Migrate project settings, tags, links, new code definitions, and DevOps binding.
 */
export async function migrateProjectConfigSettings(project, scProjectKey, projectSqClient, projectScClient, extractedData, projectResult, onlyComponents, shouldRun, runGuardedStep) {
  if (!shouldRun('project-settings')) {
    if (onlyComponents) {
      for (const step of ['Project settings', 'Project tags', 'Project links', 'New code definitions', 'DevOps binding']) {
        projectResult.steps.push({ step, status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    }
    return;
  }

  await Promise.all([
    runGuardedStep('Project settings', 'project_settings', async () => {
      const settings = await extractProjectSettings(projectSqClient, project.key);
      await migrateProjectSettings(scProjectKey, settings, projectScClient);
    }),
    runGuardedStep('Project tags', 'project_tags', async () => {
      const tags = await extractProjectTags(projectSqClient);
      await migrateProjectTags(scProjectKey, tags, projectScClient);
    }),
    runGuardedStep('Project links', 'project_links', async () => {
      const links = await extractProjectLinks(projectSqClient, project.key);
      await migrateProjectLinks(scProjectKey, links, projectScClient);
    }),
    runGuardedStep('New code definitions', 'new_code_definitions', async () => {
      const periods = await extractNewCodePeriods(projectSqClient, project.key);
      return await migrateNewCodePeriods(scProjectKey, periods, projectScClient);
    }),
    runGuardedStep('DevOps binding', 'devops_binding', async () => {
      const binding = extractedData.projectBindings.get(project.key);
      await migrateDevOpsBinding(scProjectKey, binding, projectScClient);
    }),
  ]);
}
