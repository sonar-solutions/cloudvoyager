# 📦 Migrate a Single Project

Use this when you want to migrate **one specific project** from SonarQube to SonarCloud.

This transfers the project's code, issues, hotspots, and metrics. It does **not** migrate org-level settings like quality gates, quality profiles, groups, or permissions — for that, see [Migrate Everything to One Org](scenario-single-org.md).

---

## ✅ Prerequisites

1. **Admin access** to your SonarQube server
2. **Admin access** to your SonarCloud organization
3. **API tokens** for both SonarQube and SonarCloud

> **How to get your tokens:**
> - **SonarQube:** Go to `My Account > Security > Generate Tokens` in your SonarQube web UI
> - **SonarCloud:** Go to `My Account > Security > Generate Tokens` at [sonarcloud.io](https://sonarcloud.io)

---

## 📥 Step 1: Download

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

## 📝 Step 2: Create a config file

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

> **Where to find your project key:** In SonarQube, go to your project's **Project Information** page — the key is shown there. You can use the same key for SonarCloud, or choose a new one.

See [`examples/config.example.json`](../examples/config.example.json) for a ready-to-use template with all optional fields (rate limiting, performance tuning, etc.).

### Config fields

| Field | Required | Description |
|-------|----------|-------------|
| `sonarqube.url` | Yes | Full URL of your SonarQube server |
| `sonarqube.token` | Yes | SonarQube API token (starts with `sqp_` on newer versions) |
| `sonarqube.projectKey` | Yes (for `transfer`) | Project key in SonarQube |
| `sonarcloud.url` | No | SonarCloud URL (default: `https://sonarcloud.io`) |
| `sonarcloud.token` | Yes | SonarCloud API token |
| `sonarcloud.organization` | Yes | SonarCloud organization key |
| `sonarcloud.projectKey` | Yes (for `transfer`) | Project key to use in SonarCloud |

> **Tip:** You can set tokens via environment variables (`SONARQUBE_TOKEN` and `SONARCLOUD_TOKEN`) instead of putting them in the config file.

### Optional: Transfer settings

Add a `transfer` section to control incremental mode and batch size:

```json
{
  "transfer": {
    "mode": "incremental",
    "stateFile": "./.cloudvoyager-state.json",
    "batchSize": 100
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `mode` | `incremental` | `"full"` to transfer everything, or `"incremental"` to only sync changes since last run |
| `stateFile` | `./.cloudvoyager-state.json` | Where to save sync progress |
| `batchSize` | `100` | Items per batch (1–500) |

## 🧪 Step 3: Test your connections

```bash
./cloudvoyager test -c config.json
```

You should see a success message for both SonarQube and SonarCloud. If not, double-check your URLs and tokens.

## 🚀 Step 4: Run the transfer

```bash
./cloudvoyager transfer -c config.json --verbose
```

That's it! The tool uploads the report and returns immediately — it does not wait for SonarCloud to finish processing. Your project data will appear in SonarCloud once the analysis completes in the background.

> **Tip:** If you want the command to block until SonarCloud finishes processing, add `--wait`.

---

## 🔧 Other useful commands

```bash
# Validate your config file
./cloudvoyager validate -c config.json

# Check what's been synced
./cloudvoyager status -c config.json

# Clear sync history and start fresh
./cloudvoyager reset -c config.json
```

---

## ⚡ Speed up the transfer (optional)

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

## 🚩 All CLI Flags

| Flag | What it does |
|------|-------------|
| `--verbose` | Show detailed progress logs |
| `--auto-tune` | Auto-detect CPU and RAM and set optimal performance values |
| `--concurrency <n>` | Override max concurrency for I/O operations |
| `--max-memory <mb>` | Set max heap size in MB |
| `--wait` | Wait for analysis to complete before returning (default: does not wait) |

---

## ⚠️ Limitations

- Historical metrics (the charts in each project's **Activity** tab in SonarQube) cannot be migrated. All actual issues and hotspots are migrated — only the historical trend data is lost.

---

## 📚 Further Reading

- [Configuration Reference](configuration.md) — all config options, environment variables, npm scripts
- [Architecture](architecture.md) — project structure, data flow, report format
- [Technical Details](technical-details.md) — protobuf encoding, measure types, active rules
- [Troubleshooting](troubleshooting.md) — common errors and how to fix them
