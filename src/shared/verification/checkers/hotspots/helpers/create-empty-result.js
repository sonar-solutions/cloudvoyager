// -------- Create Empty Hotspot Result --------

/** Create a fresh empty result object for hotspot verification. */
export function createEmptyHotspotResult() {
  return {
    status: 'pass',
    sqCount: 0,
    scCount: 0,
    matched: 0,
    unmatched: 0,
    statusMismatches: [],
    commentMismatches: [],
    unmatchedSqHotspots: [],
    scOnlyHotspots: [],
    unsyncable: { assignments: 0, assignmentDetails: [] },
  };
}
