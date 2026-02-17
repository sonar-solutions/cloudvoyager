# Troubleshooting

## Authentication Errors
- Verify your tokens have the correct permissions
- Check that tokens haven't expired
- Ensure the project key exists in SonarQube
- Verify the organization key is correct in SonarCloud

## Generic "Issue whilst processing" Error

This vague SonarCloud error can be caused by:
- **Branch name mismatch** - SonarQube and SonarCloud have different main branch names. The tool handles this automatically via `getMainBranchName()`, but verify your SonarCloud project's branch configuration
- **Line count mismatch** - Source file line counts don't match component metadata. The tool uses actual source content line counts to avoid this

## Report Rejected by SonarCloud
- **Empty ScmInfo** - Ensure `changesetIndexByLine` is populated for ADDED files (array of zeros, one per line)
- **Issue gap field** - The `gap` field should not be included in issues (it's scanner-computed, not from SonarQube)
- **Duplicate report** - SonarCloud rejects reports with the same `scm_revision_id`. Use a different commit or update the source project

## Connection Timeouts
- Check network connectivity to both servers
- Verify firewall rules allow access
- Use `--verbose` flag for detailed connection logs

## Rate Limiting (503 / 429 Errors)

SonarCloud may return 503 or 429 errors when too many API requests are made in a short period, especially during issue and hotspot sync on large projects.

By default, CloudVoyager retries rate-limited requests up to 3 times with exponential backoff. You can tune this via the `rateLimit` section in your config file:

```json
{
  "rateLimit": {
    "maxRetries": 5,
    "baseDelay": 1000,
    "minRequestInterval": 150
  }
}
```

- **`maxRetries`** - Number of retry attempts on 503/429 with exponential backoff (default: `3`, set to `0` to disable)
- **`baseDelay`** - Initial delay in ms before retrying (doubles each attempt: 1s, 2s, 4s, 8s, 16s)
- **`minRequestInterval`** - Minimum ms between POST requests to avoid triggering limits (default: `0` = disabled)

If you still encounter rate limit errors after all retries are exhausted, consider:
- Increasing `maxRetries` and `baseDelay`
- Running the migration during off-peak hours
- Using `--skip-hotspot-sync` to skip the most rate-limit-prone operation

## Quality Gate / Profile Permission Errors (400)

When migrating quality gates or profiles, permission APIs may return 400 errors for built-in gates/profiles. This is expected — built-in resources don't support custom permissions. The migrators handle this gracefully and skip these entries.

## SonarQube API Pagination Limits

Some SonarQube APIs enforce a maximum page size of 100 (not 500):
- `/api/permissions/groups`
- `/api/project_tags/search`
- `/api/qualityprofiles/search_users`
- `/api/qualitygates/show` (permissions)

The extractors handle this automatically, but if you see pagination-related errors, this is likely the cause.

## Quality Gates Use Names, Not IDs

The SonarQube quality gates API uses `name` for all operations (`/api/qualitygates/show`, `/api/qualitygates/select`), not `id`. If you see "not found" errors related to quality gates, check that you're using the gate name.

## Large Reports

Limit source file extraction for testing:

```bash
export MAX_SOURCE_FILES=10
node src/index.js transfer -c config.json
```

## Migration-Specific Issues

### Partial Migration Failures

The `migrate` command continues to the next project if one fails. Check the migration summary at the end for a list of failed projects and their error messages. You can re-run the migration — it will re-process all projects.

### Dry Run for Planning

Always run with `--dry-run` first to generate mapping CSVs and verify organization assignments before executing the full migration:

```bash
./cloudvoyager migrate -c migrate-config.json --dry-run
```

### Skipping Issue/Hotspot Sync

If issue or hotspot sync is causing rate limit errors on large projects, you can skip them for a faster migration:

```bash
./cloudvoyager migrate -c migrate-config.json --skip-issue-sync --skip-hotspot-sync
```
