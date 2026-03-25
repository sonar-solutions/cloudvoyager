// -------- Run Org-Wide Checks --------

import logger from '../../../utils/logger.js';
import { verifyQualityGates } from '../../checkers/quality-gates.js';
import { verifyQualityProfiles } from '../../checkers/quality-profiles.js';
import { verifyGroups } from '../../checkers/groups.js';
import { verifyGlobalPermissions, verifyPermissionTemplates } from '../../checkers/permissions.js';
import { safeCheck } from './safe-check.js';

/**
 * Run all org-level checks in parallel.
 * @param {object} sqClient - SonarQube client
 * @param {object} scClient - SonarCloud client
 * @param {object} orgResult - Org result object to populate
 * @param {function} shouldRun - Component filter predicate
 */
export async function runOrgChecks(sqClient, scClient, orgResult, shouldRun) {
  const orgChecks = [];

  if (shouldRun('quality-gates')) {
    logger.info('--- Verifying quality gates ---');
    orgChecks.push(safeCheck(() => verifyQualityGates(sqClient, scClient))
      .then(r => { orgResult.checks.qualityGates = r; }));
  }

  if (shouldRun('quality-profiles')) {
    logger.info('--- Verifying quality profiles ---');
    orgChecks.push(safeCheck(() => verifyQualityProfiles(sqClient, scClient))
      .then(r => { orgResult.checks.qualityProfiles = r; }));
  }

  if (shouldRun('permissions')) {
    logger.info('--- Verifying groups, global permissions, permission templates ---');
    orgChecks.push(safeCheck(() => verifyGroups(sqClient, scClient))
      .then(r => { orgResult.checks.groups = r; }));
    orgChecks.push(safeCheck(() => verifyGlobalPermissions(sqClient, scClient))
      .then(r => { orgResult.checks.globalPermissions = r; }));
    orgChecks.push(safeCheck(() => verifyPermissionTemplates(sqClient, scClient))
      .then(r => { orgResult.checks.permissionTemplates = r; }));
  }

  await Promise.all(orgChecks);
}
