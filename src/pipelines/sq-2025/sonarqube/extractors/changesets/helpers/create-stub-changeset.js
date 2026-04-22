// -------- Create Stub Changeset --------

const STUB_REVISION = 'cloudvoyager000000000000000000000000000';
const STUB_AUTHOR = 'cloudvoyager-migration@sonarcloud.io';

/**
 * Create changeset data for a single file, using issue creation dates
 * to build per-line date mappings so that the Compute Engine assigns
 * the correct creationDate to each migrated issue.
 *
 * @param {number} lineCount - Number of lines in the file
 * @param {Array} [fileIssues=[]] - Issues located in this file, each with `line` and `creationDate`
 */
export function createStubChangeset(lineCount, fileIssues = []) {
  const fallbackTimestamp = Date.now();

  // Build a map of line -> earliest issue creation date (as ms timestamp)
  const lineDateMap = new Map();
  for (const issue of fileIssues) {
    if (!issue.line || !issue.creationDate) continue;
    const ts = new Date(issue.creationDate).getTime();
    if (Number.isNaN(ts)) continue;
    const existing = lineDateMap.get(issue.line);
    if (!existing || ts < existing) {
      lineDateMap.set(issue.line, ts);
    }
  }

  // If no issues have usable dates, fall back to original single-changeset stub
  if (lineDateMap.size === 0) {
    return {
      componentRef: null,
      changesets: [{ revision: STUB_REVISION, author: STUB_AUTHOR, date: fallbackTimestamp }],
      changesetIndexByLine: new Array(lineCount).fill(0),
    };
  }

  // Collect unique timestamps and assign each a changeset index.
  // Index 0 is the fallback (for lines without issues).
  const uniqueDates = [...new Set(lineDateMap.values())].sort((a, b) => a - b);
  const dateToIndex = new Map();
  dateToIndex.set(fallbackTimestamp, 0);
  const changesets = [{ revision: STUB_REVISION, author: STUB_AUTHOR, date: fallbackTimestamp }];

  for (const date of uniqueDates) {
    if (dateToIndex.has(date)) continue;
    const idx = changesets.length;
    dateToIndex.set(date, idx);
    changesets.push({ revision: STUB_REVISION, author: STUB_AUTHOR, date });
  }

  // Map each line (1-based) to its changeset index
  const changesetIndexByLine = new Array(lineCount).fill(0);
  for (const [line, date] of lineDateMap) {
    const arrayIdx = line - 1; // lines are 1-based, array is 0-based
    if (arrayIdx >= 0 && arrayIdx < lineCount) {
      changesetIndexByLine[arrayIdx] = dateToIndex.get(date);
    }
  }

  return { componentRef: null, changesets, changesetIndexByLine };
}
