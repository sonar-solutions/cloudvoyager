import logger from '../../../../../shared/utils/logger.js';
import { createStubChangeset } from './helpers/create-stub-changeset.js';
import { resolveLineCount } from './helpers/resolve-line-count.js';

// -------- Extract Changesets --------

/** Extract SCM changeset (blame) data — uses issue creation dates to preserve original dates. */
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
      changesets.set(file.key, createStubChangeset(lineCount, fileIssues));
    } catch (error) {
      logger.warn(`Failed to create changeset for ${file.key}: ${error.message}`);
    }
  }

  logger.info(`Created ${changesets.size} changeset entries`);
  return changesets;
}
