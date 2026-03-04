import { mkdir } from 'node:fs/promises';
import { SonarQubeClient } from '../sonarqube/api-client.js';
import { SonarCloudClient } from '../sonarcloud/api-client.js';
import { resolvePerformanceConfig, collectEnvironmentInfo } from '../utils/concurrency.js';
import { mapProjectsToOrganizations } from '../mapping/org-mapper.js';
import logger from '../utils/logger.js';

import { verifyIssues } from './checkers/issues.js';
import { verifyHotspots } from './checkers/hotspots.js';
import { verifyBranches } from './checkers/branches.js';
import { verifyMeasures } from './checkers/measures.js';
import { verifyQualityGates, verifyProjectQualityGate } from './checkers/quality-gates.js';
import { verifyQualityProfiles, verifyProjectQualityProfiles } from './checkers/quality-profiles.js';
import { verifyGroups } from './checkers/groups.js';
import { verifyGlobalPermissions, verifyProjectPermissions, verifyPermissionTemplates } from './checkers/permissions.js';
import { verifyProjectSettings, verifyProjectTags, verifyProjectLinks, verifyNewCodePeriods, verifyDevOpsBinding } from './checkers/project-config.js';
import { verifyPortfolios } from './checkers/portfolios.js';
import { writeVerificationReports, logVerificationSummary } from './reports/index.js';

/**
 * Run the full verification pipeline.
 *
 * @param {object} options
 * @param {object} options.sonarqubeConfig - { url, token }
 * @param {Array} options.sonarcloudOrgs - [{ key, token, url }]
 * @param {object} [options.performanceConfig] - Performance settings
 * @param {object} [options.rateLimitConfig] - Rate limit settings
 * @param {string} [options.outputDir] - Output directory for reports
 * @param {Array} [options.onlyComponents] - Optional component filter
 * @returns {Promise<object>} Verification results
 */
export async function verifyAll(options) {
  const {
    sonarqubeConfig,
    sonarcloudOrgs,
    rateLimitConfig,
    performanceConfig: rawPerfConfig = {},
    outputDir = './verification-output',
    onlyComponents = null
  } = options;

  const perfConfig = resolvePerformanceConfig(rawPerfConfig);
  const results = createEmptyResults();
  results.environment = collectEnvironmentInfo();
  results.startTime = new Date().toISOString();

  await mkdir(outputDir, { recursive: true });

  const shouldRun = (comp) => !onlyComponents || onlyComponents.includes(comp);

  try {
    // Step 1: Connect to SonarQube
    logger.info('=== Step 1: Connecting to SonarQube ===');
    const sqClient = new SonarQubeClient({ url: sonarqubeConfig.url, token: sonarqubeConfig.token });
    await sqClient.testConnection();

    // Step 2: Fetch all projects from SonarQube
    logger.info('=== Step 2: Fetching project list from SonarQube ===');
    const allProjects = await sqClient.listAllProjects();
    logger.info(`Found ${allProjects.length} projects in SonarQube`);

    // Step 3: Build org → project mapping
    logger.info('=== Step 3: Building organization mappings ===');
    const projectBindings = new Map();
    for (const project of allProjects) {
      try {
        const binding = await sqClient.getProjectBinding(project.key);
        if (binding) projectBindings.set(project.key, binding);
      } catch (_) { /* no binding */ }
    }

    const orgMapping = mapProjectsToOrganizations(allProjects, projectBindings, sonarcloudOrgs);

    // Step 4: Verify each organization
    for (const assignment of orgMapping.orgAssignments) {
      const { org, projects } = assignment;
      if (projects.length === 0) continue;

      logger.info('\n========================================');
      logger.info(`=== Verifying organization: ${org.key} (${projects.length} projects) ===`);
      logger.info('========================================');

      const scClient = new SonarCloudClient({
        url: org.url || 'https://sonarcloud.io',
        token: org.token,
        organization: org.key,
        rateLimit: rateLimitConfig
      });

      try {
        await scClient.testConnection();
      } catch (error) {
        logger.error(`Failed to connect to SC org ${org.key}: ${error.message}`);
        results.orgResults.push({ orgKey: org.key, error: error.message, checks: {} });
        continue;
      }

      const orgResult = { orgKey: org.key, checks: {} };

      // Org-wide checks
      if (shouldRun('quality-gates')) {
        logger.info('--- Verifying quality gates ---');
        orgResult.checks.qualityGates = await safeCheck(() => verifyQualityGates(sqClient, scClient));
      }

      if (shouldRun('quality-profiles')) {
        logger.info('--- Verifying quality profiles ---');
        orgResult.checks.qualityProfiles = await safeCheck(() => verifyQualityProfiles(sqClient, scClient));
      }

      if (shouldRun('permissions')) {
        logger.info('--- Verifying groups ---');
        orgResult.checks.groups = await safeCheck(() => verifyGroups(sqClient, scClient));

        logger.info('--- Verifying global permissions ---');
        orgResult.checks.globalPermissions = await safeCheck(() => verifyGlobalPermissions(sqClient, scClient));

        logger.info('--- Verifying permission templates ---');
        orgResult.checks.permissionTemplates = await safeCheck(() => verifyPermissionTemplates(sqClient, scClient));
      }

      results.orgResults.push(orgResult);

      // Per-project checks
      const scProjects = await scClient.listProjects();
      const scProjectKeys = new Set(scProjects.map(p => p.key));

      for (let i = 0; i < projects.length; i++) {
        const project = projects[i];
        logger.info(`\n--- Project ${i + 1}/${projects.length}: ${project.key} ---`);

        // Resolve SC project key (same logic as migrate)
        let scProjectKey = project.key;
        const globalCheck = await scClient.isProjectKeyTakenGlobally(project.key);
        if (globalCheck.taken && globalCheck.owner !== org.key) {
          scProjectKey = `${org.key}_${project.key}`;
        }

        const projectResult = {
          sqProjectKey: project.key,
          scProjectKey,
          checks: {}
        };

        // Existence check
        const exists = scProjectKeys.has(scProjectKey) || await scClient.projectExists();
        projectResult.checks.existence = { status: exists ? 'pass' : 'fail' };

        if (!exists) {
          logger.warn(`Project ${scProjectKey} not found in SonarCloud — skipping all checks`);
          results.projectResults.push(projectResult);
          continue;
        }

        const projectSqClient = new SonarQubeClient({
          url: sonarqubeConfig.url, token: sonarqubeConfig.token, projectKey: project.key
        });
        const projectScClient = new SonarCloudClient({
          url: org.url || 'https://sonarcloud.io', token: org.token,
          organization: org.key, projectKey: scProjectKey, rateLimit: rateLimitConfig
        });

        // Branch check
        if (shouldRun('scan-data') || shouldRun('scan-data-all-branches')) {
          projectResult.checks.branches = await safeCheck(() =>
            verifyBranches(projectSqClient, projectScClient, scProjectKey)
          );
        }

        // Issue check
        if (shouldRun('issue-metadata')) {
          projectResult.checks.issues = await safeCheck(() =>
            verifyIssues(projectSqClient, projectScClient, scProjectKey, { concurrency: perfConfig.issueSync?.concurrency || 5 })
          );
        }

        // Hotspot check
        if (shouldRun('hotspot-metadata')) {
          projectResult.checks.hotspots = await safeCheck(() =>
            verifyHotspots(projectSqClient, projectScClient, scProjectKey, { concurrency: perfConfig.hotspotSync?.concurrency || 3 })
          );
        }

        // Measures check
        if (shouldRun('scan-data')) {
          projectResult.checks.measures = await safeCheck(() =>
            verifyMeasures(projectSqClient, projectScClient, scProjectKey)
          );
        }

        // Quality gate assignment
        if (shouldRun('quality-gates')) {
          projectResult.checks.qualityGate = await safeCheck(() =>
            verifyProjectQualityGate(projectSqClient, projectScClient, scProjectKey)
          );
        }

        // Quality profile assignment
        if (shouldRun('quality-profiles')) {
          projectResult.checks.qualityProfiles = await safeCheck(() =>
            verifyProjectQualityProfiles(projectSqClient, projectScClient, scProjectKey)
          );
        }

        // Project config checks
        if (shouldRun('project-settings')) {
          projectResult.checks.settings = await safeCheck(() =>
            verifyProjectSettings(projectSqClient, projectScClient, project.key, scProjectKey)
          );
          projectResult.checks.tags = await safeCheck(() =>
            verifyProjectTags(projectSqClient, projectScClient, scProjectKey)
          );
          projectResult.checks.links = await safeCheck(() =>
            verifyProjectLinks(projectSqClient, projectScClient, project.key, scProjectKey)
          );
          projectResult.checks.newCodePeriods = await safeCheck(() =>
            verifyNewCodePeriods(projectSqClient, projectScClient, project.key, scProjectKey)
          );
          projectResult.checks.devopsBinding = await safeCheck(() =>
            verifyDevOpsBinding(projectSqClient, projectScClient, project.key, scProjectKey)
          );
        }

        // Project permissions
        if (shouldRun('permissions')) {
          projectResult.checks.permissions = await safeCheck(() =>
            verifyProjectPermissions(projectSqClient, projectScClient, project.key, scProjectKey)
          );
        }

        results.projectResults.push(projectResult);
      }
    }

    // Portfolio check (reference only)
    if (shouldRun('portfolios')) {
      logger.info('\n--- Verifying portfolios ---');
      results.portfolios = await safeCheck(() => verifyPortfolios(sqClient));
    }

  } finally {
    results.endTime = new Date().toISOString();
    computeSummary(results);
    logVerificationSummary(results);

    try {
      await writeVerificationReports(results, outputDir);
    } catch (error) {
      logger.error(`Failed to write verification reports: ${error.message}`);
    }
  }

  return results;
}

function createEmptyResults() {
  return {
    startTime: null,
    endTime: null,
    summary: { totalChecks: 0, passed: 0, failed: 0, warnings: 0, skipped: 0, errors: 0 },
    orgResults: [],
    projectResults: [],
    portfolios: null,
    environment: null
  };
}

async function safeCheck(fn) {
  try {
    return await fn();
  } catch (error) {
    logger.error(`Check failed: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}

function computeSummary(results) {
  let total = 0, passed = 0, failed = 0, warnings = 0, skipped = 0, errors = 0;

  function countCheck(check) {
    if (!check) return;
    total++;
    if (check.status === 'pass') passed++;
    else if (check.status === 'fail') failed++;
    else if (check.status === 'skipped') skipped++;
    else if (check.status === 'error') errors++;

    // Count unsyncable items as warnings
    if (check.unsyncable) {
      const unsyncCount = Object.values(check.unsyncable).reduce((sum, v) => {
        return sum + (typeof v === 'number' ? v : 0);
      }, 0);
      if (unsyncCount > 0) warnings += unsyncCount;
    }
  }

  for (const org of results.orgResults) {
    for (const check of Object.values(org.checks || {})) {
      countCheck(check);
    }
  }

  for (const project of results.projectResults) {
    for (const check of Object.values(project.checks || {})) {
      countCheck(check);
    }
  }

  if (results.portfolios) countCheck(results.portfolios);

  results.summary = { totalChecks: total, passed, failed, warnings, skipped, errors };
}
