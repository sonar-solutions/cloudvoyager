/**
 * Returns true if the issue is closed or fixed and should be excluded from migration.
 * Covers all lifecycle variants:
 * - Modern lifecycle: explicit CLOSED or FIXED status
 * - Classic lifecycle: RESOLVED status with resolution=FIXED
 */
export function isClosedOrFixed(issue) {
  if (issue.status === 'CLOSED' || issue.status === 'FIXED') return true;
  if (issue.status === 'RESOLVED' && issue.resolution === 'FIXED') return true;
  return false;
}
