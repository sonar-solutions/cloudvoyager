# ☁️ 🐋 CloudVoyager

Migrate your data from self-hosted SonarQube to SonarCloud — no re-scanning needed.

CloudVoyager copies everything — projects, code issues, security hotspots, quality gates, quality profiles, permissions, and more — directly from SonarQube into SonarCloud.

## ✅ Quick Start (Recommended)

**Choose your scenario:**

| 🤔 Scenario | Click Below ⤵️ |
|----------|-------|
| Migrate **one project** from SonarQube to SonarCloud | [Single Project Migration](docs/scenario-single-project.md) |
| Migrate **everything** from SonarQube to **one** SonarCloud org | [Full Migration — Single Org](docs/scenario-single-org.md) |
| Migrate **everything** from SonarQube to **multiple** SonarCloud orgs | [Full Migration — Multiple Orgs](docs/scenario-multi-org.md) |

## 🔥 Single Command Full Migration (Slightly Dangerous)

1. Download the latest release of CloudVoyager from the [releases page]().
2. Ensure that you have full admin access API tokens for your SonarQube server and your SonarCloud organization.
3. Create the `migrate-config.json` file with the required information (see the [full migration docs](docs/scenario-single-org.md) for details).
4. Run the following command in your terminal:
```bash
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune
```
5. Once the migration finishes, review the `./migration-output` directory for any errors or warnings, and verify that your projects and data have been migrated successfully to SonarCloud.

## 📝 License

MIT
