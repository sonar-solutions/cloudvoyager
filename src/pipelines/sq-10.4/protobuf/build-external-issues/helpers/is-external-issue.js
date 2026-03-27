// -------- Check if Issue Belongs to an External Engine --------

import { FALLBACK_SONARCLOUD_REPOS } from '../../../../../shared/utils/fallback-repos/index.js';

export function isExternalIssue(issue, sonarCloudRepos) {
  // Rules without a colon are native SonarQube rules — never external
  if (!issue.rule?.includes(':')) return false;

  const repo = issue.rule.split(':')[0];
  // Empty repo part (e.g. ":S100") is treated as native — not external
  if (!repo) return false;

  // SonarQube 2025+ prefixes external linter repos with "external_"
  // (e.g. "external_ruff:D200") — these are always external issues
  if (repo.startsWith('external_')) return true;

  const repos = (sonarCloudRepos && sonarCloudRepos.size > 0)
    ? sonarCloudRepos
    : FALLBACK_SONARCLOUD_REPOS;

  return !repos.has(repo);
}
