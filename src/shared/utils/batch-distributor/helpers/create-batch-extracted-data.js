// -------- Create Batch Extracted Data --------

/**
 * Create a shallow clone of extractedData with sliced issues and overridden metadata.
 * Non-final batches strip sources, changesets, and duplications to reduce upload size.
 */
export function createBatchExtractedData(originalData, batchDescriptor, batchDate, batchScmRevisionId) {
  const batch = { ...originalData };

  // Slice the issues array for this batch
  batch.issues = originalData.issues.slice(
    batchDescriptor.startIndex,
    batchDescriptor.endIndex,
  );

  // Override metadata with batch-specific date and unique scmRevisionId
  batch.metadata = {
    ...originalData.metadata,
    extractedAt: batchDate,
    scmRevisionId: batchScmRevisionId,
  };

  // Non-final batches: strip heavy payload that only the latest analysis needs
  // Final batch: clone sources to avoid shared reference mutation
  if (!batchDescriptor.isLast) {
    batch.sources = [];
    batch.changesets = new Map();
    batch.duplications = new Map();
  } else {
    batch.sources = [...originalData.sources];
  }

  return batch;
}
