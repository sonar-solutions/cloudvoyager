// -------- Should Batch --------

export const ISSUE_BATCH_SIZE = 5000;

// Multi-analysis batching is disabled — the CE's issue tracker closes
// issues from prior analyses.  Instead, backdateChangesets() spreads
// creation dates within a single analysis via SCM blame data.
/** Returns true if the extracted data has more issues than the batch threshold. */
export function shouldBatch(_extractedData) {
  return false;
}
