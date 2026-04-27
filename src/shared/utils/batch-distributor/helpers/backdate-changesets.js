import logger from '../../logger.js';
import { createHash } from 'crypto';

const STUB_AUTHOR = 'cloudvoyager-migration@sonarcloud.io';

/**
 * Rewrite SCM changeset blame dates so the CE assigns each issue's
 * original SonarQube creation date as its SonarCloud creation date.
 *
 * For each file with issues, builds one changeset entry per unique
 * issue date.  Each issue's primary line (startLine) is mapped to its
 * creation date; non-issue lines default to the file's oldest issue date.
 *
 * Mutates extractedData.changesets in place.
 */
export function backdateChangesets(extractedData) {
  const issues = extractedData.issues || [];
  if (issues.length === 0) return;

  const fallbackDate = extractedData.metadata?.extractedAt
    ? new Date(extractedData.metadata.extractedAt).getTime()
    : Date.now();

  const { fileLineDates, fileMaxLine } = buildFileLineDates(issues, fallbackDate);

  let modifiedFiles = 0;

  for (const [compKey, lineDateMap] of fileLineDates) {
    const cs = extractedData.changesets.get(compKey);
    if (!cs) continue;

    // Use the LARGER of the existing line count and the max issue line,
    // since extractChangesets may have fallen back to lineCount=1.
    const maxIssueLine = fileMaxLine.get(compKey) || 0;
    const lineCount = Math.max(cs.changesetIndexByLine.length, maxIssueLine);
    if (lineCount === 0) continue;

    const uniqueDates = [...new Set(lineDateMap.values())].sort((a, b) => a - b);

    const changesetEntries = uniqueDates.map((dateMs) => ({
      revision: createHash('sha1').update(`${compKey}-${dateMs}`).digest('hex'),
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
        newIndexByLine[i] = 0;
      }
    }

    cs.changesets = changesetEntries;
    cs.changesetIndexByLine = newIndexByLine;
    modifiedFiles++;
  }

  if (modifiedFiles === 0) {
    logger.info('No files with line-level issues found for SCM backdating');
    return;
  }

  logger.info(`Backdated SCM data for ${modifiedFiles} files covering ${issues.length} issues`);

  const allDates = new Set();
  for (const lineDateMap of fileLineDates.values()) {
    for (const d of lineDateMap.values()) allDates.add(d);
  }
  logger.info(`Total unique creation dates: ${allDates.size}`);
}

/**
 * Build per-file, per-line date map using only the issue's primary
 * line (startLine).  Oldest date wins when two issues share a startLine.
 * Also tracks the max line number per file for array sizing.
 */
function buildFileLineDates(issues, fallbackDate) {
  const fileLineDates = new Map();
  const fileMaxLine = new Map();

  for (const issue of issues) {
    const dateMs = parseCreationDate(issue.creationDate, fallbackDate);
    const startLine = issue.textRange?.startLine || issue.line || 0;
    if (startLine <= 0) continue;

    const compKey = issue.component;
    if (!compKey) continue;

    if (!fileLineDates.has(compKey)) {
      fileLineDates.set(compKey, new Map());
    }
    const lineDateMap = fileLineDates.get(compKey);

    const existing = lineDateMap.get(startLine);
    if (existing === undefined || dateMs < existing) {
      lineDateMap.set(startLine, dateMs);
    }

    const curMax = fileMaxLine.get(compKey) || 0;
    if (startLine > curMax) fileMaxLine.set(compKey, startLine);
  }

  return { fileLineDates, fileMaxLine };
}

function parseCreationDate(creationDateStr, fallbackDate) {
  if (!creationDateStr) return fallbackDate;
  const ms = new Date(creationDateStr).getTime();
  return isNaN(ms) ? fallbackDate : ms;
}
