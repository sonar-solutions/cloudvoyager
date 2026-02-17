# CloudVoyager

Migrate your data from self-hosted SonarQube to SonarCloud — no re-scanning needed.

## How It Works

This tool copies your projects, issues, metrics, and source code from SonarQube and uploads them to SonarCloud in the format it expects.

## Quick Start

### 1. Download

Download the latest binary for your platform from the [Releases](https://github.com/joshuaquek/cloudvoyager/releases) page:

| Platform | Binary |
|----------|--------|
| macOS (Apple Silicon) | `cloudvoyager-macos-arm64` |
| macOS (Intel) | `cloudvoyager-macos-x64` |
| Linux (x64) | `cloudvoyager-linux-x64` |
| Linux (ARM64) | `cloudvoyager-linux-arm64` |
| Windows (x64) | `cloudvoyager-win-x64.exe` |

Make the binary executable (macOS/Linux):

```bash
chmod +x cloudvoyager-*
```

### 2. Create a config file

You'll need API tokens from both SonarQube and SonarCloud - Ensure that you have **Admin Access** to both your SonarQube Server and SonarCloud organization, and that you have API tokens for both.

Create a `config.json` file with your details:

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

### 3. Test your connections

```bash
./cloudvoyager test -c config.json
```

### 4. Run the transfer

```bash
./cloudvoyager transfer -c config.json
```

That's it! Your data will appear in SonarCloud once the transfer completes.

## All Commands

| Command | What it does |
|---------|-------------|
| `test` | Check that both servers are reachable |
| `validate` | Check your config file for errors |
| `transfer` | Migrate a single project |
| `transfer-all` | Migrate all projects to a single SonarCloud org |
| `migrate` | Full migration to one or more SonarCloud organizations |
| `status` | See what's been synced so far |
| `reset` | Clear sync history and start fresh |

Add `--verbose` to any command for more detail.

```bash
./cloudvoyager transfer -c config.json --verbose
```

---

## Full Organization Migration (Single SonarQube Server to Multiple SonarCloud Organizations)

The `migrate` command performs a comprehensive migration of an entire SonarQube server to one or more SonarCloud organizations, including all projects, configuration, and metadata.

### What Gets Migrated

#### Projects & Project Configuration
- **Projects** — keys, names, metadata, visibility
- **Project issues** — all issues with assignments, comments, tags, and status (Open, Fixed, Accepted, etc.)
- **Project hotspots** — all security hotspots with status (Safe, Acknowledged, Fixed, To Review), assignments, and comments
- **Project settings** — non-inherited, project-level configuration values
- **Project tags** — custom tags assigned to projects
- **Project links** — external links configured on projects
- **New code definitions** — per-project and per-branch (`NUMBER_OF_DAYS` → `days`, `PREVIOUS_VERSION` → `previous_version`)
- **DevOps bindings** — GitHub, GitLab, Azure DevOps, Bitbucket integrations
- **Branches** — main branch plus all branch and pull request scans (issues & hotspots)
- **Monorepo configuration** — handled via branch-level DevOps bindings

#### Quality Gates
- Quality gate definitions (names, conditions, metrics)
- Default gate assignments per organization
- Project-to-gate associations
- Gate permissions (group and user-level)

#### Quality Profiles
- Quality profile definitions (name, language, parent relationships)
- Active and deactivated rules within each profile
- Profile restoration via backup/restore XML
- Default profile assignments per language
- Profile permissions (group and user-level)
- Parent profile inheritance chains

#### Users, Groups & Permissions
- All user group definitions
- Organization-level group permissions (admin, scan, etc.)
- Project-level group permissions (scanners, viewers, custom roles)
- Permission templates with group assignments
- Default template assignments

#### Portfolios
- Portfolio definitions (name, description, visibility)
- Portfolio project membership
- Portfolio branch labeling configuration

#### Server & Infrastructure Data (extracted for reference, not migrated)
- Server info (version, edition, metadata)
- Server settings
- Installed plugins and versions
- Webhooks (server and project-level)

### Migration Config

Create a `migrate-config.json` with multi-org support:

```json
{
  "sonarqube": {
    "url": "https://your-sonarqube-server.com",
    "token": "your_sonarqube_admin_token"
  },
  "sonarcloud": {
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
  "migrate": {
    "outputDir": "./migration-output",
    "skipIssueSync": false,
    "skipHotspotSync": false
  }
}
```

### Run the Migration

```bash
# Dry run — extract data and generate mapping CSVs without migrating
./cloudvoyager migrate -c migrate-config.json --dry-run

# Full migration
./cloudvoyager migrate -c migrate-config.json --verbose

# Skip issue/hotspot metadata sync for faster migration
./cloudvoyager migrate -c migrate-config.json --skip-issue-sync --skip-hotspot-sync
```

### Auto-Generated Mapping CSVs

The `migrate` command generates organizational mapping files in the output directory:

| File | Contents |
|------|----------|
| `organizations.csv` | Projects grouped by DevOps binding → target org |
| `projects.csv` | All projects with metadata for migration planning |
| `group-mappings.csv` | Groups mapped to target organizations |
| `profile-mappings.csv` | Quality profiles mapped to target organizations |
| `gate-mappings.csv` | Quality gates mapped to target organizations |
| `portfolio-mappings.csv` | Portfolios mapped to target organizations |
| `template-mappings.csv` | Permission templates mapped to target organizations |

Use `--dry-run` to generate these mappings for review before executing the full migration.

### Server Info Output

Server and infrastructure data is saved to `{outputDir}/server-info/` as JSON files for reference:
- `system.json` — server version, edition, status
- `plugins.json` — installed plugins and versions
- `settings.json` — server-level configuration
- `webhooks.json` — webhook configurations
- `alm-settings.json` — DevOps platform configurations

---

## Limitations
- Each project's past historical metrics (purely just historical metrics and not the actual issues itself), found in each project's **Activity** tab in the SonarQube Dashboard Web UI, cannot be migrated.


## Further Reading

- [Configuration Guide](docs/configuration.md) — all config options, env vars, incremental transfers
- [Architecture](docs/architecture.md) — project structure, data flow, report format
- [Technical Details](docs/technical-details.md) — protobuf encoding, measure types, active rules
- [Troubleshooting](docs/troubleshooting.md) — common errors and fixes

## License

MIT
