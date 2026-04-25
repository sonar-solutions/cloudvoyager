import logger from '../../logger.js';
import { ISSUE_BATCH_SIZE } from './should-batch.js';

const STUB_AUTHOR = 'cloudvoyager-migration@sonarcloud.io';
const ONE_DAY_MS = 86_400_000;

/**
 * Rewrite SCM changeset blame dates so the CE assigns each issue's
 * original SonarQube creation date as its SonarCloud creation date.
 *
 * Phase 0: Safety-split any calendar day with >5K issues into sub-groups.
 * Phase 1: Build per-file, per-line date map from issue creationDates.
 * Phase 2: Rebuild changeset entries per file with one entry per unique date.
 * Phase 3: Log distribution stats.
 *
 * Mutates extractedData.changesets in place.
 */
export function backdateChangesets(extractedData) {
  const issues = extractedData.issues || [];
  if (issues.length === 0) return;

  const fallbackDate = extractedData.metadata?.extractedAt
    ? new Date(extractedData.metadata.extractedAt).getTime()
    : Date.now();

  // Phase 0: safety split for oversized dates
  const effectiveDates = buildSafetySplitOverrides(issues, fallbackDate);

  // Phase 1: per-file, per-line date map
  const fileLineDates = buildFileLineDates(issues, effectiveDates, fallbackDate);

  // Phase 2: rebuild changesets per file
  let modifiedFiles = 0;
  const globalDateCounts = new Map();

  for (const [compKey, lineDateMap] of fileLineDates) {
    const cs = extractedData.changesets.get(compKey);
    if (!cs) continue;

    const lineCount = cs.changesetIndexByLine.length;
    if (lineCount === 0) continue;

    const uniqueDates = [...new Set(lineDateMap.values())].sort((a, b) => a - b);

    const changesetEntries = uniqueDates.map((dateMs, idx) => ({
      revision: `cloudvoyager-date-${idx}`,
      author: STUB_AUTHOR,
      date: dateMs,
    }));

    const dateToIndex = new Map();
    uniqueDates.forEach((d, i) => dateToIndex.set(d, i));

    const newIndexByLine = new Array(lineCount);
    for (let i = 0; i < lineCount; i++) {
      const issueDate = lineDateMap.get(i + 1);
      if (issueDate !== undefined) {
        newIndexByLine[i] = dateToIndex.get(issueDate);
      } else {
        newIndexByLine[i] = 0; // oldest date — prevents MAX inflation
      }
    }

    cs.changesets = changesetEntries;
    cs.changesetIndexByLine = newIndexByLine;
    modifiedFiles++;

    for (const [, dateMs] of lineDateMap) {
      globalDateCounts.set(dateMs, (globalDateCounts.get(dateMs) || 0) + 1);
    }
  }

  // Phase 3: logging
  if (modifiedFiles === 0) {
    logger.info('No files with line-level issues found for SCM backdating');
    return;
  }

  logger.info(
    `Backdated SCM data for ${modifiedFiles} files using original issue creation dates`
  );

  const uniqueDateCount = globalDateCounts.size;
  logger.info(`Total unique creation dates: ${uniqueDateCount}`);

  const topDates = [...globalDateCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ms, count]) => `${new Date(ms).toISOString().slice(0, 10)}: ${count} lines`)
    .join(', ');
  logger.info(`Top dates by line count: ${topDates}`);
}

/**
 * Phase 0: For any calendar day with >ISSUE_BATCH_SIZE issues,
 * pre-assign synthetic dates to sub-groups so no single day exceeds 5K.
 * Returns a Map<issueKey, dateMs> of overrides.
 */
function buildSafetySplitOverrides(issues, fallbackDate) {
  const effectiveDates = new Map();

  const dateGroups = new Map();
  for (const issue of issues) {
    const dateMs = parseCreationDate(issue.creationDate, fallbackDate);
    const dayKey = Math.floor(dateMs / ONE_DAY_MS);
    if (!dateGroups.has(dayKey)) {
      dateGroups.set(dayKey, { dateMs: dayKey * ONE_DAY_MS, issues: [] });
    }
    dateGroups.get(dayKey).issues.push(issue);
  }

  for (const [, group] of dateGroups) {
    const dayIssues = group.issues;
    if (dayIssues.length <= ISSUE_BATCH_SIZE) continue;

    dayIssues.sort((a, b) => (a.component || '').localeCompare(b.component || ''));

    const subBatches = groupIssuesIntoBatches(dayIssues);
    const totalBatches = subBatches.length;

    for (let batchIdx = 0; batchIdx < totalBatches - 1; batchIdx++) {
      const syntheticDate = group.dateMs - (totalBatches - 1 - batchIdx) * ONE_DAY_MS;
      for (const issue of subBatches[batchIdx]) {
        effectiveDates.set(issue.key, syntheticDate);
      }
    }
    // Last sub-batch keeps the original date (no override)

    const dayStr = new Date(group.dateMs).toISOString().slice(0, 10);
    logger.warn(
      `${dayIssues.length} issues on ${dayStr} exceed ${ISSUE_BATCH_SIZE} cap, ` +
      `sub-split into ${totalBatches} date groups`
    );
  }

  return effectiveDates;
}

/**
 * Group sorted issues into batches of ≤ISSUE_BATCH_SIZE without splitting files.
 */
function groupIssuesIntoBatches(sortedIssues) {
  const batches = [[]];
  let currentBatchCount = 0;
  let currentFile = null;
  let fileBuffer = [];

  function flushFile() {
    if (fileBuffer.length === 0) return;
    let batch = batches[batches.length - 1];
    if (currentBatchCount + fileBuffer.length > ISSUE_BATCH_SIZE && currentBatchCount > 0) {
      batches.push([]);
      batch = batches[batches.length - 1];
      currentBatchCount = 0;
    }
    batch.push(...fileBuffer);
    currentBatchCount += fileBuffer.length;
    fileBuffer = [];
  }

  for (const issue of sortedIssues) {
    if (issue.component !== currentFile) {
      flushFile();
      currentFile = issue.component;
    }
    fileBuffer.push(issue);
  }
  flushFile();

  return batches;
}

/**
 * Phase 1: Build per-file, per-line date map.
 * For each issue, map its line range to its effective creation date.
 * Oldest date wins when lines overlap (prevents CE MAX inflation).
 */
function buildFileLineDates(issues, effectiveDates, fallbackDate) {
  const fileLineDates = new Map();

  for (const issue of issues) {
    const dateMs = effectiveDates.get(issue.key)
      ?? parseCreationDate(issue.creationDate, fallbackDate);

    const startLine = issue.textRange?.startLine || issue.line || 0;
    const endLine = issue.textRange?.endLine || startLine;
    if (startLine <= 0) continue;

    const compKey = issue.component;
    if (!compKey) continue;

    if (!fileLineDates.has(compKey)) {
      fileLineDates.set(compKey, new Map());
    }
    const lineDateMap = fileLineDates.get(compKey);

    for (let ln = startLine; ln <= endLine; ln++) {
      const existing = lineDateMap.get(ln);
      if (existing === undefined || dateMs < existing) {
        lineDateMap.set(ln, dateMs);
      }
    }
  }

  return fileLineDates;
}

function parseCreationDate(creationDateStr, fallbackDate) {
  if (!creationDateStr) return fallbackDate;
  const ms = new Date(creationDateStr).getTime();
  return isNaN(ms) ? fallbackDate : ms;
}
