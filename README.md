# ☁️ 🐋 CloudVoyager

<!-- Last updated: 2026-02-20 -->

Migrate your data from self-hosted SonarQube to SonarCloud — no re-scanning needed. This was done by reverse-engineering SonarScanner (scan report protobuf files) & then fully rebuilding everything from the ground up on Node.js.

CloudVoyager copies everything — projects, code issues, security hotspots, quality gates, quality profiles, permissions, and more — directly from SonarQube into SonarCloud.

<!-- Updated: 2026-02-20 -->
## ✅ Quick Start (Recommended)

**Choose your scenario:**

| 🤔 Scenario | Click Below ⤵️ |
|----------|-------|
| Migrate **one project** from SonarQube to SonarCloud | [Single Project Migration](docs/scenario-single-project.md) |
| Transfer **all projects** to one SonarCloud org (code + issues only) | [Transfer All Projects](docs/scenario-transfer-all.md) |
| Migrate **everything** from SonarQube to **one** SonarCloud org | [Full Migration — Single Org](docs/scenario-single-org.md) |
| Migrate **everything** from SonarQube to **multiple** SonarCloud orgs | [Full Migration — Multiple Orgs](docs/scenario-multi-org.md) |

<!-- Updated: 2026-02-20 -->
## 🔥 Single Command Full Migration (Slightly Dangerous)

1. Download the latest release of CloudVoyager from the [releases page](https://github.com/sonar-solutions/cloudvoyager/releases).
2. Ensure that you have full admin access API tokens for your SonarQube server and your SonarCloud organization.
3. Create the `migrate-config.json` file with the required information (see the [full migration docs](docs/scenario-single-org.md) for details).
4. Run the following command in your terminal:
```bash
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune
```
5. Once the migration finishes, review the `./migration-output` directory for any errors or warnings, and verify that your projects and data have been migrated successfully to SonarCloud.

<!-- Updated: 2026-02-20 -->
## 🛠️ Local Development

Want to build and test CloudVoyager locally? See the [Local Development Guide](docs/local-development.md) for step-by-step instructions.

<!-- Updated: 2026-02-20 -->
## 📝 License

MIT

<!--
## Change Log
| Date | Section | Change |
|------|---------|--------|
| 2026-02-20 | All | Initial section timestamps added |
-->
