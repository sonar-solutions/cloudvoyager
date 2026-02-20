# 📦 Transfer All Projects to One SonarCloud Organization

<!-- Last updated: 2026-02-20 -->

Use this when you want to transfer **all projects** from SonarQube to a **single** SonarCloud organization, without migrating org-level configuration like quality gates, profiles, groups, or permissions.

This is a lightweight alternative to the full `migrate` command — it loops through every SonarQube project and runs the single-project transfer pipeline for each one.

> **Need quality gates, profiles, groups, and permissions too?** Use the [Full Migration — Single Org](scenario-single-org.md) guide instead, which uses the `migrate` command.

---

<!-- Updated: 2026-02-20 -->
## 📦 What Gets Transferred

| Category | Included |
|----------|----------|
| **Source code** | Yes — all files are packaged into the scanner report |
| **Issues** | Yes — all code issues with text ranges, flows, and metadata |
| **Security hotspots** | Yes — all hotspots with status and comments |
| **Metrics & measures** | Yes — all project and component-level measures |
| **SCM changesets** | Yes — per-file changeset info (author, date, revision) |
| **Active rules** | Yes — quality profile rules filtered by languages used in each project |

<!-- Updated: 2026-02-20 -->
### What is NOT transferred

| Category | Why |
|----------|-----|
| Quality gates | Use `migrate` command for these |
| Quality profiles | Use `migrate` command for these |
| Groups & permissions | Use `migrate` command for these |
| Portfolios | Use `migrate` command for these |
| Project settings, tags, links | Use `migrate` command for these |
| DevOps bindings | Use `migrate` command for these |
| Historical metrics (Activity tab) | Cannot be migrated — only trend data is lost |

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

Create a file called `config.json`:

```json
{
  "sonarqube": {
    "url": "https://your-sonarqube-server.com",
    "token": "your_sonarqube_token"
  },
  "sonarcloud": {
    "url": "https://sonarcloud.io",
    "token": "your_sonarcloud_token",
    "organization": "your-org"
  },
  "transfer": {
    "mode": "full",
    "batchSize": 100
  }
}
```

See [`examples/transfer-all-config.example.json`](../examples/transfer-all-config.example.json) for a ready-to-use template with all optional fields.

<!-- Updated: 2026-02-20 -->
### Config fields

| Field | Required | Description |
|-------|----------|-------------|
| `sonarqube.url` | Yes | Full URL of your SonarQube server |
| `sonarqube.token` | Yes | SonarQube API token (starts with `sqp_` on newer versions) |
| `sonarcloud.url` | No | SonarCloud URL (default: `https://sonarcloud.io`) |
| `sonarcloud.token` | Yes | SonarCloud API token |
| `sonarcloud.organization` | Yes | SonarCloud organization key |

> **Tip:** You can set tokens via environment variables (`SONARQUBE_TOKEN` and `SONARCLOUD_TOKEN`) instead of putting them in the config file.

<!-- Updated: 2026-02-20 -->
### Optional: Transfer-all settings

Add a `transferAll` section to control project key mapping and exclusions:

```json
{
  "transferAll": {
    "projectKeyPrefix": "",
    "projectKeyMapping": {
      "old-project-key": "new-project-key"
    },
    "excludeProjects": ["project-to-skip"]
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `projectKeyPrefix` | `""` | Prefix to prepend to all SonarQube project keys on SonarCloud |
| `projectKeyMapping` | `{}` | Explicit mapping from SonarQube key to SonarCloud key for specific projects |
| `excludeProjects` | `[]` | SonarQube project keys to skip |

<!-- Updated: 2026-02-20 -->
## 🧪 Step 3: Test your connections

```bash
./cloudvoyager test -c config.json
```

You should see a success message for both SonarQube and SonarCloud. If not, double-check your URLs and tokens.

<!-- Updated: 2026-02-20 -->
## 🔍 Step 4: Dry run (recommended)

Run a dry run first to see which projects will be transferred without actually doing anything:

```bash
./cloudvoyager transfer-all -c config.json --verbose --dry-run
```

Review the output to make sure the project list and key mappings look correct.

<!-- Updated: 2026-02-20 -->
## 🚀 Step 5: Run the transfer

```bash
./cloudvoyager transfer-all -c config.json --verbose
```

The tool discovers all projects on your SonarQube server, applies any exclusions and key mappings, and transfers each one to SonarCloud.

> **Tip:** Add `--wait` if you want the command to block until each project's analysis completes on SonarCloud.

---

<!-- Updated: 2026-02-20 -->
## ⚡ Speed up the transfer (optional)

For large numbers of projects, use `--auto-tune` to automatically detect your hardware and set optimal performance values:

```bash
./cloudvoyager transfer-all -c config.json --verbose --auto-tune
```

Or manually set specific values:

```bash
./cloudvoyager transfer-all -c config.json --verbose --concurrency 50 --project-concurrency 4 --max-memory 8192
```

See the [Configuration Reference](configuration.md#performance-settings) for all options.

---

<!-- Updated: 2026-02-20 -->
## 🚩 All CLI Flags

| Flag | What it does |
|------|-------------|
| `--verbose` | Show detailed progress logs |
| `--dry-run` | List projects that would be transferred without transferring |
| `--auto-tune` | Auto-detect CPU and RAM and set optimal performance values |
| `--concurrency <n>` | Override max concurrency for I/O operations |
| `--project-concurrency <n>` | Max concurrent project transfers |
| `--max-memory <mb>` | Set max heap size in MB |
| `--wait` | Wait for analysis to complete before returning (default: does not wait) |

---

<!-- Updated: 2026-02-20 -->
## ⚠️ Limitations

- **No org-level config** — quality gates, profiles, groups, permissions, portfolios, and project settings are not transferred. Use the [`migrate` command](scenario-single-org.md) if you need these.
- **Historical metrics** (the charts in each project's **Activity** tab in SonarQube) cannot be migrated. All actual issues and hotspots are migrated — only the historical trend data is lost.

---

<!-- Updated: 2026-02-20 -->
## 📚 Further Reading

- [Full Migration — Single Org](scenario-single-org.md) — migrate everything including quality gates, profiles, groups, and permissions
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
