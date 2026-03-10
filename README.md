# ☁️ 🐋 CloudVoyager

<!-- Last updated: 2026-03-10 -->

Migrate your data from self-hosted SonarQube to SonarCloud — no re-scanning needed. This was done by reverse-engineering SonarScanner (scan report protobuf files) & then fully rebuilding everything from the ground up on Node.js.

CloudVoyager copies everything — projects, code issues, security hotspots, quality gates, quality profiles, permissions, and more — directly from SonarQube into SonarCloud.

<!-- Updated: 2026-02-19 -->
## ✅ Quick Start (Recommended)

**Choose your scenario:**

| 🤔 Scenario | Click Below ⤵️ |
|----------|-------|
| Migrate **one project** from SonarQube to SonarCloud | [Single Project Migration](docs/scenario-single-project.md) |
| Migrate **everything** from SonarQube to **one** SonarCloud org | [Full Migration — Single Org](docs/scenario-single-org.md) |
| Migrate **everything** from SonarQube to **multiple** SonarCloud orgs | [Full Migration — Multiple Orgs](docs/scenario-multi-org.md) |

<!-- Updated: 2026-02-18 -->
## 🔥 Single Command Full Migration (Slightly Dangerous)

1. Download the latest release of CloudVoyager from the [releases page](https://github.com/sonar-solutions/cloudvoyager/releases).
2. Ensure that you have full admin access API tokens for your SonarQube server and your SonarCloud organization.
3. Create the `migrate-config.json` file with the required information (see the [full migration docs](docs/scenario-single-org.md) for details).
4. Run the following command in your terminal:
```bash
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune
```
5. Once the migration finishes, review the `./migration-output` directory for any errors or warnings.
6. Run the verification command to confirm everything was migrated correctly:
```bash
./cloudvoyager verify -c migrate-config.json --verbose
```

<!-- Updated: 2026-03-10 -->
## 🔄 Pause and Resume

All migrations support **automatic checkpointing**. Progress is saved after every phase (extract, build, encode, upload). If a migration is interrupted — whether by CTRL+C (graceful shutdown), a crash, or a network failure — simply re-run the same command to resume from where it left off. No data is lost or duplicated.

A **lock file** prevents concurrent runs against the same project, so you cannot accidentally start two migrations at once.

```bash
# Transfer was interrupted — just re-run to resume
./cloudvoyager transfer -c config.json --verbose

# Check progress without running
./cloudvoyager transfer -c config.json --show-progress

# Discard checkpoint and start the migration from scratch
./cloudvoyager transfer -c config.json --force-restart

# Re-extract data from SonarQube but keep other cached phases
./cloudvoyager transfer -c config.json --force-fresh-extract

# Clear a stale lock file (e.g. after a hard crash)
./cloudvoyager transfer -c config.json --force-unlock
```

See the [Configuration Reference](docs/configuration.md#checkpoint-settings) for checkpoint options (`transfer.checkpoint`).

<!-- Updated: 2026-03-09 -->
## 🔄 SonarQube Version Compatibility

CloudVoyager automatically detects the SonarQube server version and adapts its API calls accordingly. No special configuration is needed.

| SonarQube Version | Support Level | Notes |
|-------------------|--------------|-------|
| **9.9 LTS** | Full | Clean Code taxonomy enriched from SonarCloud |
| **10.0 – 10.3** | Full | Native Clean Code taxonomy |
| **10.4 – 10.8** | Full | Modern issue status API |
| **2025.1+** | Full | Modern issue status API, V2 API fallbacks |

See [Backward Compatibility](docs/backward-compatibility.md) for technical details on how version differences are handled.

<!-- Updated: 2026-02-19 -->
## 🛠️ Local Development

Want to build and test CloudVoyager locally? See the [Local Development Guide](docs/local-development.md) for step-by-step instructions.

<!-- Updated: 2026-02-25 -->
## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Key Capabilities](docs/key-capabilities.md) | Comprehensive overview of engineering, architecture, and capabilities |
| [Architecture](docs/architecture.md) | Project structure, data flow, and report format |
| [Configuration Reference](docs/configuration.md) | All config options, environment variables, and npm scripts |
| [Technical Details](docs/technical-details.md) | Protobuf encoding, measure types, concurrency model |
| [Troubleshooting](docs/troubleshooting.md) | Common errors and how to fix them |
| [Dry-Run CSV Reference](docs/dry-run-csv-reference.md) | CSV schema documentation for the dry-run workflow (including user mapping) |
| [Backward Compatibility](docs/backward-compatibility.md) | SonarQube version support (9.9 LTS through 2025.1+) |
| [Contributing](CONTRIBUTING.md) | Architectural patterns, conventions, and contribution guidelines |
| [Changelog](docs/CHANGELOG.md) | Release history and notable changes |

<!-- Updated: 2026-02-17 -->
## 📝 License

MIT

<!--
## Change Log
| Date | Section | Change |
|------|---------|--------|
| 2026-02-28 | Single Command Migration | Added verify step |
| 2026-02-19 | Quick Start, Local Dev | Links to scenario and local dev docs |
| 2026-02-18 | Single Command Migration | Migrate command with --auto-tune |
| 2026-02-17 | License | MIT license added |
| 2026-02-16 | All | Initial README |
-->
