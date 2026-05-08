# 🔧 Troubleshooting

<!-- Last updated: Apr 21, 2026 -->

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 🐛 Debugging a Migration Run

After every `migrate` run (whether it succeeds, partially succeeds, or crashes), CloudVoyager writes report files to the `reports/` subdirectory of your output directory:

| File | Purpose |
|------|---------|
| `reports/migration-report.txt` | Human-readable report — open this first |
| `reports/migration-report.json` | Machine-readable structured data for scripting |

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Where to start

1. **Open `reports/migration-report.txt`** — it's structured top-down so you can quickly find problems:

   - **SUMMARY** — overall counts (succeeded / partial / failed)
   - **SERVER-WIDE STEPS** — did extraction from SonarQube Server work?
   - **ORGANIZATION** — did org-level setup (groups, gates, profiles) work?
   - **FAILED / PARTIAL PROJECTS (DETAILED)** — step-by-step breakdown for every project that had issues, showing exactly which step failed and why
   - **ALL PROJECTS** — compact one-line-per-project list with failed step names

2. **Search for `[FAIL]`** in the text report to jump directly to errors.

3. **Check `reports/migration-report.json`** if you need to script post-migration analysis (e.g., count how many projects failed at "Sync hotspots" vs "Upload scanner report").

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
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
    [OK  ] Assign quality profiles
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
    [OK  ] Assign quality profiles
    [OK  ] Project permissions
```

From this you can see:
- `my-legacy-project` failed at the scanner report upload (likely a protobuf/format issue) — but settings, tags, links, etc. still succeeded
- `big-project` succeeded except for hotspot sync (rate limited) — you can re-run with only hotspot sync later

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Project statuses

| Status | Meaning |
|--------|---------|
| **success** | All steps completed without errors |
| **partial** | Some steps succeeded, some failed — check the report for which ones |
| **failed** | All non-skipped steps failed |

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
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

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
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

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Re-running after failures

The migration can be re-run safely. Projects that already exist in SonarQube Cloud will be updated (not duplicated). To fix specific failures:

- **Rate limit errors on hotspot sync** — re-run with `--skip-issue-metadata-sync` (issues already synced) and increase rate limit config
- **Report upload failures** — check the specific error, fix the root cause, and re-run
- **Partial failures** — re-run the full migration; steps that already succeeded (like creating a group that already exists) will either succeed again or fail gracefully

---

## 🔄 Checkpoint and Resume Issues
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

### Stale Lock File ("Another instance is running")

If a previous run crashed without releasing the lock file, you may see an error about another instance running. Use `--force-unlock` to release the stale lock:

```bash
./cloudvoyager transfer -c config.json --verbose --force-unlock
```

The tool automatically detects stale locks from dead processes on the same machine. If the lock was created by a different machine (e.g., NFS-shared state file), manual intervention with `--force-unlock` is required.

### Corrupt Checkpoint Journal
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

If the checkpoint journal becomes corrupt (e.g., due to a system crash during a write), the tool falls back to the `.journal.backup` file. If both are corrupt:

```bash
# Discard the journal and start fresh
./cloudvoyager transfer -c config.json --verbose --force-restart
```

### SonarQube Server Version Mismatch on Resume
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

If you upgrade SonarQube Server between pause and resume, the tool warns about a version mismatch in the session fingerprint. By default, this is a warning only — the transfer continues. To enforce strict version matching:

```json
{
  "transfer": {
    "checkpoint": {
      "strictResume": true
    }
  }
}
```

With `strictResume: true`, a version mismatch will fail the transfer and require `--force-restart` to proceed.

### Source Code Changed Between Pause and Resume
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

If source code in SonarQube Server changes between pause and resume (e.g., new analysis uploaded), already-cached extraction phases will use stale data. Use `--force-fresh-extract` to re-extract all data while keeping the checkpoint journal:

```bash
./cloudvoyager transfer -c config.json --verbose --force-fresh-extract
```

### Clearing All Checkpoint State
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The `reset` command now clears checkpoint journals, lock files, and extraction caches in addition to the state file:

```bash
./cloudvoyager reset -c config.json --yes
```

This removes:
- State file (`.cloudvoyager-state.json`)
- Checkpoint journal (`.journal`, `.journal.backup`, `.journal.tmp`)
- Lock file (`.lock`)
- Extraction cache directory (`cache/`)

---

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 🏗️ Build Failures

### `npm run package` — "Multiple occurrences of sentinel found in the binary"

**Error:**
```
Error: Multiple occurences of sentinel "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2" found in the binary
```

**Cause:** Node.js v22+ embeds the SEA sentinel string twice in its binary (once as the actual fuse, once in its compiled source). The `postject` injection tool expects exactly one occurrence and fails.

**Fix:** Use Node.js v20 LTS to build:
```bash
nvm install 20
nvm use 20
npm run package
```

This only affects building the binary. Tests, linting, and `npm run build` work on any supported Node.js version.

---

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 🔐 Authentication Errors
- Verify your tokens have the correct permissions
- Check that tokens haven't expired
- Ensure the project key exists in SonarQube Server
- Verify the organization key is correct in SonarQube Cloud

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## ⚠️ Generic "Issue whilst processing" Error

This vague SonarQube Cloud error can be caused by:
- **Branch name mismatch** - SonarQube Server and SonarQube Cloud have different main branch names. The tool handles this automatically via `getMainBranchName()`, but verify your SonarQube Cloud project's branch configuration
- **Line count mismatch** - Source file line counts don't match component metadata. The tool uses actual source content line counts to avoid this

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## ❌ Report Rejected by SonarQube Cloud
- **Empty ScmInfo** - Ensure `changesetIndexByLine` is populated for ADDED files (array of zeros, one per line)
- **Issue gap field** - The `gap` field should not be included in issues (it's scanner-computed, not from SonarQube Server)
- **Duplicate report** - SonarQube Cloud rejects reports with the same `scm_revision_id`. Use a different commit or update the source project

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 🔑 Project Key Conflicts

SonarQube Cloud requires globally unique project keys across all organizations. By default, CloudVoyager uses the **original SonarQube Server project key** when creating projects on SonarQube Cloud. If the key is already taken by another SonarQube Cloud organization, the tool automatically falls back to a prefixed key (`{org}_{key}`) and logs a warning.

Key conflicts are reported in three places:
- **Console logs** — a warning is logged immediately when a conflict is detected during migration
- **Migration summary** — a "Project key conflicts" section at the end of the run lists all affected projects
- **Migration report** — the `reports/migration-report.txt` includes a "PROJECT KEY CONFLICTS" section, and `reports/migration-report.json` includes a `projectKeyWarnings` array

If you see key conflicts, the affected projects were still migrated successfully — they just use a different key than the original SonarQube Server key. You can rename them later via the SonarQube Cloud API (`/api/projects/update_key`) if the conflicting key becomes available.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 🌐 Connection Timeouts
- Check network connectivity to both servers
- Verify firewall rules allow access
- Use `--verbose` flag for detailed connection logs

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 🚦 Rate Limiting (503 / 429 Errors)

SonarQube Cloud may return 503 or 429 errors when too many API requests are made in a short period, especially during issue and hotspot sync on large projects.

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

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 🏷️ Project Names Showing as Project Keys

If projects in SonarQube Cloud show the project key as the display name instead of the original human-readable name from SonarQube Server, the project was likely created by an older version of CloudVoyager. The current version automatically carries over the original project name from SonarQube Server when creating projects in SonarQube Cloud.

To fix already-migrated projects, you can rename them manually in SonarQube Cloud via **Project Settings > General Settings > Project Name**, or delete and re-migrate the project.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 🚧 Quality Gate / Profile Permission Errors (400)

When migrating quality gates or profiles, permission APIs may return 400 errors for built-in gates/profiles. This is expected — built-in resources don't support custom permissions. The migrators handle this gracefully and skip these entries.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 📊 Issue Counts Differ Between SonarQube Server and SonarQube Cloud

If you see different issue counts (Security, Reliability, Maintainability) after migration, this is usually caused by **different active rules** between the SonarQube Server and SonarQube Cloud quality profiles.

The migrator now restores built-in profiles as custom profiles (e.g., "Sonar way (SonarQube Server Migrated)") and assigns them to projects. However, some rules may not exist on SonarQube Cloud (e.g., rules from third-party plugins). Check `quality-profiles/quality-profile-diff.json` in the output directory to see which rules are missing or added per language.

If you'd prefer to skip quality profile migration entirely and use each language's default SonarQube Cloud profile instead, use `--skip-quality-profile-sync`.

<!-- <subsection-updated last-updated="2026-05-08T00:00:00Z" updated-by="Claude" /> -->
## 🧪 Source Issues in `IN_SANDBOX` Are Migrated as `OPEN` (Issue #136)

SonarQube Server 2025+ introduces an `IN_SANDBOX` issue status — used for issues raised by sandboxed AI rules that have not yet been promoted to the standard catalog. SonarQube Cloud does not have an equivalent state, so these issues are migrated as `OPEN` on the destination.

This is a known limitation, not a bug. There is no SonarQube Cloud transition that maps to `IN_SANDBOX`, so the migrator leaves the migrated issue in its default `OPEN` state and the rest of the metadata sync (assignment, comments, tags) still applies. Once the underlying sandbox rule graduates and exists on both servers, you can re-evaluate the issues on SonarQube Cloud.

If you want to filter these out of the destination project, you can manually triage them post-migration on SonarQube Cloud.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 📄 SonarQube Server API Pagination Limits

Some SonarQube Server APIs enforce a maximum page size of 100 (not 500):
- `/api/permissions/groups`
- `/api/project_tags/search`
- `/api/qualityprofiles/search_users`
- `/api/qualitygates/show` (permissions)

The extractors handle this automatically, but if you see pagination-related errors, this is likely the cause.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 🔤 Quality Gates Use Names, Not IDs

The SonarQube Server quality gates API uses `name` for all operations (`/api/qualitygates/show`, `/api/qualitygates/select`), not `id`. If you see "not found" errors related to quality gates, check that you're using the gate name.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
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

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
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

Keep `hotspotSync.concurrency` low (3–5) to avoid SonarQube Cloud rate limits.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 📦 Large Reports

Limit source file extraction for testing:

```bash
export MAX_SOURCE_FILES=10
./cloudvoyager transfer -c config.json
```

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 🔄 Migration-Specific Issues

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Partial Migration Failures

The `migrate` command continues to the next project (and the next step within each project) if one fails. After the run completes, check `reports/migration-report.txt` in your output directory for a detailed breakdown of what succeeded and what failed per project, per step.

Projects with the status **partial** had some steps succeed and others fail. Projects with the status **failed** had all steps fail. Both are listed in the "FAILED / PARTIAL PROJECTS (DETAILED)" section of the report.

You can re-run the migration — it will re-process all projects.

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
### Dry Run for Planning

Always run with `--dry-run` first to generate mapping CSVs and verify organization assignments before executing the full migration:

```bash
./cloudvoyager migrate -c migrate-config.json --dry-run
```

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
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

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## ✅ Verification Reports

> **Import bug fixes (v1.3):** Earlier versions had missing imports in `issue-details.js`, `hotspot-details.js`, and `format-pdf/index.js` that could cause report generation to fail with `ReferenceError` or produce incomplete output. These have been fixed in v1.3. If you encountered report generation errors on a prior version, upgrade and re-run `verify`.

After migration, use the `verify` command to generate a detailed pass/fail comparison of SonarQube Server vs SonarQube Cloud data:

```bash
./cloudvoyager verify -c migrate-config.json --verbose
```

Verification reports are written to `./verification-output/` (configurable via `--output-dir`):

| File | Purpose |
|------|---------|
| `verification-report.json` | Machine-readable structured results |
| `verification-report.md` | Markdown report with collapsible mismatch details |
| `verification-report.pdf` | PDF summary for stakeholders |

The console also prints a summary with per-project breakdowns and overall pass/fail counts.

### Understanding verification results

| Status | Meaning |
|--------|---------|
| **pass** | SonarQube Server and SonarQube Cloud data match |
| **fail** | Differences detected that should have been migrated |
| **warning** | Unsyncable differences (expected — see below) |
| **skipped** | Check was skipped (e.g., project not found in SC) |
| **error** | Check failed due to an API or connectivity error |

### Issue assignment failures
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

If issue assignments are failing during migration, the most likely cause is a **login mismatch** between SonarQube Server and SonarQube Cloud. SonarQube Server uses local logins (e.g., `john.doe`) while SonarQube Cloud typically uses SSO/GitHub logins (e.g., `john-doe-github`).

**Fix:** Use the `user-mappings.csv` generated during `--dry-run` to map SQ logins to SC logins:

1. Run `--dry-run` to generate `migration-output/mappings/user-mappings.csv`
2. Fill in the `SonarQube Cloud Login` column for each user
3. Set `Include=no` for service accounts or users who should not have issues assigned
4. Run the actual migration — mappings are applied automatically

If you've already migrated and need to fix assignments, re-run with `--only issue-metadata` after filling in the user mappings CSV.

See [Dry-Run CSV Reference — user-mappings.csv](dry-run-csv-reference.md#user-mappingscsv) for the full schema and examples.

### Unsyncable items (expected differences)
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Some differences are expected because the SonarQube Cloud API does not support syncing them:

| Item | Why it's unsyncable |
|------|-------------------|
| Issue type changes | SQ Standard Experience allows manual type changes; not API-syncable to SC |
| Issue severity changes | Severity overrides are not API-syncable in either Standard or MQR mode |
| Hotspot assignments | The hotspot sync API does not support assignment transfers |

These are reported as **warnings**, not failures. If the only differences are unsyncable items, the verification is considered successful.

### Selective verification
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

You can verify specific components to save time:

```bash
# Only check issue metadata
./cloudvoyager verify -c migrate-config.json --only issue-metadata

# Only check quality gates and profiles
./cloudvoyager verify -c migrate-config.json --only quality-gates,quality-profiles

# Only check permissions
./cloudvoyager verify -c migrate-config.json --only permissions
```

## 🛑 Error Classes Reference
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

CloudVoyager uses a hierarchy of custom error classes (defined in `src/shared/utils/errors.js`). Understanding which error you're seeing helps narrow down the root cause:

| Error Class | HTTP Code | When It Occurs |
|-------------|-----------|----------------|
| **CloudVoyagerError** | 500 | Base class — all errors below extend this |
| **ConfigurationError** | 400 | Invalid config file, missing required fields, schema validation failure |
| **SonarQubeAPIError** | varies | SonarQube Server API returned an error (includes `endpoint` for debugging) |
| **SonarCloudAPIError** | varies | SonarQube Cloud API returned an error (includes `endpoint` for debugging) |
| **AuthenticationError** | 401 | Invalid or expired token for SonarQube Server or SonarQube Cloud |
| **ProtobufEncodingError** | 500 | Failed to encode data into protobuf format (may include `data` payload) |
| **StateError** | 500 | Corrupt state file, failed atomic write, or state inconsistency |
| **ValidationError** | 400 | Data validation failure (includes `errors` array with details) |
| **GracefulShutdownError** | 0 | SIGINT/SIGTERM received — not a real failure, used to unwind cleanly |
| **LockError** | 423 | Another instance is running, or lock held by a different host |
| **StaleResumeError** | 409 | Checkpoint journal fingerprint mismatch (e.g., project key changed between runs) |

---

## 🔒 Lock File Details
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Lock files prevent concurrent runs on the same state file. Key behaviors:

- **Stale detection**: Locks older than **6 hours** are auto-released. The lock includes the PID and hostname of the process that acquired it.
- **PID check**: On the same machine, the tool checks if the PID in the lock file is still alive. Dead processes' locks are released automatically.
- **Cross-host locks**: If the lock was created by a different hostname (e.g., NFS-shared state), auto-release does not apply — use `--force-unlock`.
- **Corrupt lock files**: Treated as stale and overwritten with a warning.

---

## 🧬 Checkpoint Fingerprint Validation
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

When resuming from a checkpoint journal, the tool validates a session fingerprint against the stored journal. The behavior depends on what changed:

| Field Changed | Behavior |
|---------------|----------|
| SonarQube Server version | **Warning** logged, resume continues |
| SonarQube Server URL | **Warning** logged, resume continues |
| CloudVoyager version | **Warning** logged, resume continues |
| Project key | **Throws StaleResumeError** — hard fail, requires `--force-restart` |

With `strictResume: true` in config, any fingerprint warning becomes a hard failure.

---

## 🗃️ Extraction Cache TTL
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Extraction caches are stored as **gzipped JSON** files in the `cache/` directory. Files older than **7 days** (configurable via `cacheMaxAgeDays`) are automatically purged. Use `--force-fresh-extract` to discard all caches and re-extract from SonarQube Server.

---

## 🔄 Upload Deduplication on Resume
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The checkpoint journal records successful CE task uploads per branch (task ID + timestamp). On resume, if a branch was already uploaded successfully, the upload is skipped. This prevents duplicate CE tasks in SonarQube Cloud after a crash between upload and journal save.

---

## ⏹️ Graceful Shutdown (SIGINT / SIGTERM)
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

CloudVoyager uses a `ShutdownCoordinator` that handles process signals:

- **First SIGINT/SIGTERM**: Sets a shutdown flag, runs registered cleanup handlers (e.g., saving checkpoint journal), then exits with code 0.
- **Second SIGINT/SIGTERM**: Forces immediate exit with code 1 — no cleanup.

Between pipeline phases, the tool checks the shutdown flag and throws a `GracefulShutdownError` to unwind cleanly. This ensures the journal is saved and can be resumed later.

---

## 🔤 External Linter Issues Missing After Migration (SQ 2025+)
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

SonarQube Server 2025+ stores external linter rules (Ruff, Pylint, ESLint, Checkstyle, etc.) with an `external_` prefix in the rule key (e.g., `external_ruff:D200`). If you see zero Ruff/Pylint/etc. issues in SonarQube Cloud after migration, ensure you are running CloudVoyager v1.2.0+ which correctly handles this prefix. Older versions misclassify these as native issues, causing SonarQube Cloud to silently drop them.

---

## 🔤 External Issue `cleanCodeAttribute` Must Be Enum
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

When migrating issues from SonarQube Server plugins not available in SonarQube Cloud (e.g., MuleSoft), the tool creates external issues. A critical encoding detail:

- The `cleanCodeAttribute` field in the protobuf `AdHocRule` message must be encoded as a **protobuf enum (varint)**, not a string.
- Despite the proto definition showing `optional string`, SonarQube Cloud's CE silently ignores external issues if `cleanCodeAttribute` is string-encoded.
- Valid enum values: `CONVENTIONAL=1`, `FORMATTED=2`, `IDENTIFIABLE=3`, `CLEAR=4`, `COMPLETE=5`, `EFFICIENT=6`, `LOGICAL=7`, `DISTINCT=8`, `FOCUSED=9`, `MODULAR=10`, `TESTED=11`, `LAWFUL=12`, `RESPECTFUL=13`, `TRUSTWORTHY=14`.

---

## 🕘 SonarQube Server 9.9 Issue Statuses
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

SQ 9.9 LTS uses the legacy issue status model with only 5 statuses:

`OPEN`, `CONFIRMED`, `REOPENED`, `RESOLVED`, `CLOSED`

The modern statuses (`FALSE_POSITIVE`, `ACCEPTED`, `FIXED`) do **not** exist in SQ 9.9. The `sq-9.9` pipeline uses the `statuses` search parameter (not `issueStatuses`) and maps these legacy values during extraction.

---

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 📊 Projects with 10,000+ Issues

SonarQube Server's `/api/issues/search` endpoint caps results at 10,000 due to an Elasticsearch hard limit.

> **Note (v1.3+):** Large-project issue handling now has two complementary mechanisms. The **search slicer** handles retrieval of >10K issues from SonarQube Server by splitting the date range into windows that each stay under the 10K API limit. The **SCM date backdating** (`backdateChangesets`) preserves each issue's original SonarQube Server creation date in SonarQube Cloud by writing per-line blame dates into the changeset protobuf. A safety split ensures no single calendar day exceeds 5K issues (50% margin under the 10K ES visualization cap). Together, these two features ensure that projects of any size are fully extracted from SonarQube Server and fully visible in SonarQube Cloud with accurate historical creation dates.

### Error: `10001th result asked`
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

**Symptom:** Transfer or migration fails with `SonarQube Server API error (400): Can return only the first 10000 results. 10001th result asked.`

**Fix (v1.2.1+):** The date-range probe that triggered this error has been replaced with a fixed epoch (`2006-01-01` → now) range. No configuration needed — re-run the transfer or migration.

### Error: `Date cannot be parsed as either a date or date+time`
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

**Symptom:** Transfer fails with `SonarQube Server API error (400): Date '2007-09-08T21:21:02.125Z' cannot be parsed as either a date or date+time` when slicing activates.

**Cause:** JavaScript's `toISOString()` produces milliseconds (`.125Z`). SonarQube Server's `createdAfter`/`createdBefore` API parameters require `+0000` format without milliseconds.

**Fix (v1.2.1+):** Date window boundaries now use `+0000` format. Re-run the transfer or migration.

### General info
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The search slicer algorithm:
1. Detects when total issues exceed 10K
2. Divides the full SonarQube Server era into 12 equal-width time windows
3. Recursively bisects any window that still exceeds 10K
4. Stops bisecting only if a window cannot be split further (same-millisecond boundary — an unavoidable SonarQube Server API limitation for mass-import scenarios where all issues share one identical timestamp)

**Verification:** Run `./cloudvoyager verify -c migrate-config.json --only issue-metadata` to compare issue counts between SonarQube Server and SonarQube Cloud.

---

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->
## 📦 Issue Creation Date Accuracy

CloudVoyager preserves each issue's original SonarQube Server creation date in SonarQube Cloud by rewriting SCM changeset blame dates in the protobuf report. This is automatic and transparent — no user configuration needed.

> **How it works (v1.3.1+):** `backdateChangesets()` reads each issue's `creationDate` field from SonarQube Server and maps it to the issue's `textRange` lines in the file's changeset data. The CE takes MAX(date) across an issue's line range to determine its creation date, so per-line dating with "oldest wins" for overlapping lines preserves accurate dates. A safety split handles calendar days with >5K issues.

### Issue creation dates don't match SonarQube Server
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Check that the migration was run with v1.3.1+. Earlier versions used arbitrary 30-day-spaced batch dates instead of original creation dates. Re-transfer affected projects to get accurate dates.

### Issue counts look correct in the API but not in the UI
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

SonarQube Cloud's Elasticsearch caps visualization at 10K per date bucket. With accurate creation dates, issues are naturally distributed across their original dates. The safety split ensures no single day exceeds 5K issues. If you see this problem, verify the migration used v1.3.1+.

### Warning: "N issues on DATE exceed 5K cap"
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

**Expected behavior.** This means a single calendar day had more than 5,000 issues with the same creation date. The safety split automatically sub-groups them into ≤5K batches with 1-day-spaced synthetic dates. The sub-groups will appear as separate adjacent dates in SonarQube Cloud's creation date facet.

### Can I change the safety split threshold?
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The threshold is hardcoded at 5,000 (50% safety margin under the 10K ES visualization limit). It is not configurable.

---

## 🔌 Third-Party Issues Not Appearing in SonarQube Cloud
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

External (third-party) issues from SonarQube Server plugins not available in SonarQube Cloud (e.g., MuleSoft, ABAP) may be silently dropped if the rule-repository detection fails.

**Symptom:** Issues from third-party plugins are missing in SonarQube Cloud after migration, even though they exist in SonarQube Server.

**Possible causes:**
1. The SonarQube Cloud `/api/rules/repositories` endpoint was unreachable during migration (network issue, token scope).
2. The rule key does not contain a colon separator (malformed rule).
3. The live repository set returned empty due to a transient API error.

**Fix (v1.2+):** CloudVoyager now retries the repository API 3 times with exponential backoff and falls back to a built-in set of 43 known SonarQube Cloud repositories. Rules without a colon are handled gracefully. If you migrated before v1.2, re-run the migration for affected projects.

**Debugging:** Enable `--verbose` and search the log for `FALLBACK_SONARCLOUD_REPOS` or `getRuleRepositories` to confirm whether the fallback was used.

---

## 📚 Further Reading
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

- [Configuration Reference](configuration.md) — all config options, environment variables, npm scripts
- [Architecture](architecture.md) — project structure, data flow, report format
- [Technical Details](technical-details.md) — protobuf encoding, measure types, concurrency model
- [Key Capabilities](key-capabilities.md) — comprehensive overview of engineering and capabilities
- [Changelog](CHANGELOG.md) — release history and notable changes

<!--
## Change Log
| Date | Section | Change |
|------|---------|--------|
| 2026-03-10 | Checkpoint and Resume | Added checkpoint/resume troubleshooting section |
| 2026-03-10 | Issue Assignment | Added user mapping troubleshooting section |
| 2026-02-28 | Verification Reports | Added verification report troubleshooting |
| 2026-02-18 | Debugging, Reports, Memory, Performance | Report-based debugging, auto-tune, memory management |
| 2026-02-17 | Migration issues, Rate Limiting, Keys, Permissions, Pagination | Migration engine troubleshooting |
| 2026-02-16 | Auth, Connections, Reports, Logging | Core transfer troubleshooting |
-->
