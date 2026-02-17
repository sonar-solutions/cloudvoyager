# CloudVoyager

Migrate your data from self-hosted SonarQube to SonarCloud — no re-scanning needed.

## What Is This?

If your team is moving from a self-hosted SonarQube server to SonarCloud, this tool saves you from having to re-scan all your projects from scratch. It copies everything — your projects, code issues, security hotspots, quality gates, quality profiles, permissions, and more — directly from SonarQube into SonarCloud.

## Prerequisites

Before you begin, make sure you have:

1. **Admin access** to your SonarQube server
2. **Admin access** to your SonarCloud organization
3. **API tokens** for both SonarQube and SonarCloud (you'll put these in a config file)

> **How to get your tokens:**
> - **SonarQube:** Go to `My Account > Security > Generate Tokens` in your SonarQube web UI
> - **SonarCloud:** Go to `My Account > Security > Generate Tokens` at [sonarcloud.io](https://sonarcloud.io)

---

## Quick Start (Single Project)

Use this if you just want to migrate one project.

### Step 1: Download

Download the latest binary for your platform from the [Releases](https://github.com/joshuaquek/cloudvoyager/releases) page:

| Platform | Binary |
|----------|--------|
| macOS (Apple Silicon) | `cloudvoyager-macos-arm64` |
| macOS (Intel) | `cloudvoyager-macos-x64` |
| Linux (x64) | `cloudvoyager-linux-x64` |
| Linux (ARM64) | `cloudvoyager-linux-arm64` |
| Windows (x64) | `cloudvoyager-win-x64.exe` |

On macOS/Linux, make the binary executable:

```bash
chmod +x cloudvoyager-*
```

### Step 2: Create a config file

Create a file called `config.json` and fill in your details:

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

> **Where to find your project key:** In SonarQube, go to your project's **Project Information** page — the key is shown there. You can use the same key for SonarCloud, or choose a new one.

### Step 3: Test your connections

Run this to make sure CloudVoyager can reach both servers:

```bash
./cloudvoyager test -c config.json
```

You should see a success message for both SonarQube and SonarCloud. If not, double-check your URLs and tokens.

### Step 4: Run the transfer

```bash
./cloudvoyager transfer -c config.json
```

That's it! Your project data will appear in SonarCloud once the transfer completes. Add `--verbose` for detailed progress output.

---

## Full Organization Migration (All Projects at Once)

Use this if you want to migrate **everything** from your SonarQube server to one or more SonarCloud organizations — including all projects, quality gates, quality profiles, groups, permissions, and more.

### What Gets Migrated

| Category | Details |
|----------|---------|
| **Projects** | All projects with their code, issues, hotspots, settings, tags, and links |
| **Quality Gates** | Gate definitions, conditions, default assignments, and permissions |
| **Quality Profiles** | Profile rules, defaults per language, and permissions |
| **Groups & Permissions** | User groups, org-level and project-level permissions, permission templates |
| **Portfolios** | Portfolio definitions and project membership |
| **DevOps Bindings** | GitHub, GitLab, Azure DevOps, and Bitbucket integrations |
| **New Code Definitions** | Per-project and per-branch new code period settings |
| **Server Info** | Server version, plugins, settings, and webhooks (saved as reference files, not migrated) |

### Step 1: Create a migration config file

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
    "outputDir": "./migration-output",
    "skipIssueMetadataSync": false,
    "skipHotspotMetadataSync": false
  }
}
```

> **Migrating to multiple orgs?** Just add more entries to the `organizations` array — each with its own key and token.

### Step 2: Do a dry run first (recommended)

A dry run extracts all data and generates mapping CSV files so you can review what will be migrated, without actually changing anything in SonarCloud:

```bash
./cloudvoyager migrate -c migrate-config.json --dry-run
```

Check the generated files in `./migration-output/` to make sure everything looks right.

### Step 3: Run the full migration

```bash
./cloudvoyager migrate -c migrate-config.json --verbose
```

This may take a while for large servers with many projects. Progress is logged throughout.

### Speed up the migration (optional)

If you want to skip syncing issue/hotspot metadata (statuses, comments, assignments), you can split it into two steps:

```bash
# Step 1: Migrate everything except metadata (fastest)
./cloudvoyager migrate -c migrate-config.json --skip-issue-metadata-sync --skip-hotspot-metadata-sync --verbose

# Step 2: Sync the metadata separately afterward
./cloudvoyager sync-metadata -c migrate-config.json --verbose
```

Or skip just the slowest part:

```bash
# Skip hotspot metadata sync only (the slowest part)
./cloudvoyager migrate -c migrate-config.json --skip-hotspot-metadata-sync

# Then sync hotspot metadata later
./cloudvoyager sync-metadata -c migrate-config.json --skip-issue-metadata-sync --verbose
```

### Generated Output Files

The migration generates mapping files in your output directory for review:

| File | What's in it |
|------|-------------|
| `organizations.csv` | Projects grouped by target organization |
| `projects.csv` | All projects with their metadata |
| `group-mappings.csv` | Groups mapped to target organizations |
| `profile-mappings.csv` | Quality profiles mapped to target organizations |
| `gate-mappings.csv` | Quality gates mapped to target organizations |
| `portfolio-mappings.csv` | Portfolios mapped to target organizations |
| `template-mappings.csv` | Permission templates mapped to target organizations |
| `migration-report.txt` | Human-readable report with per-project, per-step results |
| `migration-report.json` | Machine-readable report (same data as above, structured JSON) |

Server info (version, plugins, settings, webhooks) is saved to `{outputDir}/server-info/` as JSON files for your records.

The migration report is always generated at the end of a run (even if the migration crashes partway through). Open `migration-report.txt` to quickly see which projects succeeded, partially succeeded, or failed — and exactly which step failed for each.

---

## All Commands

| Command | What it does |
|---------|-------------|
| `test` | Check that both servers are reachable |
| `validate` | Check your config file for errors |
| `transfer` | Migrate a single project |
| `transfer-all` | Migrate all projects to a single SonarCloud org |
| `migrate` | Full migration to one or more SonarCloud organizations |
| `sync-metadata` | Sync only issue & hotspot metadata for already-migrated projects |
| `status` | See what's been synced so far |
| `reset` | Clear sync history and start fresh |

Add `--verbose` to any command for detailed output.

### npm Scripts

If you're running from source (for development), all commands are also available as npm scripts:

| Script | What it does |
|--------|-------------|
| `npm run validate` | Validate `config.json` |
| `npm run test:connection` | Test connections using `config.json` |
| `npm run transfer` | Transfer a single project using `config.json` |
| `npm run transfer-all` | Transfer all projects using `config.json` |
| `npm run transfer-all:dry-run` | Dry run transfer-all |
| `npm run status` | Show sync status |
| `npm run reset` | Clear sync history |
| `npm run migrate` | Full migration using `migrate-config.json` |
| `npm run migrate:dry-run` | Dry run migration |
| `npm run migrate:skip-hotspot-metadata` | Migrate without hotspot metadata sync |
| `npm run migrate:skip-issue-metadata` | Migrate without issue metadata sync |
| `npm run migrate:skip-all-metadata` | Migrate without any metadata sync |
| `npm run sync-metadata` | Sync issue & hotspot metadata only (for already-migrated projects) |
| `npm run sync-metadata:issues-only` | Sync only issue metadata |
| `npm run sync-metadata:hotspots-only` | Sync only hotspot metadata |

---

## Rate Limiting

By default, CloudVoyager retries rate-limited requests (503/429) up to 3 times with exponential backoff. You can customize this via the `rateLimit` section in your config file:

```json
{
  "rateLimit": {
    "maxRetries": 3,
    "baseDelay": 1000,
    "minRequestInterval": 0
  }
}
```

| Option | Default | What it does |
|--------|---------|-------------|
| `maxRetries` | `3` | Retry on 503/429 up to N times with exponential backoff (0 to disable) |
| `baseDelay` | `1000` | Initial retry delay in ms (doubles each attempt: 1s, 2s, 4s...) |
| `minRequestInterval` | `0` (off) | Minimum ms between write requests to avoid triggering limits |

See the [Configuration Reference](docs/configuration.md#rate-limit-settings) for more details and examples.

---

## Limitations

- Historical metrics (the charts in each project's **Activity** tab in SonarQube) cannot be migrated. All actual issues and hotspots are migrated — only the historical trend data is lost.

---

## Example Configs

See the `examples/` folder for ready-to-use config templates:

| File | Use with |
|------|----------|
| `examples/config.example.json` | `transfer`, `test`, `validate`, `status`, `reset` |
| `examples/transfer-all-config.example.json` | `transfer-all` |
| `examples/migrate-config.example.json` | `migrate` |

## Further Reading

- [Usage Guide](docs/usage-guide.md) — step-by-step walkthrough of each config file and how to use it
- [Configuration Reference](docs/configuration.md) — all config options, environment variables, npm scripts
- [Architecture](docs/architecture.md) — project structure, data flow, report format
- [Technical Details](docs/technical-details.md) — protobuf encoding, measure types, active rules
- [Troubleshooting](docs/troubleshooting.md) — common errors and how to fix them

## License

MIT
