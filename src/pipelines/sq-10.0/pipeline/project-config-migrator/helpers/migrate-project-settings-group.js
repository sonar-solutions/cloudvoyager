import { extractProjectSettings } from '../../../sonarqube/extractors/project-settings.js';
import { extractProjectTags } from '../../../sonarqube/extractors/project-tags.js';
import { extractProjectLinks } from '../../../sonarqube/extractors/project-links.js';
import { extractNewCodePeriods } from '../../../sonarqube/extractors/new-code-periods.js';
import { migrateProjectSettings, migrateProjectTags, migrateProjectLinks, migrateNewCodePeriods, migrateDevOpsBinding } from '../../../sonarcloud/migrators/project-config.js';

// -------- Migrate Project Settings Group --------

export async function migrateProjectSettingsGroup(project, scProjectKey, projectSqClient, projectScClient, extractedData, projectResult, guardedStep) {
  await Promise.all([
    guardedStep('Project settings', 'project_settings', async () => {
      const s = await extractProjectSettings(projectSqClient, project.key);
      await migrateProjectSettings(scProjectKey, s, projectScClient);
    }),
    guardedStep('Project tags', 'project_tags', async () => {
      const t = await extractProjectTags(projectSqClient);
      await migrateProjectTags(scProjectKey, t, projectScClient);
    }),
    guardedStep('Project links', 'project_links', async () => {
      const l = await extractProjectLinks(projectSqClient, project.key);
      await migrateProjectLinks(scProjectKey, l, projectScClient);
    }),
    guardedStep('New code definitions', 'new_code_definitions', async () => {
      const ncp = await extractNewCodePeriods(projectSqClient, project.key);
      return await migrateNewCodePeriods(scProjectKey, ncp, projectScClient);
    }),
    guardedStep('DevOps binding', 'devops_binding', async () => {
      const binding = extractedData.projectBindings.get(project.key);
      await migrateDevOpsBinding(scProjectKey, binding, projectScClient);
    }),
  ]);
}
