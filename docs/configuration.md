# ⚙️ Configuration

<!-- Last updated: Feb 25, 2026 at 10:30:00 AM -->

CloudVoyager supports two configuration formats depending on the command you're using.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📋 Single Project Config

Used by: `transfer`, `test`, `validate`, `status`, `reset`

```json
{
  "sonarqube": {
    "url": "https://sonarqube.example.com",
    "token": "sqp_your_sonarqube_token_here",
    "projectKey": "my-project-key"
  },
  "sonarcloud": {
    "url": "https://sonarcloud.io",
    "token": "your_sonarcloud_token_here",
    "organization": "my-organization",
    "projectKey": "my-project-key"
  },
  "transfer": {
    "mode": "incremental",
    "stateFile": "./.cloudvoyager-state.json",
    "batchSize": 100,
    "syncAllBranches": true,
    "excludeBranches": []
  }
}
```

See `examples/config.example.json` for a complete example.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📋 Migration Config

Used by: `migrate`, `sync-metadata`

Performs a full migration from a SonarQube server to one or more SonarCloud organizations, including projects, quality gates, quality profiles, groups, permissions, portfolios, and more. The `sync-metadata` command uses the same config to sync only issue and hotspot metadata for already-migrated projects.

```json
{
  "sonarqube": {
    "url": "https://sonarqube.example.com",
    "token": "sqp_your_sonarqube_admin_token"
  },
  "sonarcloud": {
    "enterprise": {
      "key": "your-enterprise-key"
    },
    "organizations": [
      {
        "key": "org-one",
        "token": "sonarcloud_token_for_org_one",
        "url": "https://sonarcloud.io"
      },
      {
        "key": "org-two",
        "token": "sonarcloud_token_for_org_two",
        "url": "https://sonarcloud.io"
      }
    ]
  },
  "transfer": {
    "mode": "full",
    "batchSize": 100,
    "syncAllBranches": true,
    "excludeBranches": []
  },
  "migrate": {
    "outputDir": "./migration-output",
    "skipIssueMetadataSync": false,
    "skipHotspotMetadataSync": false,
    "skipQualityProfileSync": false,
    "dryRun": false
  }
}
```

See `examples/migrate-config.example.json` for a complete example.

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🔧 Configuration Options

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### SonarQube Settings

| Option | Required | Description |
|--------|----------|-------------|
| `url` | Yes | SonarQube server URL |
| `token` | Yes | SonarQube API token (or set via `SONARQUBE_TOKEN` env var) |
| `projectKey` | For `transfer` only | Project key to export (not needed for `migrate`) |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### SonarCloud Settings (Single Org)

Used by `transfer`, `test`, `validate`, `status`, `reset`.

| Option | Required | Description |
|--------|----------|-------------|
| `url` | No | SonarCloud server URL (default: `https://sonarcloud.io`) |
| `token` | Yes | SonarCloud API token (or set via `SONARCLOUD_TOKEN` env var) |
| `organization` | Yes | SonarCloud organization key |
| `projectKey` | For `transfer` only | Destination project key. The display name is automatically carried over from SonarQube |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### SonarCloud Settings (Multi-Org)

Used by `migrate`, `sync-metadata`. Instead of a single org, you provide an array of target organizations.

| Option | Required | Description |
|--------|----------|-------------|
| `organizations[].key` | Yes | SonarCloud organization key |
| `organizations[].token` | Yes | SonarCloud API token for this org |
| `organizations[].url` | No | SonarCloud server URL (default: `https://sonarcloud.io`) |
| `enterprise.key` | For portfolio migration | SonarCloud enterprise key (required only for portfolio migration via V2 API) |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Transfer Settings

| Option | Default | Description |
|--------|---------|-------------|
| `mode` | `incremental` | `"incremental"` or `"full"`. Note: defaults to `"full"` when using the `migrate` or `sync-metadata` commands |
| `stateFile` | `./.cloudvoyager-state.json` | Path to state file for incremental transfers. Only applies to `transfer` command (not `migrate` or `sync-metadata`) |
| `batchSize` | `100` | Number of items per batch (1–500) |
| `syncAllBranches` | `true` | Sync all branches of every project. Set to `false` to only sync the main branch |
| `excludeBranches` | `[]` | Branch names to exclude from sync when `syncAllBranches` is `true` |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Migrate Settings

| Option | Default | Description |
|--------|---------|-------------|
| `outputDir` | `./migration-output` | Directory for mapping CSVs and server info output |
| `skipIssueMetadataSync` | `false` | Skip syncing issue metadata (statuses, assignments, comments, tags) |
| `skipHotspotMetadataSync` | `false` | Skip syncing hotspot metadata (statuses, comments) |
| `skipQualityProfileSync` | `false` | Skip syncing quality profiles (projects use default SonarCloud profiles) |
| `dryRun` | `false` | Extract and generate mappings without migrating |

> **Project key behavior (migrate command):** By default, the `migrate` command uses the original SonarQube project key on SonarCloud. If the key is already taken by another SonarCloud organization, the tool falls back to a prefixed key (`{org}_{key}`) and logs a warning. Key conflicts are listed in the migration report.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Rate Limit Settings

Controls retry and throttling behavior for SonarCloud API requests. By default, retries are enabled (`maxRetries: 3`) but request throttling is off (`minRequestInterval: 0`). Add a `rateLimit` section to any config file to customize.

```json
{
  "rateLimit": {
    "maxRetries": 3,
    "baseDelay": 1000,
    "minRequestInterval": 0
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `maxRetries` | `3` | Max retry attempts when SonarCloud returns 503 or 429. Set to `0` to disable retries. Retries use exponential backoff (delay doubles each attempt). |
| `baseDelay` | `1000` | Initial delay in ms before the first retry. Doubles each retry: 1000ms → 2000ms → 4000ms → etc. Only applies when `maxRetries` > 0. |
| `minRequestInterval` | `0` | Minimum ms to wait between POST (write) requests. Set to `0` to disable throttling. Values like `100`–`200` help avoid triggering rate limits during high-volume operations. |

**Example: aggressive rate limiting for large migrations:**

```json
{
  "rateLimit": {
    "maxRetries": 10,
    "baseDelay": 2000,
    "minRequestInterval": 250
  }
}
```

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Performance Settings

Controls CPU, memory, and concurrency tuning. Add a `performance` section to any config file. All settings are optional — defaults are tuned for safe, moderate parallelism.

```json
{
  "performance": {
    "autoTune": false,
    "maxConcurrency": 8,
    "maxMemoryMB": 8192,
    "sourceExtraction": { "concurrency": 10 },
    "hotspotExtraction": { "concurrency": 10 },
    "issueSync": { "concurrency": 5 },
    "hotspotSync": { "concurrency": 3 },
    "projectMigration": { "concurrency": 1 }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `autoTune` | `false` | Auto-detect CPU and RAM and set optimal values. When enabled, uses 75% of total RAM (max 16GB) and scales concurrency based on CPU cores. Explicit settings override auto-tuned values. |
| `maxConcurrency` | `8` | General concurrency limit for parallel I/O operations (1–64) |
| `maxMemoryMB` | `0` | Max heap size in MB. Set to `0` for Node.js default. The tool auto-restarts with the increased heap size when needed. |
| `sourceExtraction.concurrency` | `10` | Max concurrent source file fetches from SonarQube (1–50) |
| `hotspotExtraction.concurrency` | `10` | Max concurrent hotspot detail fetches from SonarQube (1–50) |
| `issueSync.concurrency` | `5` | Max concurrent issue metadata sync operations to SonarCloud (1–20) |
| `hotspotSync.concurrency` | `3` | Max concurrent hotspot sync operations to SonarCloud (1–20). Lower default due to rate limiting sensitivity. |
| `projectMigration.concurrency` | `1` | Max concurrent project migrations (1–8). Default `1` = sequential (backward-compatible). |

**CLI overrides:** Performance settings can be overridden via CLI flags. Available flags vary by command:

| Flag | Description | Available on |
|------|-------------|-------------|
| `--auto-tune` | Auto-detect CPU and RAM and set optimal performance values | `transfer`, `migrate`, `sync-metadata` |
| `--concurrency <n>` | Override max concurrency for all I/O operations | `transfer`, `migrate`, `sync-metadata` |
| `--max-memory <mb>` | Set max heap size in MB | `transfer`, `migrate`, `sync-metadata` |
| `--project-concurrency <n>` | Max concurrent project migrations | `migrate` |
| `--skip-all-branch-sync` | Only sync the main branch (skip non-main branches). Equivalent to setting `syncAllBranches: false` in the `transfer` section | `transfer`, `migrate`, `sync-metadata` |

**Selective migration flag:**

| Flag | Description | Available on |
|------|-------------|-------------|
| `--only <components>` | Only migrate specific components (comma-separated). See table below | `migrate` |

Valid `--only` components:

| Component | What it migrates |
|-----------|-----------------|
| `scan-data` | Project main branch scanner report only (no non-main branches) |
| `scan-data-all-branches` | Project scanner reports for all branches |
| `portfolios` | Enterprise portfolios (requires projects already migrated) |
| `quality-gates` | Quality gates (org-wide creation + per-project assignment) |
| `quality-profiles` | Quality profiles (org-wide restore + per-project assignment) |
| `permission-templates` | Permission templates (org-wide) |
| `permissions` | User groups + global permissions + project permissions |
| `issue-metadata` | Issue metadata sync: statuses, assignments, comments, tags (requires projects already migrated) |
| `hotspot-metadata` | Hotspot metadata sync: statuses, comments (requires projects already migrated) |
| `project-settings` | Project settings, tags, links, new code periods, DevOps bindings |

Multiple components can be combined: `--only scan-data,quality-gates,permissions`

**Other CLI flags:**

| Flag | Description | Available on |
|------|-------------|-------------|
| `--wait` | Wait for analysis to complete before returning (default: does not wait) | `transfer`, `migrate` |

**Example: high-performance migration:**

```bash
./cloudvoyager migrate -c migrate-config.json --verbose --concurrency 50 --project-concurrency 8
```

**Example: applying max memory (auto-restarts with increased heap):**

```bash
./cloudvoyager migrate -c migrate-config.json --verbose --max-memory 8192
```

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🌍 Environment Variables

| Variable | Description |
|----------|-------------|
| `SONARQUBE_TOKEN` | Override SonarQube token from config |
| `SONARCLOUD_TOKEN` | Override SonarCloud token from config |
| `SONARQUBE_URL` | Override SonarQube URL from config |
| `SONARCLOUD_URL` | Override SonarCloud URL from config |
| `LOG_LEVEL` | Set logging level (`debug`, `info`, `warn`, `error`) |
| `LOG_FILE` | Path to log file (optional) |
| `MAX_SOURCE_FILES` | Limit number of source files to extract (0 = all) |

<!-- Updated: Feb 21, 2026 at 10:30:00 AM -->
## 📜 npm Scripts vs Binary Commands

CloudVoyager can be run in two ways:

1. **Via npm** (requires source checkout + `npm install`): `npm run <script>`
2. **Via standalone binary** (no Node.js required): `./cloudvoyager <command> [options]`

All CLI flags work identically in both modes. The table below shows every available CLI command in both forms:

| What it does | npm script | Binary equivalent |
|-------------|-----------|-------------------|
| Validate `config.json` | `npm run validate` | `./cloudvoyager validate -c config.json` |
| Test connections | `npm run test:connection` | `./cloudvoyager test -c config.json` |
| Transfer a single project | `npm run transfer` | `./cloudvoyager transfer -c config.json --verbose` |
| Show sync status | `npm run status` | `./cloudvoyager status -c config.json` |
| Clear sync history | `npm run reset` | `./cloudvoyager reset -c config.json` |
| Full migration | `npm run migrate` | `./cloudvoyager migrate -c migrate-config.json --verbose` |
| Dry run migration | `npm run migrate:dry-run` | `./cloudvoyager migrate -c migrate-config.json --verbose --dry-run` |
| Migrate without hotspot metadata sync | `npm run migrate:skip-hotspot-metadata` | `./cloudvoyager migrate -c migrate-config.json --verbose --skip-hotspot-metadata-sync` |
| Migrate without issue metadata sync | `npm run migrate:skip-issue-metadata` | `./cloudvoyager migrate -c migrate-config.json --verbose --skip-issue-metadata-sync` |
| Migrate without any metadata sync | `npm run migrate:skip-all-metadata` | `./cloudvoyager migrate -c migrate-config.json --verbose --skip-issue-metadata-sync --skip-hotspot-metadata-sync` |
| Migrate without quality profile sync | `npm run migrate:skip-quality-profiles` | `./cloudvoyager migrate -c migrate-config.json --verbose --skip-quality-profile-sync` |
| Migrate skip all (metadata + profiles, auto-tuned) | `npm run migrate:skip-all` | `./cloudvoyager migrate -c migrate-config.json --verbose --skip-issue-metadata-sync --skip-hotspot-metadata-sync --skip-quality-profile-sync --auto-tune` |
| Sync issue & hotspot metadata only | `npm run sync-metadata` | `./cloudvoyager sync-metadata -c migrate-config.json --verbose` |
| Sync only issue metadata | `npm run sync-metadata:skip-hotspot-metadata` | `./cloudvoyager sync-metadata -c migrate-config.json --verbose --skip-hotspot-metadata-sync` |
| Sync only hotspot metadata | `npm run sync-metadata:skip-issue-metadata` | `./cloudvoyager sync-metadata -c migrate-config.json --verbose --skip-issue-metadata-sync` |
| Sync metadata, skip quality profiles | `npm run sync-metadata:skip-quality-profiles` | `./cloudvoyager sync-metadata -c migrate-config.json --verbose --skip-quality-profile-sync` |
| Transfer single project (auto-tuned) | `npm run transfer:auto-tune` | `./cloudvoyager transfer -c config.json --verbose --auto-tune` |
| Full migration (auto-tuned) | `npm run migrate:auto-tune` | `./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune` |
| Migrate without metadata (auto-tuned) | `npm run migrate:skip-all-metadata:auto-tune` | `./cloudvoyager migrate -c migrate-config.json --verbose --skip-issue-metadata-sync --skip-hotspot-metadata-sync --auto-tune` |
| Migrate without quality profiles (auto-tuned) | `npm run migrate:skip-quality-profiles:auto-tune` | `./cloudvoyager migrate -c migrate-config.json --verbose --skip-quality-profile-sync --auto-tune` |
| Sync metadata (auto-tuned) | `npm run sync-metadata:auto-tune` | `./cloudvoyager sync-metadata -c migrate-config.json --verbose --auto-tune` |
| Migrate only scan data (main branch) | `npm run migrate:only-scan-data` | `./cloudvoyager migrate -c migrate-config.json --verbose --only scan-data` |
| Migrate only scan data (all branches) | `npm run migrate:only-scan-data-all-branches` | `./cloudvoyager migrate -c migrate-config.json --verbose --only scan-data-all-branches` |
| Migrate only quality gates | `npm run migrate:only-quality-gates` | `./cloudvoyager migrate -c migrate-config.json --verbose --only quality-gates` |
| Migrate only quality profiles | `npm run migrate:only-quality-profiles` | `./cloudvoyager migrate -c migrate-config.json --verbose --only quality-profiles` |
| Migrate only permissions | `npm run migrate:only-permissions` | `./cloudvoyager migrate -c migrate-config.json --verbose --only permissions` |
| Migrate only permission templates | `npm run migrate:only-permission-templates` | `./cloudvoyager migrate -c migrate-config.json --verbose --only permission-templates` |
| Migrate only portfolios | `npm run migrate:only-portfolios` | `./cloudvoyager migrate -c migrate-config.json --verbose --only portfolios` |
| Migrate only issue metadata | `npm run migrate:only-issue-metadata` | `./cloudvoyager migrate -c migrate-config.json --verbose --only issue-metadata` |
| Migrate only hotspot metadata | `npm run migrate:only-hotspot-metadata` | `./cloudvoyager migrate -c migrate-config.json --verbose --only hotspot-metadata` |
| Migrate only project settings | `npm run migrate:only-project-settings` | `./cloudvoyager migrate -c migrate-config.json --verbose --only project-settings` |
| Migrate scan data + quality gates + permissions | — | `./cloudvoyager migrate -c migrate-config.json --verbose --only scan-data,quality-gates,permissions` |

> **Note:** The npm scripts use hardcoded config file paths (`config.json` or `migrate-config.json`). When using the binary directly, you can specify any config file path with `-c <path>`.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🚀 Recommended Migration Workflow

For multi-project migrations (`migrate` command), we recommend the following 3-step approach. This gives you the best combination of safety, speed, and reliability.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Step 1: Dry run — verify everything

Run a dry run first to extract all data, generate mapping CSVs, and validate your config without touching SonarCloud:

```bash
# npm
npm run migrate:dry-run

# binary
./cloudvoyager migrate -c migrate-config.json --verbose --dry-run
```

Check the generated files in `./migration-output/` (especially `mappings/organizations.csv`) to verify project-to-org assignments look correct.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Step 2: Migrate without metadata + auto-tune

Run the actual migration with metadata sync disabled and auto-tuned performance. This transfers all projects, quality gates, profiles, groups, permissions, and report data — but skips the slower issue/hotspot status transitions:

```bash
# npm
npm run migrate:skip-all-metadata:auto-tune

# binary
./cloudvoyager migrate -c migrate-config.json --verbose --skip-issue-metadata-sync --skip-hotspot-metadata-sync --auto-tune
```

Skipping metadata during the main migration avoids SonarCloud rate limiting (503 errors) that can occur during high-volume issue/hotspot sync.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Step 3: Sync metadata separately

Once all projects are migrated, sync issue and hotspot metadata as a standalone step. This transitions issue statuses, copies comments, sets assignees, and syncs tags:

```bash
# npm
npm run sync-metadata

# binary
./cloudvoyager sync-metadata -c migrate-config.json --verbose
```

This step is safely retryable — if it hits rate limits, just run it again. Already-synced items are matched by rule+file+line and won't be duplicated.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Why this approach?

| Step | What it does | Why |
|------|-------------|-----|
| Dry run | Validates config, generates mappings | Catches errors before committing |
| Migrate skip-all-metadata | Transfers reports + org-level config | Fast, avoids rate limits on SC |
| Sync metadata | Transitions issue/hotspot statuses | Retryable, isolated from main migration |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🔄 Incremental Transfers

When using incremental mode, the tool:
1. Tracks the last successful sync timestamp
2. Only fetches issues created after the last sync
3. Maintains a list of processed issues to avoid duplicates
4. Tracks completed branches to skip them on subsequent runs
5. Records sync history for audit purposes

To force a full transfer, use the `reset` command to clear the state.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### State File

The state file (`.cloudvoyager-state.json` by default) contains:
- Last sync timestamp
- List of processed issue keys
- Completed branches (used to skip already-synced branches in incremental mode)
- Sync history (last 10 entries)

## 📚 Further Reading

- [Architecture](architecture.md) — project structure, data flow, report format
- [Technical Details](technical-details.md) — protobuf encoding, measure types, concurrency model
- [Key Capabilities](key-capabilities.md) — comprehensive overview of engineering and capabilities
- [Troubleshooting](troubleshooting.md) — common errors and how to fix them
- [Dry-Run CSV Reference](dry-run-csv-reference.md) — CSV schema documentation for the dry-run workflow
- [Changelog](CHANGELOG.md) — release history and notable changes

<!--
## Change Log
| Date | Section | Change |
|------|---------|--------|
| 2026-02-20 | Migration Config, Multi-Org Settings | Enterprise config for V2 portfolio API |
| 2026-02-19 | npm Scripts | Expanded script table with all commands |
| 2026-02-18 | Performance Settings | Auto-tune feature added |
| 2026-02-17 | Transfer-All, Migrate, Rate Limit, Workflow | Migration engine config options |
| 2026-02-16 | Single Project, SonarQube, Env Vars, State | Core configuration system |
-->
