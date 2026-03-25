import { extractQualityGates } from '../../../sonarqube/extractors/quality-gates.js';
import { extractQualityProfiles } from '../../../sonarqube/extractors/quality-profiles.js';
import { extractGroups } from '../../../sonarqube/extractors/groups.js';
import { extractGlobalPermissions, extractPermissionTemplates } from '../../../sonarqube/extractors/permissions.js';
import { extractPortfolios } from '../../../sonarqube/extractors/portfolios.js';
import { extractServerInfo } from '../../../sonarqube/extractors/server-info.js';
import { extractWebhooks } from '../../../sonarqube/extractors/webhooks.js';
import { extractAlmSettings, extractAllProjectBindings } from '../../../sonarqube/extractors/devops-bindings.js';
import { runNonFatalExtraction } from './run-non-fatal-extraction.js';
import { extractAllProjectBranches } from './extract-all-project-branches.js';

// -------- Main Logic --------

// Extract all server-wide data from SonarQube.
export async function extractServerWideData(sqClient, allProjects, results, perfConfig) {
  const [qualityGates, qualityProfiles, groups, globalPermissions, permissionTemplates, portfolios, serverInfo, serverWebhooks] = await Promise.all([
    runNonFatalExtraction(results, 'quality gates', () => extractQualityGates(sqClient), d => `${d.length} found`).then(d => d || []),
    runNonFatalExtraction(results, 'quality profiles', () => extractQualityProfiles(sqClient), d => `${d.length} found`).then(d => d || []),
    runNonFatalExtraction(results, 'groups', () => extractGroups(sqClient), d => `${d.length} found`).then(d => d || []),
    runNonFatalExtraction(results, 'global permissions', () => extractGlobalPermissions(sqClient)).then(d => d || []),
    runNonFatalExtraction(results, 'permission templates', () => extractPermissionTemplates(sqClient)).then(d => d || { templates: [], defaultTemplates: [] }),
    runNonFatalExtraction(results, 'portfolios', () => extractPortfolios(sqClient), d => `${d.length} found`).then(d => d || []),
    runNonFatalExtraction(results, 'server info', () => extractServerInfo(sqClient)).then(d => d || { system: {}, plugins: [], settings: [] }),
    runNonFatalExtraction(results, 'webhooks', () => extractWebhooks(sqClient)).then(d => d || [])
  ]);

  let almSettings = [], projectBindings = new Map();
  const bindingsResult = await runNonFatalExtraction(results, 'DevOps bindings', async () => {
    const [alm, bindings] = await Promise.all([extractAlmSettings(sqClient), extractAllProjectBindings(sqClient, allProjects, { concurrency: perfConfig.maxConcurrency })]);
    return { alm, bindings };
  });
  if (bindingsResult) { almSettings = bindingsResult.alm; projectBindings = bindingsResult.bindings; }

  const projectBranches = await runNonFatalExtraction(results, 'project branches', () => extractAllProjectBranches(sqClient, allProjects, perfConfig), d => `branches for ${d.size} projects`) || new Map();

  return { projects: allProjects, qualityGates, qualityProfiles, groups, globalPermissions, permissionTemplates, portfolios, almSettings, projectBindings, projectBranches, serverInfo, serverWebhooks };
}
