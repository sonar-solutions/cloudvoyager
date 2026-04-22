// -------- Should Batch --------

export const ISSUE_BATCH_SIZE = 5000;

// Batch distribution is disabled: each subsequent batch's analysis closes the
// previous batch's issues via SonarCloud's issue tracker (which treats each
// analysis as a complete snapshot). This means only the LAST batch's issues
// survive, silently dropping all earlier batches. Uploading all issues in a
// single analysis preserves the correct total even though the SonarCloud UI
// caps the issues list at 10K — the measures and underlying data are accurate.
/** Returns true if the extracted data has more issues than the batch threshold. */
export function shouldBatch(_extractedData) {
  return false;
}
