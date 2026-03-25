import { extractQualityGates } from '../../../sonarqube/extractors/quality-gates.js';
import { extractQualityProfiles } from '../../../sonarqube/extractors/quality-profiles.js';
import { extractGroups } from '../../../sonarqube/extractors/groups.js';
import { extractGlobalPermissions, extractPermissionTemplates } from '../../../sonarqube/extractors/permissions.js';
import { extractPortfolios } from '../../../sonarqube/extractors/portfolios.js';
import { extractServerInfo } from '../../../sonarqube/extractors/server-info.js';
import { extractWebhooks } from '../../../sonarqube/extractors/webhooks.js';
import { extractAlmSettings, extractAllProjectBindings } from '../../../sonarqube/extractors/devops-bindings.js';
import { runNonFatalExtraction } from './run-non-fatal-extraction.js';
import { extractCoreServerData } from './extract-core-server-data.js';
import { extractDevOpsBindings } from './extract-devops-bindings.js';
import { extractAllProjectBranches } from './extract-all-project-branches.js';

// -------- Extract Server-Wide Data --------

/** Orchestrate extraction of all server-wide data. */
export async function extractServerWideData(sqClient, allProjects, results, perfConfig) {
  const extractors = { extractQualityGates, extractQualityProfiles, extractGroups, extractGlobalPermissions, extractPermissionTemplates, extractPortfolios, extractServerInfo, extractWebhooks };
  const core = await extractCoreServerData(sqClient, results, extractors);

  const { almSettings, projectBindings } = await extractDevOpsBindings(sqClient, allProjects, results, perfConfig, { extractAlmSettings, extractAllProjectBindings });

  const projectBranches = await runNonFatalExtraction(results, 'project branches',
    () => extractAllProjectBranches(sqClient, allProjects, perfConfig),
    d => `branches for ${d.size} projects`) || new Map();

  return { projects: allProjects, ...core, almSettings, projectBindings, projectBranches };
}
