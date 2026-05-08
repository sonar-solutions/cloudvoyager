# Migrate a Single Project
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

<!-- Last updated: Apr 21, 2026 -->

Use this when you want to migrate **one specific project** from SonarQube Server to SonarQube Cloud.

This does **not** migrate org-level settings like quality gates, quality profiles, groups, or permissions — for that, see [Migrate Everything to One Org](scenario-single-org.md).

---

## What Gets Migrated
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

| Category | Details |
|----------|---------|
| **All branches** | All branches are synced by default (main branch first, then the rest) |
| **Source code** | All files packaged into the scanner report |
| **Issues** | All code issues with text ranges, flows, and metadata |
| **Security hotspots** | All hotspots with status and comments |
| **Metrics & measures** | Project and component-level measures (coverage, complexity, etc.) |
| **SCM changesets** | Per-file changeset info (author, date, revision) |
| **Active rules** | Quality profile rules filtered by languages used in the project |
| **Issue metadata** | Status history (full changelog replay), comments, assignments, `metadata-synchronized` tag, and a link back to the original SonarQube Server issue URL |
| **Hotspot metadata** | Hotspot statuses, comments, and source links |

> **Not included:** Quality gates, quality profiles, groups, permissions, portfolios, project settings, tags, links, DevOps bindings, and new code definitions. Use the [`migrate` command](scenario-single-org.md) to transfer these.

---

## Prerequisites
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

1. **Admin access** to your SonarQube Server
2. **Admin access** to your SonarQube Cloud organization
3. **API tokens** for both SonarQube Server and SonarQube Cloud

> **How to get your tokens:**
> - **SonarQube Server:** Go to `My Account > Security > Generate Tokens` in your SonarQube Server web UI
> - **SonarQube Cloud:** Go to `My Account > Security > Generate Tokens` at [sonarcloud.io](https://sonarcloud.io)

---

## Step 1: Download
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Download the latest binary for your platform from the [Releases](https://github.com/sonar-solutions/cloudvoyager/releases) page:

| Platform | Binary |
|----------|--------|
| macOS (Apple Silicon) | `cloudvoyager-macos-arm64` |
| macOS (Intel) | `cloudvoyager-macos-x64` |
| Linux (x64) | `cloudvoyager-linux-x64` |
| Linux (ARM64) | `cloudvoyager-linux-arm64` |
| Windows (x64) | `cloudvoyager-win-x64.exe` |
| Windows (ARM64) | `cloudvoyager-win-arm64.exe` |

On macOS/Linux, make the binary executable:

```bash
chmod +x cloudvoyager-*
```

## Step 2: Create a config file
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Create a file called `config.json`:

```json
{
  "sonarqube": {
    "url": "https://your-sonarqube-server.com",
    "token": "your_sonarqube_token",
    "projectKey": "your-project-key"
  },
  "sonarcloud": {
    "url": "https://sonarcloud.io",
    "token": "your_sonarcloud_token",
    "organization": "your-org",
    "projectKey": "your-project-key"
  }
}
```

> **Where to find your project key:** In SonarQube Server, go to your project's **Project Information** page — the key is shown there. You can use the same key for SonarQube Cloud, or choose a new one.

See [`examples/config.example.json`](../examples/config.example.json) for a ready-to-use template with all optional fields (rate limiting, performance tuning, etc.).

### Config fields
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

| Field | Required | Description |
|-------|----------|-------------|
| `sonarqube.url` | Yes | Full URL of your SonarQube Server |
| `sonarqube.token` | Yes | SonarQube Server API token (starts with `sqp_` on newer versions) |
| `sonarqube.projectKey` | Yes (for `transfer`) | Project key in SonarQube Server |
| `sonarcloud.url` | No | SonarQube Cloud URL (default: `https://sonarcloud.io`) |
| `sonarcloud.token` | Yes | SonarQube Cloud API token |
| `sonarcloud.organization` | Yes | SonarQube Cloud organization key |
| `sonarcloud.projectKey` | Yes (for `transfer`) | Project key to use in SonarQube Cloud |

> **Tip:** You can set tokens via environment variables (`SONARQUBE_TOKEN` and `SONARCLOUD_TOKEN`) instead of putting them in the config file.

### Optional: Transfer settings
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Add a `transfer` section to control incremental mode, batch size, and checkpoint behavior:

```json
{
  "transfer": {
    "mode": "incremental",
    "stateFile": "./.cloudvoyager-state.json",
    "batchSize": 100,
    "syncAllBranches": true,
    "checkpoint": {
      "enabled": true,
      "cacheExtractions": true,
      "cacheMaxAgeDays": 7,
      "strictResume": false
    }
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `mode` | `incremental` | `"full"` to transfer everything, or `"incremental"` to only sync changes since last run |
| `stateFile` | `./.cloudvoyager-state.json` | Where to save sync progress |
| `batchSize` | `100` | Items per batch (1–500) |
| `syncAllBranches` | `true` | Sync all branches (set to `false` for main branch only) |
| `excludeBranches` | `[]` | Branch names to skip |
| `checkpoint.enabled` | `true` | Enable phase-level checkpointing for pause/resume |
| `checkpoint.cacheExtractions` | `true` | Cache extracted data (gzipped JSON) to skip re-extraction on resume |
| `checkpoint.cacheMaxAgeDays` | `7` | Discard extraction caches older than this many days |
| `checkpoint.strictResume` | `false` | When `true`, abort if the session fingerprint (SQ version, URL, project key) has changed since the checkpoint was created |

## Step 3: Test your connections
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

```bash
./cloudvoyager test -c config.json
```

You should see a success message for both SonarQube Server and SonarQube Cloud. If not, double-check your URLs and tokens.

## Step 4: Run the transfer
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

```bash
./cloudvoyager transfer -c config.json --verbose
```

That's it! The tool uploads the report and returns immediately — it does not wait for SonarQube Cloud to finish processing. Your project data will appear in SonarQube Cloud once the analysis completes in the background.

> **Tip:** If you want the command to block until SonarQube Cloud finishes processing, add `--wait`.

---

## Other useful commands
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

```bash
# Validate your config file
./cloudvoyager validate -c config.json

# Check what's been synced
./cloudvoyager status -c config.json

# Clear sync history and start fresh
./cloudvoyager reset -c config.json
```

---

## Speed up the transfer (optional)
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

For large projects with many source files or issues, use `--auto-tune` to automatically detect your hardware and set optimal performance values:

```bash
./cloudvoyager transfer -c config.json --verbose --auto-tune
```

Or manually set specific values:

```bash
./cloudvoyager transfer -c config.json --verbose --concurrency 50 --max-memory 8192
```

See the [Configuration Reference](configuration.md#performance-settings) for all options.

---

## Pause and Resume
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Transfers are automatically checkpointed. If a transfer is interrupted (CTRL+C, crash, network failure), simply re-run the same command to resume from where it left off:

```bash
# Resume an interrupted transfer (just re-run the same command)
./cloudvoyager transfer -c config.json --verbose
```

Use `--show-progress` to see the current checkpoint status without running a transfer:

```bash
./cloudvoyager transfer -c config.json --show-progress
```

To discard progress and start fresh, use `--force-restart`:

```bash
./cloudvoyager transfer -c config.json --verbose --force-restart
```

### Upload deduplication
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

On resume after a crash, the tool checks whether a Compute Engine (CE) task already exists for the current session before uploading. This prevents duplicate scanner reports from being submitted to SonarQube Cloud. The check uses the `scm_revision_id` (git commit hash) included in each report.

### Lock file handling
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

An advisory lock file prevents multiple CloudVoyager instances from running against the same project simultaneously. The lock includes the process ID, hostname, and start time. Stale locks from crashed processes are auto-released after 6 hours. If a lock is held by another host or a non-stale process, the tool exits with an error. Use `--force-unlock` to manually release a lock you know is stale.

---

## All CLI Flags
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

| Flag | What it does |
|------|-------------|
| `--verbose` | Show detailed progress logs |
| `--auto-tune` | Auto-detect CPU and RAM and set optimal performance values |
| `--concurrency <n>` | Override max concurrency for I/O operations |
| `--max-memory <mb>` | Set max heap size in MB |
| `--wait` | Wait for analysis to complete before returning (default: does not wait) |
| `--skip-all-branch-sync` | Only sync the main branch (skip non-main branches) |
| `--force-restart` | Discard checkpoint journal and start fresh |
| `--force-fresh-extract` | Re-extract all data (discard extraction caches) |
| `--force-unlock` | Release a stale lock file from a crashed run |
| `--show-progress` | Show checkpoint progress and exit |

---

## Limitations
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

- Historical metrics (the charts in each project's **Activity** tab in SonarQube Server) cannot be migrated. All actual issues and hotspots are migrated — only the historical trend data is lost.

---

## Further Reading
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

- [Configuration Reference](configuration.md) — all config options, environment variables, npm scripts
- [Architecture](architecture.md) — project structure, data flow, report format
- [Technical Details](technical-details.md) — protobuf encoding, measure types, active rules
- [Troubleshooting](troubleshooting.md) — common errors and how to fix them
- [Key Capabilities](key-capabilities.md) — comprehensive overview of engineering and capabilities
- [Changelog](CHANGELOG.md) — release history and notable changes
