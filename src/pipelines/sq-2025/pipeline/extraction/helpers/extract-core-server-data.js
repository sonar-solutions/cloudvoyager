import { runNonFatalExtraction } from './run-non-fatal-extraction.js';

// -------- Extract Core Server Data --------

/** Extract quality gates, profiles, groups, permissions, portfolios, server info, webhooks. */
export async function extractCoreServerData(sqClient, results, ext) {
  const [qualityGates, qualityProfiles, groups, globalPermissions, permissionTemplates, portfolios, serverInfo, serverWebhooks] = await Promise.all([
    runNonFatalExtraction(results, 'quality gates', () => ext.extractQualityGates(sqClient), d => `${d.length} found`).then(d => d || []),
    runNonFatalExtraction(results, 'quality profiles', () => ext.extractQualityProfiles(sqClient), d => `${d.length} found`).then(d => d || []),
    runNonFatalExtraction(results, 'groups', () => ext.extractGroups(sqClient), d => `${d.length} found`).then(d => d || []),
    runNonFatalExtraction(results, 'global permissions', () => ext.extractGlobalPermissions(sqClient)).then(d => d || []),
    runNonFatalExtraction(results, 'permission templates', () => ext.extractPermissionTemplates(sqClient)).then(d => d || { templates: [], defaultTemplates: [] }),
    runNonFatalExtraction(results, 'portfolios', () => ext.extractPortfolios(sqClient), d => `${d.length} found`).then(d => d || []),
    runNonFatalExtraction(results, 'server info', () => ext.extractServerInfo(sqClient)).then(d => d || { system: {}, plugins: [], settings: [] }),
    runNonFatalExtraction(results, 'webhooks', () => ext.extractWebhooks(sqClient)).then(d => d || []),
  ]);

  return { qualityGates, qualityProfiles, groups, globalPermissions, permissionTemplates, portfolios, serverInfo, serverWebhooks };
}
