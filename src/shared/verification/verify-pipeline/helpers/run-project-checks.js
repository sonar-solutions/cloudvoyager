// -------- Run Per-Project Checks --------

import { verifyIssues } from '../../checkers/issues.js';
import { verifyHotspots } from '../../checkers/hotspots.js';
import { verifyBranches } from '../../checkers/branches.js';
import { verifyMeasures } from '../../checkers/measures.js';
import { verifyProjectQualityGate } from '../../checkers/quality-gates.js';
import { verifyProjectQualityProfiles } from '../../checkers/quality-profiles.js';
import { verifyProjectPermissions } from '../../checkers/permissions.js';
import { verifyProjectSettings, verifyProjectTags, verifyProjectLinks, verifyNewCodePeriods, verifyDevOpsBinding } from '../../checkers/project-config.js';
import { safeCheck } from './safe-check.js';

/** Queue all per-project checks into an array of promises. */
export function queueProjectChecks(sqC, scC, projectKey, scKey, result, shouldRun, perfConfig) {
  const checks = [];
  const c = result.checks;
  if (shouldRun('scan-data') || shouldRun('scan-data-all-branches'))
    checks.push(safeCheck(() => verifyBranches(sqC, scC, scKey)).then(r => { c.branches = r; }));
  if (shouldRun('issue-metadata'))
    checks.push(safeCheck(() => verifyIssues(sqC, scC, scKey, { concurrency: perfConfig.issueSync?.concurrency || 5 })).then(r => { c.issues = r; }));
  if (shouldRun('hotspot-metadata'))
    checks.push(safeCheck(() => verifyHotspots(sqC, scC, scKey, { concurrency: perfConfig.hotspotSync?.concurrency || 3 })).then(r => { c.hotspots = r; }));
  if (shouldRun('scan-data'))
    checks.push(safeCheck(() => verifyMeasures(sqC, scC, scKey)).then(r => { c.measures = r; }));
  if (shouldRun('quality-gates'))
    checks.push(safeCheck(() => verifyProjectQualityGate(sqC, scC, scKey)).then(r => { c.qualityGate = r; }));
  if (shouldRun('quality-profiles'))
    checks.push(safeCheck(() => verifyProjectQualityProfiles(sqC, scC, scKey)).then(r => { c.qualityProfiles = r; }));
  if (shouldRun('project-settings')) {
    checks.push(
      safeCheck(() => verifyProjectSettings(sqC, scC, projectKey, scKey)).then(r => { c.settings = r; }),
      safeCheck(() => verifyProjectTags(sqC, scC, scKey)).then(r => { c.tags = r; }),
      safeCheck(() => verifyProjectLinks(sqC, scC, projectKey, scKey)).then(r => { c.links = r; }),
      safeCheck(() => verifyNewCodePeriods(sqC, scC, projectKey, scKey)).then(r => { c.newCodePeriods = r; }),
      safeCheck(() => verifyDevOpsBinding(sqC, scC, projectKey, scKey)).then(r => { c.devopsBinding = r; }),
    );
  }
  if (shouldRun('permissions'))
    checks.push(safeCheck(() => verifyProjectPermissions(sqC, scC, projectKey, scKey)).then(r => { c.permissions = r; }));
  return checks;
}
