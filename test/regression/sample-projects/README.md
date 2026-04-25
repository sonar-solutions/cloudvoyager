# Sample Projects for Regression Testing

These minimal codebases are scanned by sonar-scanner inside ephemeral SQ containers
to seed test data for regression scenarios that don't need the full Angular codebase.

## small-js/
A tiny JavaScript project (~50 files) that generates a manageable number of issues.
Used for: issue-sync-first-migration, kill-and-continue, and other scenarios where
the test is about CloudVoyager behavior, not issue volume.

## How it works
The regression workflow's setup phase scans these projects into the ephemeral SQ
container, then enrichment scripts add comments, status changes, and hotspot data
before the migration runs.
