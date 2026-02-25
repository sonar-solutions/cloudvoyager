# 🔧 Troubleshooting

<!-- Last updated: Feb 20, 2026 at 04:02:27 PM -->

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🐛 Debugging a Migration Run

After every `migrate` run (whether it succeeds, partially succeeds, or crashes), CloudVoyager writes report files to the `reports/` subdirectory of your output directory:

| File | Purpose |
|------|---------|
| `reports/migration-report.txt` | Human-readable report — open this first |
| `reports/migration-report.json` | Machine-readable structured data for scripting |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Where to start

1. **Open `reports/migration-report.txt`** — it's structured top-down so you can quickly find problems:

   - **SUMMARY** — overall counts (succeeded / partial / failed)
   - **SERVER-WIDE STEPS** — did extraction from SonarQube work?
   - **ORGANIZATION** — did org-level setup (groups, gates, profiles) work?
   - **FAILED / PARTIAL PROJECTS (DETAILED)** — step-by-step breakdown for every project that had issues, showing exactly which step failed and why
   - **ALL PROJECTS** — compact one-line-per-project list with failed step names

2. **Search for `[FAIL]`** in the text report to jump directly to errors.

3. **Check `reports/migration-report.json`** if you need to script post-migration analysis (e.g., count how many projects failed at "Sync hotspots" vs "Upload scanner report").

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Example report output

```
FAILED / PARTIAL PROJECTS (DETAILED)
----------------------------------------------------------------------
  [FAIL   ] my-legacy-project -> my-legacy-project
    [FAIL] Upload scanner report
           Analysis failed: Issue whilst processing the report
    [SKIP] Sync issues -- Report upload failed
    [SKIP] Sync hotspots -- Report upload failed
    [OK  ] Project settings
    [OK  ] Project tags
    [OK  ] Project links
    [OK  ] New code definitions
    [OK  ] DevOps binding
    [OK  ] Assign quality gate
    [OK  ] Project permissions

  [PARTIAL] big-project -> big-project
    [OK  ] Upload scanner report
    [OK  ] Sync issues
    [FAIL] Sync hotspots
           Rate limited (503), exhausted all 3 retries
    [OK  ] Project settings
    [OK  ] Project tags
    [OK  ] Project links
    [OK  ] New code definitions
    [OK  ] DevOps binding
    [OK  ] Assign quality gate
    [OK  ] Project permissions
```

From this you can see:
- `my-legacy-project` failed at the scanner report upload (likely a protobuf/format issue) — but settings, tags, links, etc. still succeeded
- `big-project` succeeded except for hotspot sync (rate limited) — you can re-run with only hotspot sync later

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Project statuses

| Status | Meaning |
|--------|---------|
| **success** | All steps completed without errors |
| **partial** | Some steps succeeded, some failed — check the report for which ones |
| **failed** | All non-skipped steps failed |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Per-project migration steps

Each project goes through these steps (in order). If the scanner report upload fails, issue/hotspot sync are automatically skipped (they depend on uploaded data), but remaining steps still run:

| Step | What it does | Depends on report upload? |
|------|-------------|--------------------------|
| Upload scanner report | Extracts code, issues, metrics from SQ and uploads to SC | — |
| Sync issues | Matches issues by rule+file+line, syncs status/comments/tags | Yes |
| Sync hotspots | Matches hotspots by rule+file+line, syncs status/comments | Yes |
| Project settings | Copies non-inherited project settings | No |
| Project tags | Sets custom project tags | No |
| Project links | Creates external links (homepage, CI, etc.) | No |
| New code definitions | Sets new code period per project/branch | No |
| DevOps binding | Links project to GitHub/GitLab/Azure/Bitbucket | No |
| Assign quality gate | Assigns the matching quality gate | No |
| Assign quality profiles | Assigns migrated built-in quality profiles per language | No |
| Project permissions | Sets group-level project permissions | No |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Using log files for deeper investigation

For detailed debugging beyond the report, save the full log to a file:

```bash
LOG_FILE=./migration.log ./cloudvoyager migrate -c migrate-config.json --verbose
```

The `--verbose` flag enables `debug`-level logging, which includes:
- Individual API request/response details
- Per-issue and per-hotspot sync results (matched, skipped, failed)
- Per-setting, per-tag, per-link migration details
- Rate limit retry attempts with timing

You can then search the log file for specific projects or error patterns:

```bash
# Find all errors for a specific project
grep "my-project" migration.log | grep -i "error\|fail"

# Find all rate limit retries
grep "Rate limited" migration.log

# Find all skipped items
grep "SKIP\|skipping" migration.log
```

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Re-running after failures

The migration can be re-run safely. Projects that already exist in SonarCloud will be updated (not duplicated). To fix specific failures:

- **Rate limit errors on hotspot sync** — re-run with `--skip-issue-metadata-sync` (issues already synced) and increase rate limit config
- **Report upload failures** — check the specific error, fix the root cause, and re-run
- **Partial failures** — re-run the full migration; steps that already succeeded (like creating a group that already exists) will either succeed again or fail gracefully

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🔐 Authentication Errors
- Verify your tokens have the correct permissions
- Check that tokens haven't expired
- Ensure the project key exists in SonarQube
- Verify the organization key is correct in SonarCloud

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## ⚠️ Generic "Issue whilst processing" Error

This vague SonarCloud error can be caused by:
- **Branch name mismatch** - SonarQube and SonarCloud have different main branch names. The tool handles this automatically via `getMainBranchName()`, but verify your SonarCloud project's branch configuration
- **Line count mismatch** - Source file line counts don't match component metadata. The tool uses actual source content line counts to avoid this

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## ❌ Report Rejected by SonarCloud
- **Empty ScmInfo** - Ensure `changesetIndexByLine` is populated for ADDED files (array of zeros, one per line)
- **Issue gap field** - The `gap` field should not be included in issues (it's scanner-computed, not from SonarQube)
- **Duplicate report** - SonarCloud rejects reports with the same `scm_revision_id`. Use a different commit or update the source project

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🔑 Project Key Conflicts

SonarCloud requires globally unique project keys across all organizations. By default, CloudVoyager uses the **original SonarQube project key** when creating projects on SonarCloud. If the key is already taken by another SonarCloud organization, the tool automatically falls back to a prefixed key (`{org}_{key}`) and logs a warning.

Key conflicts are reported in three places:
- **Console logs** — a warning is logged immediately when a conflict is detected during migration
- **Migration summary** — a "Project key conflicts" section at the end of the run lists all affected projects
- **Migration report** — the `reports/migration-report.txt` includes a "PROJECT KEY CONFLICTS" section, and `reports/migration-report.json` includes a `projectKeyWarnings` array

If you see key conflicts, the affected projects were still migrated successfully — they just use a different key than the original SonarQube key. You can rename them later via the SonarCloud API (`/api/projects/update_key`) if the conflicting key becomes available.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🌐 Connection Timeouts
- Check network connectivity to both servers
- Verify firewall rules allow access
- Use `--verbose` flag for detailed connection logs

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🚦 Rate Limiting (503 / 429 Errors)

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
- Using `--skip-hotspot-metadata-sync` to skip the most rate-limit-prone operation

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🏷️ Project Names Showing as Project Keys

If projects in SonarCloud show the project key as the display name instead of the original human-readable name from SonarQube, the project was likely created by an older version of CloudVoyager. The current version automatically carries over the original project name from SonarQube when creating projects in SonarCloud.

To fix already-migrated projects, you can rename them manually in SonarCloud via **Project Settings > General Settings > Project Name**, or delete and re-migrate the project.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🚧 Quality Gate / Profile Permission Errors (400)

When migrating quality gates or profiles, permission APIs may return 400 errors for built-in gates/profiles. This is expected — built-in resources don't support custom permissions. The migrators handle this gracefully and skip these entries.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📊 Issue Counts Differ Between SonarQube and SonarCloud

If you see different issue counts (Security, Reliability, Maintainability) after migration, this is usually caused by **different active rules** between the SonarQube and SonarCloud quality profiles.

The migrator now restores built-in profiles as custom profiles (e.g., "Sonar way (SonarQube Migrated)") and assigns them to projects. However, some rules may not exist on SonarCloud (e.g., rules from third-party plugins). Check `quality-profiles/quality-profile-diff.json` in the output directory to see which rules are missing or added per language.

If you'd prefer to skip quality profile migration entirely and use each language's default SonarCloud profile instead, use `--skip-quality-profile-sync`.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📄 SonarQube API Pagination Limits

Some SonarQube APIs enforce a maximum page size of 100 (not 500):
- `/api/permissions/groups`
- `/api/project_tags/search`
- `/api/qualityprofiles/search_users`
- `/api/qualitygates/show` (permissions)

The extractors handle this automatically, but if you see pagination-related errors, this is likely the cause.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🔤 Quality Gates Use Names, Not IDs

The SonarQube quality gates API uses `name` for all operations (`/api/qualitygates/show`, `/api/qualitygates/select`), not `id`. If you see "not found" errors related to quality gates, check that you're using the gate name.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 💾 Out of Memory / Heap Allocation Errors

If you see `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory`, increase the heap size via `--max-memory` or the `maxMemoryMB` config option. The tool automatically restarts itself with the increased heap:

```bash
./cloudvoyager migrate -c migrate-config.json --verbose --max-memory 8192
```

Or set it permanently in your config file:

```json
{
  "performance": {
    "maxMemoryMB": 8192
  }
}
```

Or use the `migrate:auto-tune` npm script, which detects your hardware and sets optimal values automatically:

```bash
npm run migrate:auto-tune
```

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🐢 Slow Migration Performance

If migrations are taking too long, the easiest fix is to use `--auto-tune` which detects your hardware and sets optimal values:

```bash
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune
```

Or manually increase concurrency via CLI flags:

```bash
# Higher I/O concurrency and parallel projects
./cloudvoyager migrate -c migrate-config.json --verbose --concurrency 50 --project-concurrency 8
```

For persistent config, add a `performance` section to your config file. See the [Configuration Reference](configuration.md#performance-settings) for all options.

Keep `hotspotSync.concurrency` low (3–5) to avoid SonarCloud rate limits.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📦 Large Reports

Limit source file extraction for testing:

```bash
export MAX_SOURCE_FILES=10
./cloudvoyager transfer -c config.json
```

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🔄 Migration-Specific Issues

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Partial Migration Failures

The `migrate` command continues to the next project (and the next step within each project) if one fails. After the run completes, check `reports/migration-report.txt` in your output directory for a detailed breakdown of what succeeded and what failed per project, per step.

Projects with the status **partial** had some steps succeed and others fail. Projects with the status **failed** had all steps fail. Both are listed in the "FAILED / PARTIAL PROJECTS (DETAILED)" section of the report.

You can re-run the migration — it will re-process all projects.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Dry Run for Planning

Always run with `--dry-run` first to generate mapping CSVs and verify organization assignments before executing the full migration:

```bash
./cloudvoyager migrate -c migrate-config.json --dry-run
```

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Skipping Issue/Hotspot Metadata Sync

If issue or hotspot metadata sync is causing rate limit errors on large projects, you can skip them during migration and sync them separately afterward:

```bash
# Step 1: Migrate without metadata sync
./cloudvoyager migrate -c migrate-config.json --skip-issue-metadata-sync --skip-hotspot-metadata-sync

# Step 2: Sync metadata separately (can retry as needed)
./cloudvoyager sync-metadata -c migrate-config.json --verbose
```

You can also sync just one type of metadata at a time:

```bash
# Sync only issue metadata
./cloudvoyager sync-metadata -c migrate-config.json --skip-hotspot-metadata-sync --verbose

# Sync only hotspot metadata
./cloudvoyager sync-metadata -c migrate-config.json --skip-issue-metadata-sync --verbose
```

## 📚 Further Reading

- [Configuration Reference](configuration.md) — all config options, environment variables, npm scripts
- [Architecture](architecture.md) — project structure, data flow, report format
- [Technical Details](technical-details.md) — protobuf encoding, measure types, concurrency model
- [Key Capabilities](key-capabilities.md) — comprehensive overview of engineering and capabilities
- [Changelog](CHANGELOG.md) — release history and notable changes

<!--
## Change Log
| Date | Section | Change |
|------|---------|--------|
| 2026-02-18 | Debugging, Reports, Memory, Performance | Report-based debugging, auto-tune, memory management |
| 2026-02-17 | Migration issues, Rate Limiting, Keys, Permissions, Pagination | Migration engine troubleshooting |
| 2026-02-16 | Auth, Connections, Reports, Logging | Core transfer troubleshooting |
-->
