# 🏢 Migrate Everything to One SonarCloud Organization

<!-- Last updated: 2026-02-20 -->

Use this when you want to migrate **all projects and configuration** from your SonarQube server to a **single** SonarCloud organization.

---

<!-- Updated: 2026-02-20 -->
## 📦 What Gets Migrated

| Category | Details |
|----------|---------|
| **Projects** | All projects with code, issues, hotspots, settings, tags, and links |
| **Quality Gates** | Gate definitions, conditions, default assignments, and permissions |
| **Quality Profiles** | Profile rules, defaults per language, and permissions |
| **Groups & Permissions** | User groups, org-level and project-level permissions, permission templates |
| **Portfolios** | Portfolio definitions and project membership |
| **DevOps Bindings** | GitHub, GitLab, Azure DevOps, and Bitbucket integrations |
| **New Code Definitions** | Per-project and per-branch new code period settings |
| **Server Info** | Server version, plugins, settings, and webhooks (saved as reference files) |

---

<!-- Updated: 2026-02-20 -->
## ✅ Prerequisites

1. **Admin access** to your SonarQube server
2. **Admin access** to your SonarCloud organization
3. **API tokens** for both SonarQube and SonarCloud

> **How to get your tokens:**
> - **SonarQube:** Go to `My Account > Security > Generate Tokens` in your SonarQube web UI
> - **SonarCloud:** Go to `My Account > Security > Generate Tokens` at [sonarcloud.io](https://sonarcloud.io)

---

<!-- Updated: 2026-02-20 -->
## 📥 Step 1: Download

Download the latest binary for your platform from the [Releases](https://github.com/joshuaquek/cloudvoyager/releases) page:

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

<!-- Updated: 2026-02-20 -->
## 📝 Step 2: Create a config file

Create a file called `migrate-config.json`:

```json
{
  "sonarqube": {
    "url": "https://your-sonarqube-server.com",
    "token": "your_sonarqube_admin_token"
  },
  "sonarcloud": {
    "organizations": [
      {
        "key": "your-org-key",
        "token": "your_sonarcloud_token",
        "url": "https://sonarcloud.io"
      }
    ]
  },
  "migrate": {
    "outputDir": "./migration-output"
  }
}
```

See [`examples/migrate-config.example.json`](../examples/migrate-config.example.json) for a ready-to-use template with all optional fields (rate limiting, performance tuning, etc.).

> **Project keys and names:** Each project's display name is automatically carried over from SonarQube. By default, the tool uses the **original SonarQube project key** on SonarCloud. If the key is already taken by another SonarCloud organization, the tool falls back to a prefixed key (`{org-key}_{sonarqube-project-key}`) and logs a warning. Any key conflicts are listed in the migration report.

<!-- Updated: 2026-02-20 -->
### Config fields

| Field | Required | Description |
|-------|----------|-------------|
| `sonarqube.url` | Yes | Full URL of your SonarQube server |
| `sonarqube.token` | Yes | SonarQube admin API token |
| `sonarcloud.organizations[].key` | Yes | SonarCloud organization key |
| `sonarcloud.organizations[].token` | Yes | SonarCloud admin API token |
| `sonarcloud.organizations[].url` | No | SonarCloud URL (default: `https://sonarcloud.io`) |
| `migrate.outputDir` | No | Directory for mapping CSVs and reports (default: `./migration-output`) |

> **Tip:** You can set tokens via environment variables (`SONARQUBE_TOKEN` and `SONARCLOUD_TOKEN`) instead of putting them in the config file.

<!-- Updated: 2026-02-20 -->
## 🚀 Step 3: Run the migration (recommended 3-step approach)

We recommend a 3-step migration: dry run, migrate without metadata, then sync metadata separately. This gives you the best combination of safety, speed, and reliability.

<!-- Updated: 2026-02-20 -->
### Step 3a: Dry run — verify everything

A dry run extracts all data and generates mapping CSVs so you can review what will be migrated, without changing anything in SonarCloud:

```bash
./cloudvoyager migrate -c migrate-config.json --dry-run
```

Check the generated files in `./migration-output/` to make sure everything looks right.

<!-- Updated: 2026-02-20 -->
### Step 3b: Migrate without metadata + auto-tune

Run the actual migration with metadata sync disabled and auto-tuned performance. This transfers all projects, quality gates, profiles, groups, permissions, and report data — but skips the slower issue/hotspot status transitions:

```bash
./cloudvoyager migrate -c migrate-config.json --verbose --skip-issue-metadata-sync --skip-hotspot-metadata-sync --auto-tune
```

Skipping metadata during the main migration avoids SonarCloud rate limiting (503 errors) that can occur during high-volume issue/hotspot sync.

> **Note:** By default, the tool does not wait for each project's analysis to complete on SonarCloud before moving on to the next project. This speeds up large migrations significantly. Add `--wait` if you need to block until each analysis finishes.

<!-- Updated: 2026-02-20 -->
### Step 3c: Sync metadata separately

Once all projects are migrated, sync issue and hotspot metadata as a standalone step:

```bash
./cloudvoyager sync-metadata -c migrate-config.json --verbose
```

This step is safely retryable — if it hits rate limits, just run it again. You can also sync just one type at a time:

```bash
# Sync only issue metadata
./cloudvoyager sync-metadata -c migrate-config.json --skip-hotspot-metadata-sync --verbose

# Sync only hotspot metadata
./cloudvoyager sync-metadata -c migrate-config.json --skip-issue-metadata-sync --verbose
```

---

<!-- Updated: 2026-02-20 -->
## ⚡ Performance tuning (optional)

The `--auto-tune` flag (used in Step 3b) detects your hardware (CPU cores and RAM) and sets optimal values automatically. You can also manually set specific values:

```bash
./cloudvoyager migrate -c migrate-config.json --verbose --concurrency 50 --project-concurrency 8 --max-memory 8192
```

Or add a `performance` section to your config file. Here are recommended settings by migration size:

**Small migration (< 10 projects, < 1000 issues):**
Use defaults — no `performance` section needed.

**Medium migration (10-50 projects, 1K-50K issues):**
```json
{
  "performance": {
    "sourceExtraction": { "concurrency": 15 },
    "issueSync": { "concurrency": 8 },
    "projectMigration": { "concurrency": 2 }
  }
}
```

**Large migration (50+ projects, 50K+ issues):**
```json
{
  "performance": {
    "maxMemoryMB": 8192,
    "sourceExtraction": { "concurrency": 20 },
    "hotspotExtraction": { "concurrency": 15 },
    "issueSync": { "concurrency": 10 },
    "hotspotSync": { "concurrency": 5 },
    "projectMigration": { "concurrency": 3 }
  }
}
```

Keep `hotspotSync.concurrency` low (3–5) to avoid SonarCloud rate limits. See the [Configuration Reference](configuration.md#performance-settings) for all options.

---

<!-- Updated: 2026-02-20 -->
## 📄 Generated Output Files

| File | What's in it |
|------|-------------|
| `mappings/organizations.csv` | Projects grouped by target organization |
| `mappings/projects.csv` | All projects with their metadata |
| `mappings/group-mappings.csv` | Groups mapped to target organizations |
| `mappings/profile-mappings.csv` | Quality profiles mapped to target organizations |
| `mappings/gate-mappings.csv` | Quality gates mapped to target organizations |
| `mappings/portfolio-mappings.csv` | Portfolios mapped to target organizations |
| `mappings/template-mappings.csv` | Permission templates mapped to target organizations |
| `reports/migration-report.txt` | Human-readable report with per-project, per-step results |
| `reports/migration-report.json` | Machine-readable report (same data, structured JSON) |
| `reports/migration-report.md` | Detailed markdown report |
| `reports/executive-summary.md` | High-level executive summary |
| `reports/performance-report.md` | Performance metrics breakdown |
| `reports/*.pdf` | PDF versions of the above reports (best-effort) |
| `quality-profiles/quality-profile-diff.json` | Per-language diff of active rules between SonarQube and SonarCloud |

Server info (version, plugins, settings, webhooks) is saved to `{outputDir}/server-info/` as JSON files.
Per-project state files are saved to `{outputDir}/state/` for incremental transfer tracking.

---

<!-- Updated: 2026-02-20 -->
## 🚩 All CLI Flags

| Flag | What it does |
|------|-------------|
| `--verbose` | Show detailed progress logs |
| `--dry-run` | Extract data and generate mappings without migrating |
| `--skip-issue-metadata-sync` | Skip syncing issue statuses, comments, assignments, tags |
| `--skip-hotspot-metadata-sync` | Skip syncing hotspot statuses and comments |
| `--skip-quality-profile-sync` | Skip syncing quality profiles (projects use default SonarCloud profiles) |
| `--auto-tune` | Auto-detect CPU and RAM and set optimal performance values |
| `--concurrency <n>` | Override max concurrency for I/O operations |
| `--project-concurrency <n>` | Max concurrent project migrations |
| `--max-memory <mb>` | Set max heap size in MB |
| `--wait` | Wait for analysis to complete before returning (default: does not wait) |

---

<!-- Updated: 2026-02-20 -->
## ⚠️ Limitations

- Historical metrics (the charts in each project's **Activity** tab in SonarQube) cannot be migrated. All actual issues and hotspots are migrated — only the historical trend data is lost.

---

<!-- Updated: 2026-02-20 -->
## 📚 Further Reading

- [Configuration Reference](configuration.md) — all config options, environment variables, npm scripts
- [Architecture](architecture.md) — project structure, data flow, report format
- [Technical Details](technical-details.md) — protobuf encoding, measure types, active rules
- [Troubleshooting](troubleshooting.md) — common errors and how to fix them

<!--
## Change Log
| Date | Section | Change |
|------|---------|--------|
| 2026-02-20 | All | Initial section timestamps added |
-->
