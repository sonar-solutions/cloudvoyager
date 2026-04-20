// -------- Compute Batch Plan --------

const ISSUE_BATCH_SIZE = 5000;

/** Compute batch descriptors for splitting issues into chunks. */
export function computeBatchPlan(totalIssues) {
  const batchCount = Math.max(1, Math.ceil(totalIssues / ISSUE_BATCH_SIZE));
  const batches = [];

  for (let i = 0; i < batchCount; i++) {
    batches.push({
      startIndex: i * ISSUE_BATCH_SIZE,
      endIndex: Math.min((i + 1) * ISSUE_BATCH_SIZE, totalIssues),
      batchIndex: i,
      isLast: i === batchCount - 1,
    });
  }

  return batches;
}
