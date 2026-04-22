// -------- Extract Changesets --------

import logger from '../../../../../shared/utils/logger.js';
import { buildStubChangeset } from './helpers/build-stub-changeset.js';
import { resolveLineCount } from './helpers/resolve-line-count.js';

export async function extractChangesets(client, sourceFiles, components, issues = []) {
  logger.info('Extracting SCM changeset data...');
  const changesets = new Map();

  // Index issues by component key for fast lookup
  const issuesByComponent = new Map();
  for (const issue of issues) {
    if (!issue.component) continue;
    if (!issuesByComponent.has(issue.component)) {
      issuesByComponent.set(issue.component, []);
    }
    issuesByComponent.get(issue.component).push(issue);
  }

  for (const file of sourceFiles) {
    if (!file?.key) {
      logger.warn('Skipping file without key in changesets extraction');
      continue;
    }
    try {
      const lineCount = resolveLineCount(file, components);
      const fileIssues = issuesByComponent.get(file.key) || [];
      changesets.set(file.key, buildStubChangeset(lineCount, fileIssues));
    } catch (error) {
      logger.warn(`Failed to create changeset for ${file.key}: ${error.message}`);
    }
  }

  logger.info(`Created ${changesets.size} changeset entries`);
  return changesets;
}
