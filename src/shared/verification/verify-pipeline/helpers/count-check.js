// -------- Count Check --------

/**
 * Count a single check result into the running totals.
 * Mutates the counters object in place.
 * @param {object} check - A check result with a `status` field
 * @param {object} counters - { total, passed, failed, warnings, skipped, errors }
 */
export function countCheck(check, counters) {
  if (!check) return;

  counters.total++;
  if (check.status === 'pass') counters.passed++;
  else if (check.status === 'fail') counters.failed++;
  else if (check.status === 'skipped') counters.skipped++;
  else if (check.status === 'error') counters.errors++;

  // Count unsyncable items as warnings
  if (check.unsyncable) {
    const unsyncCount = Object.values(check.unsyncable).reduce(
      (sum, v) => sum + (typeof v === 'number' ? v : 0), 0,
    );
    if (unsyncCount > 0) counters.warnings += unsyncCount;
  }
}
