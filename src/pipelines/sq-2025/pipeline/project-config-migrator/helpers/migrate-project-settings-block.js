import { extractProjectSettings } from '../../../sonarqube/extractors/project-settings.js';
import { extractProjectTags } from '../../../sonarqube/extractors/project-tags.js';
import { extractProjectLinks } from '../../../sonarqube/extractors/project-links.js';
import { extractNewCodePeriods } from '../../../sonarqube/extractors/new-code-periods.js';
import { migrateProjectSettings, migrateProjectTags, migrateProjectLinks, migrateNewCodePeriods, migrateDevOpsBinding } from '../../../sonarcloud/migrators/project-config.js';

// -------- Migrate Project Settings Block --------

/** Run the parallel project-settings block (settings, tags, links, new code, devops). */
export async function migrateProjectSettingsBlock(project, scProjectKey, projectSqClient, projectScClient, extractedData, guard) {
  await Promise.all([
    guard('Project settings', 'project_settings', async () => {
      const s = await extractProjectSettings(projectSqClient, project.key);
      await migrateProjectSettings(scProjectKey, s, projectScClient);
    }),
    guard('Project tags', 'project_tags', async () => {
      const t = await extractProjectTags(projectSqClient);
      await migrateProjectTags(scProjectKey, t, projectScClient);
    }),
    guard('Project links', 'project_links', async () => {
      const l = await extractProjectLinks(projectSqClient, project.key);
      await migrateProjectLinks(scProjectKey, l, projectScClient);
    }),
    guard('New code definitions', 'new_code_definitions', async () => {
      const n = await extractNewCodePeriods(projectSqClient, project.key);
      return await migrateNewCodePeriods(scProjectKey, n, projectScClient);
    }),
    guard('DevOps binding', 'devops_binding', async () => {
      const binding = extractedData.projectBindings.get(project.key);
      await migrateDevOpsBinding(scProjectKey, binding, projectScClient);
    }),
  ]);
}
