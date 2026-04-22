import logger from '../../../../shared/utils/logger.js';

const STUB_REVISION = 'cloudvoyager000000000000000000000000000';
const STUB_AUTHOR = 'cloudvoyager-migration@sonarcloud.io';

/**
 * Extract SCM changeset (blame) data — uses issue creation dates to preserve original dates.
 * @param {SonarQubeClient} client - SonarQube client
 * @param {Array} sourceFiles - List of source files with component keys
 * @param {Object} components - Component tree with metadata
 * @param {Array} [issues=[]] - Extracted issues with component, line, and creationDate
 * @returns {Promise<Map<string, Object>>} Map of component key to changeset data
 */
export async function extractChangesets(client, sourceFiles, components, issues = []) {
  logger.info('Extracting SCM changeset data...');

  const changesets = new Map();
  const fallbackTimestamp = Date.now();

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
    if (!file || !file.key) { logger.warn('Skipping file without key in changesets extraction'); continue; }
    try {
      const lineCount = file.lines ? file.lines.length : 1;
      const fileIssues = issuesByComponent.get(file.key) || [];
      changesets.set(file.key, buildChangeset(lineCount, fileIssues, fallbackTimestamp));
    } catch (error) {
      logger.warn(`Failed to create changeset for ${file.key}: ${error.message}`);
    }
  }

  logger.info(`Created ${changesets.size} changeset entries`);
  return changesets;
}

function buildChangeset(lineCount, fileIssues, fallbackTimestamp) {
  const lineDateMap = new Map();
  for (const issue of fileIssues) {
    if (!issue.line || !issue.creationDate) continue;
    const ts = new Date(issue.creationDate).getTime();
    if (Number.isNaN(ts)) continue;
    const existing = lineDateMap.get(issue.line);
    if (!existing || ts < existing) lineDateMap.set(issue.line, ts);
  }

  if (lineDateMap.size === 0) {
    return {
      componentRef: null,
      changesets: [{ revision: STUB_REVISION, author: STUB_AUTHOR, date: fallbackTimestamp }],
      changesetIndexByLine: new Array(lineCount).fill(0),
    };
  }

  const uniqueDates = [...new Set(lineDateMap.values())].sort((a, b) => a - b);
  const dateToIndex = new Map();
  dateToIndex.set(fallbackTimestamp, 0);
  const changesetsArr = [{ revision: STUB_REVISION, author: STUB_AUTHOR, date: fallbackTimestamp }];

  for (const date of uniqueDates) {
    if (dateToIndex.has(date)) continue;
    dateToIndex.set(date, changesetsArr.length);
    changesetsArr.push({ revision: STUB_REVISION, author: STUB_AUTHOR, date });
  }

  const changesetIndexByLine = new Array(lineCount).fill(0);
  for (const [line, date] of lineDateMap) {
    const arrayIdx = line - 1;
    if (arrayIdx >= 0 && arrayIdx < lineCount) {
      changesetIndexByLine[arrayIdx] = dateToIndex.get(date);
    }
  }

  return { componentRef: null, changesets: changesetsArr, changesetIndexByLine };
}
