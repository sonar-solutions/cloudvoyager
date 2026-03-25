// -------- Main Logic --------

// Create an empty hotspot sync stats accumulator.
export function createSyncStats() {
  return { matched: 0, statusChanged: 0, commented: 0, metadataSyncCommented: 0, sourceLinked: 0, failed: 0 };
}
