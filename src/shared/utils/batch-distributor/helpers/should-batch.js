// -------- Should Batch --------

const ISSUE_BATCH_SIZE = 5000;

/** Returns true if the extracted data has more issues than the batch threshold. */
export function shouldBatch(extractedData) {
  return extractedData.issues.length > ISSUE_BATCH_SIZE;
}
