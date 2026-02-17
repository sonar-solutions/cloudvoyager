# Usage Guide

This guide walks you through each config file in the `examples/` folder and shows you exactly how to use them.

---

## Before You Start

You'll need two things:

1. **A SonarQube API token** — generate one in your SonarQube web UI at `My Account > Security > Generate Tokens`. Your account must have **Admin** permissions.

2. **A SonarCloud API token** — generate one at [sonarcloud.io](https://sonarcloud.io) (or your SonarCloud staging URL) under `My Account > Security > Generate Tokens`. Your account must have **Admin** permissions on the target organization.

> **Tip:** You can also set tokens via environment variables (`SONARQUBE_TOKEN` and `SONARCLOUD_TOKEN`) instead of putting them in the config file. This is useful for CI/CD pipelines or if you don't want tokens in version control.

---

## Config File 1: Single Project Transfer

**Example file:** `examples/config.example.json`
**Used with commands:** `transfer`, `test`, `validate`, `status`, `reset`

Use this when you want to migrate **one specific project** from SonarQube to SonarCloud.

### Step-by-step setup

1. Copy the example file:

```bash
cp examples/config.example.json config.json
```

2. Open `config.json` and fill in your values:

```json
{
  "sonarqube": {
    "url": "https://your-sonarqube-server.com",
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
    "batchSize": 100
  }
}
```

### What each field means

| Field | What to put here |
|-------|-----------------|
| `sonarqube.url` | The full URL of your SonarQube server (e.g. `https://sonar.mycompany.com`) |
| `sonarqube.token` | Your SonarQube API token (starts with `sqp_` on newer versions) |
| `sonarqube.projectKey` | The project key in SonarQube. Find it on the project's **Project Information** page |
| `sonarcloud.url` | Usually `https://sonarcloud.io` (change only if using a staging instance) |
| `sonarcloud.token` | Your SonarCloud API token |
| `sonarcloud.organization` | Your SonarCloud organization key (visible in your org's URL) |
| `sonarcloud.projectKey` | The project key to use in SonarCloud. Can be the same as the SonarQube key, or different |
| `transfer.mode` | `"full"` to transfer everything, or `"incremental"` to only sync changes since the last run |
| `transfer.stateFile` | Where to save sync progress (so incremental transfers know where to pick up) |
| `transfer.batchSize` | How many items to process at a time (default `100`, max `500`) |

### How to use it

```bash
# First, check that the config file is valid
./cloudvoyager validate -c config.json

# Test that both servers are reachable
./cloudvoyager test -c config.json

# Run the transfer
./cloudvoyager transfer -c config.json --verbose

# Check what's been synced
./cloudvoyager status -c config.json

# Start fresh (clear all sync history)
./cloudvoyager reset -c config.json
```

Or with npm scripts:

```bash
npm run validate
npm run test:connection
npm run transfer
npm run status
npm run reset
```

---

## Config File 2: Transfer All Projects

**Example file:** `examples/transfer-all-config.example.json`
**Used with command:** `transfer-all`

Use this when you want to migrate **all projects** from a SonarQube server to a **single** SonarCloud organization. This is simpler than the full `migrate` command — it only transfers project data (code, issues, metrics), not quality gates, profiles, groups, or permissions.

### Step-by-step setup

1. Copy the example file:

```bash
cp examples/transfer-all-config.example.json config.json
```

2. Open `config.json` and fill in your values:

```json
{
  "sonarqube": {
    "url": "https://your-sonarqube-server.com",
    "token": "sqp_your_sonarqube_token_here"
  },
  "sonarcloud": {
    "url": "https://sonarcloud.io",
    "token": "your_sonarcloud_token_here",
    "organization": "your-org"
  },
  "transfer": {
    "mode": "full",
    "stateFile": "./.cloudvoyager-state.json",
    "batchSize": 100
  },
  "transferAll": {
    "projectKeyPrefix": "",
    "projectKeyMapping": {
      "old-project-key": "new-project-key"
    },
    "excludeProjects": [
      "project-to-skip"
    ]
  }
}
```

### What each field means

The `sonarqube`, `sonarcloud`, and `transfer` sections are the same as Config File 1 (but note there's no `projectKey` since all projects are transferred).

The `transferAll` section is new:

| Field | What to put here |
|-------|-----------------|
| `projectKeyPrefix` | A prefix to add to all SonarQube project keys in SonarCloud. Leave empty (`""`) to keep the same keys. Example: `"myorg_"` turns `my-project` into `myorg_my-project` |
| `projectKeyMapping` | Rename specific projects during transfer. Example: `{"old-name": "new-name"}`. Leave as `{}` if you don't need to rename anything |
| `excludeProjects` | A list of SonarQube project keys to skip. Example: `["test-project", "archived-project"]`. Leave as `[]` to transfer everything |

### How to use it

```bash
# Dry run first to see what will be transferred
./cloudvoyager transfer-all -c config.json --verbose --dry-run

# Transfer all projects
./cloudvoyager transfer-all -c config.json --verbose
```

Or with npm scripts:

```bash
npm run transfer-all:dry-run
npm run transfer-all
```

---

## Config File 3: Full Organization Migration

**Example file:** `examples/migrate-config.example.json`
**Used with command:** `migrate`

Use this when you want to migrate **everything** — all projects, quality gates, quality profiles, user groups, permissions, portfolios, and more. This is the most comprehensive option and supports migrating to **multiple SonarCloud organizations** at once.

### Step-by-step setup

1. Copy the example file:

```bash
cp examples/migrate-config.example.json migrate-config.json
```

2. Open `migrate-config.json` and fill in your values:

```json
{
  "sonarqube": {
    "url": "https://your-sonarqube-server.com",
    "token": "sqp_your_sonarqube_admin_token"
  },
  "sonarcloud": {
    "organizations": [
      {
        "key": "org-one",
        "token": "your_sonarcloud_token_for_org_one",
        "url": "https://sonarcloud.io"
      },
      {
        "key": "org-two",
        "token": "your_sonarcloud_token_for_org_two",
        "url": "https://sonarcloud.io"
      }
    ]
  },
  "transfer": {
    "mode": "full",
    "batchSize": 100
  },
  "migrate": {
    "outputDir": "./migration-output",
    "skipIssueSync": false,
    "skipHotspotSync": false,
    "dryRun": false
  }
}
```

### What each field means

| Field | What to put here |
|-------|-----------------|
| `sonarqube.url` | Your SonarQube server URL |
| `sonarqube.token` | Your SonarQube admin token — needs admin access to extract all server-wide data |
| `sonarcloud.organizations` | A list of target SonarCloud organizations (see below) |
| `transfer.mode` | Use `"full"` for a complete migration |
| `transfer.batchSize` | Items per batch (default `100`) |
| `migrate.outputDir` | Where to save mapping CSVs and server info files |
| `migrate.skipIssueSync` | Set to `true` to skip syncing issue statuses, comments, and assignments |
| `migrate.skipHotspotSync` | Set to `true` to skip syncing hotspot statuses and comments |
| `migrate.dryRun` | Set to `true` to extract data and generate mappings without actually migrating |

**For each organization in the array:**

| Field | What to put here |
|-------|-----------------|
| `key` | The SonarCloud organization key (visible in the org URL) |
| `token` | A SonarCloud admin token for this specific organization |
| `url` | Usually `https://sonarcloud.io` (change only if using a staging instance) |

> **Migrating to just one org?** That's fine — just have a single entry in the `organizations` array. The tool uses DevOps platform bindings to automatically decide which projects go to which organization.

### How to use it

```bash
# Step 1: Do a dry run to review what will be migrated
./cloudvoyager migrate -c migrate-config.json --dry-run

# Step 2: Check the generated CSVs in ./migration-output/
#         Make sure the org assignments look correct

# Step 3: Run the full migration
./cloudvoyager migrate -c migrate-config.json --verbose
```

Or with npm scripts:

```bash
npm run migrate:dry-run       # Dry run only
npm run migrate               # Full migration
npm run migrate:skip-hotspots # Skip hotspot sync (the slowest part)
npm run migrate:skip-issues   # Skip issue sync
npm run migrate:minimal       # Skip both — just projects, gates, profiles, permissions
```

### What the flags do

| Flag | What it does | When to use it |
|------|-------------|----------------|
| `--verbose` | Show detailed progress logs | Always recommended — helps you monitor progress |
| `--dry-run` | Extract data and generate mapping CSVs without migrating | Use this first to review what will be migrated |
| `--skip-issue-sync` | Skip syncing issue statuses, comments, tags, assignments | When you don't need issue metadata or want a faster migration |
| `--skip-hotspot-sync` | Skip syncing hotspot statuses and comments | When hotspot sync is hitting rate limits or not needed |

---

## Which Config File Should I Use?

| I want to... | Use this config | Use this command |
|--------------|----------------|-----------------|
| Migrate one project | `config.json` | `transfer` |
| Migrate all projects (data only) | `config.json` with `transferAll` | `transfer-all` |
| Migrate everything (projects + config + permissions) | `migrate-config.json` | `migrate` |
| Just test my connections | `config.json` | `test` |
| Check my config file for errors | `config.json` | `validate` |

---

## Environment Variables

Instead of putting tokens directly in your config file, you can use environment variables:

```bash
export SONARQUBE_TOKEN="sqp_your_token_here"
export SONARCLOUD_TOKEN="your_sonarcloud_token_here"
```

When set, these override the `token` fields in your config file. Other useful variables:

| Variable | What it does |
|----------|-------------|
| `LOG_LEVEL` | Set log verbosity: `debug`, `info`, `warn`, or `error` |
| `LOG_FILE` | Save logs to a file (e.g. `./migration.log`) |
| `MAX_SOURCE_FILES` | Limit source files extracted per project (useful for testing — set to `10` for a quick test) |
