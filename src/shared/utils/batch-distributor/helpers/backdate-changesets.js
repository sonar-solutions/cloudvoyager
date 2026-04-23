import logger from '../../logger.js';
import { ISSUE_BATCH_SIZE } from './should-batch.js';
import { computeBatchDate } from './compute-batch-date.js';

// -------- Backdate Changesets --------

const STUB_AUTHOR = 'cloudvoyager-migration@sonarcloud.io';

/**
 * Modify SCM changeset blame dates so the CE assigns different creation
 * dates to different groups of issues.  This spreads issues across
 * multiple date buckets within a **single** analysis.
 *
 * Strategy: sort issues by file, group files into ≤5K-issue batches,
 * then set ALL lines of each file to that batch's date.  Setting every
 * line ensures the CE has no "newer" line to fall back on.
 *
 * Mutates extractedData.issues (sort order) and
 * extractedData.changesets (dates) in place.
 */
export function backdateChangesets(extractedData) {
  const issues = extractedData.issues || [];
  if (issues.length <= ISSUE_BATCH_SIZE) return;

  const baseDateISO = extractedData.metadata?.extractedAt || new Date().toISOString();

  // Sort issues by component so files are contiguous
  issues.sort((a, b) => (a.component || '').localeCompare(b.component || ''));

  // Group files into batches of ≤ISSUE_BATCH_SIZE issues.
  // Each file goes entirely into one batch (no splitting a file across batches).
  const fileBatches = buildFileBatches(issues);
  const batchCount = fileBatches.length;

  if (batchCount <= 1) return;

  logger.info(
    `Backdating SCM data: ${issues.length} issues → ${batchCount} date buckets of ≤${ISSUE_BATCH_SIZE}`
  );

  let modifiedFiles = 0;

  for (let batchIdx = 0; batchIdx < batchCount; batchIdx++) {
    if (batchIdx === batchCount - 1) break; // last batch keeps original date

    const batchDateMs = new Date(
      computeBatchDate(baseDateISO, batchIdx, batchCount)
    ).getTime();

    const batchRevision = `cloudvoyager-batch-${String(batchIdx + 1).padStart(4, '0')}`;

    for (const compKey of fileBatches[batchIdx].files) {
      const cs = extractedData.changesets.get(compKey);
      if (!cs) continue;

      // Replace the single stub changeset with the backdated one
      cs.changesets = [{
        revision: batchRevision,
        author: STUB_AUTHOR,
        date: batchDateMs,
      }];
      // Point every line to changeset index 0 (the only entry)
      cs.changesetIndexByLine.fill(0);

      modifiedFiles++;
    }
  }

  logger.info(
    `Modified SCM data for ${modifiedFiles} files across ${batchCount} date buckets`
  );
}

/**
 * Walk the sorted issues array and collect files into batches.
 * Each batch accumulates files until the issue count exceeds
 * ISSUE_BATCH_SIZE, then a new batch starts.
 */
function buildFileBatches(issues) {
  const batches = [{ files: new Set(), issueCount: 0 }];
  let currentFile = null;
  let currentFileIssueCount = 0;

  for (const issue of issues) {
    const compKey = issue.component;
    if (!compKey) continue;

    if (compKey !== currentFile) {
      // New file — flush previous file's count and decide batch placement
      if (currentFile && currentFileIssueCount > 0) {
        let batch = batches[batches.length - 1];
        if (batch.issueCount + currentFileIssueCount > ISSUE_BATCH_SIZE && batch.issueCount > 0) {
          batches.push({ files: new Set(), issueCount: 0 });
          batch = batches[batches.length - 1];
        }
        batch.files.add(currentFile);
        batch.issueCount += currentFileIssueCount;
      }
      currentFile = compKey;
      currentFileIssueCount = 0;
    }
    currentFileIssueCount++;
  }

  // Flush last file
  if (currentFile && currentFileIssueCount > 0) {
    let batch = batches[batches.length - 1];
    if (batch.issueCount + currentFileIssueCount > ISSUE_BATCH_SIZE && batch.issueCount > 0) {
      batches.push({ files: new Set(), issueCount: 0 });
      batch = batches[batches.length - 1];
    }
    batch.files.add(currentFile);
    batch.issueCount += currentFileIssueCount;
  }

  return batches;
}
