# Easy Local Development Guide

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Welcome to CloudVoyager! This guide walks you through setting up and running CloudVoyager on your local machine. No prior experience with SonarQube Server or SonarQube Cloud is required — just follow the steps below.

---

## What is CloudVoyager?

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

CloudVoyager is a command-line tool that migrates projects from **SonarQube Server** (self-hosted) to **SonarQube Cloud** (cloud-hosted). It transfers source code, quality gates, quality profiles, permissions, and more.

**In plain English:** It copies your code analysis data from your own server to the cloud, saving you from doing it manually.

---

## Prerequisites

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Before you start, make sure you have the following installed:

| Requirement | Version | Why it matters |
|-------------|---------|----------------|
| Node.js | v18+ (for running from source) | Runs the JavaScript code |
| Node.js | **v20 LTS** (for building binaries) | Required only for `npm run package` |
| npm | Latest | Comes with Node.js |
| Git | Any recent version | Clones the repository |

**Important:** Node.js v22+ does NOT work for building binaries. If you have v22+, switch to v20 using `nvm` (see below).

### Installing Node.js Version Manager (nvm)

If you need to switch Node.js versions, install `nvm`:

```bash
# Install nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart your terminal or run:
source ~/.bashrc  # or ~/.zshrc
```

### Switching to Node.js v20

```bash
nvm install 20
nvm use 20

# Verify you're on v20
node --version
# Expected output: v20.x.x
```

---

## Step 1: Clone and Install

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

First, clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/sonar-solutions/cloudvoyager.git
cd cloudvoyager

# Install dependencies
npm install
```

**Expected output:**
```
added 312 packages in 5s
```

---

## Step 2: Build the Binary

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

CloudVoyager runs as a standalone binary — not directly from source code. Build it with:

```bash
# Make sure you're on Node.js v20
nvm use 20

# Build the binary for your current platform
npm run package
```

**What happens during build:**
1. Bundles all JavaScript into `dist/cli.cjs`
2. Creates a Node.js Single Executable Application (SEA)
3. Injects the bundle into the Node.js binary
4. On macOS: re-signs the binary for your platform

**Expected output:**
```
> cloudvoyager@1.x.x package
> node scripts/build.js --package

Building cloudvoyager for macOS ARM64...
Build complete: dist/bin/cloudvoyager-macos-arm64
```

### Build Output Locations

After building, your binary is at:

| Your Platform | Binary Location |
|---------------|-----------------|
| macOS ARM64 (Apple Silicon) | `dist/bin/cloudvoyager-macos-arm64` |
| macOS x64 (Intel) | `dist/bin/cloudvoyager-macos-x64` |
| Linux x64 | `dist/bin/cloudvoyager-linux-x64` |
| Linux ARM64 | `dist/bin/cloudvoyager-linux-arm64` |
| Windows x64 | `dist/bin/cloudvoyager-win-x64.exe` |

---

## Step 3: Make it Executable (macOS/Linux)

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

On macOS and Linux, make the binary executable:

```bash
chmod +x dist/bin/cloudvoyager-macos-arm64
```

---

## Step 4: Verify it Works

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Run the `--version` flag to confirm the binary works:

```bash
./dist/bin/cloudvoyager-macos-arm64 --version
```

**Expected output:**
```
CloudVoyager v1.x.x
```

---

## Step 5: Create a Configuration File

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

CloudVoyager needs a JSON configuration file that tells it:
- How to connect to your SonarQube Server (source)
- How to connect to your SonarQube Cloud organization (destination)
- Which projects to migrate

Create a file called `config.json` at the project root:

```json
{
  "source": {
    "sonarQube": {
      "url": "https://your-sonarqube.example.com",
      "token": "your-sonarqube-token"
    }
  },
  "target": {
    "sonarCloud": {
      "organization": "your-org-key",
      "token": "your-sonarcloud-token"
    }
  },
  "migration": {
    "projects": [
      {
        "sourceProjectKey": "your-sonarqube-project-key",
        "targetProjectKey": "your-sonarcloud-project-key"
      }
    ]
  }
}
```

**Where to find your tokens:**
- **SonarQube Server token:** Log in to SonarQube Server → My Account → Security → Generate Tokens
- **SonarQube Cloud token:** Log in to SonarQube Cloud → Account → Security → Generate Tokens

---

## Step 6: Validate Your Configuration

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Before running a migration, validate that your config file is correct:

```bash
./dist/bin/cloudvoyager-macos-arm64 validate -c config.json
```

**Expected output (success):**
```
Validating configuration...
Configuration is valid.
```

**Expected output (error):**
```
Validating configuration...
ERROR: Missing required field 'source.sonarQube.url'
```

---

## Step 7: Test Connections

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Test that CloudVoyager can connect to both SonarQube Server and SonarQube Cloud:

```bash
./dist/bin/cloudvoyager-macos-arm64 test -c config.json --verbose
```

**Expected output (success):**
```
Testing connections...
Source (SonarQube Server): Connected successfully
Target (SonarQube Cloud): Connected successfully
All connections verified.
```

---

## Quick Reference: Common Commands

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Here are the most common commands you'll use during development:

### Validate a config file
```bash
./cloudvoyager validate -c config.json
```

### Test connections
```bash
./cloudvoyager test -c config.json --verbose
```

### Transfer a single project
```bash
./cloudvoyager transfer -c config.json --verbose
```

### Migrate all projects (full migration)
```bash
./cloudvoyager migrate -c migrate-config.json --verbose
```

### Dry-run a migration (no changes made)
```bash
./cloudvoyager migrate -c migrate-config.json --verbose --dry-run
```

### Check sync status
```bash
./cloudvoyager status -c config.json
```

### Verify migration completeness
```bash
./cloudvoyager verify -c migrate-config.json --verbose
```

### Sync metadata only (issues + hotspots)
```bash
./cloudvoyager sync-metadata -c migrate-config.json --verbose
```

---

## Running from Source (Alternative)

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

If you want to run CloudVoyager directly from source without building a binary:

```bash
# Run directly with Node.js
npm start -- validate -c config.json

# Or run a specific command
node src/index.js test -c config.json --verbose
```

**Note:** Running from source is useful for development and debugging, but running the binary is recommended for production use because it ensures consistent behavior across environments.

---

## Running Tests

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Run the test suite to make sure everything works:

```bash
# Run tests with coverage report
npm test

# Run tests faster (no coverage)
npm run test:fast
```

**Expected output:**
```
t=0ms Test files: 52 files
t=1234ms File tests passed: 312 passed, 0 failed
```

---

## Linting

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Check for code style issues:

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

---

## Troubleshooting

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

### "postject: Multiple occurrences of sentinel found"

This means you're using Node.js v22+ to build. Switch to v20:

```bash
nvm use 20
npm run package
```

### "Connection refused" when testing

Check that:
1. Your SonarQube Server/SonarQube Cloud URLs are accessible from your network
2. Your tokens are valid and not expired
3. Your firewall allows outbound HTTPS (port 443)

### Binary won't run on macOS

Make sure it's executable:

```bash
chmod +x dist/bin/cloudvoyager-macos-arm64
```

Also check System Preferences → Security & Privacy if macOS blocks unsigned binaries.

---

## Environment Variables (Optional)

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

You can override config values using environment variables:

| Variable | What it does |
|----------|-------------|
| `LOG_LEVEL` | Set logging level: `debug`, `info`, `warn`, `error` |
| `LOG_FILE` | Path to log file (logs to console by default) |
| `SONARQUBE_TOKEN` | Override SonarQube Server token |
| `SONARCLOUD_TOKEN` | Override SonarQube Cloud token |
| `SONARQUBE_URL` | Override SonarQube Server URL |
| `SONARCLOUD_URL` | Override SonarQube Cloud URL |

**Example:**

```bash
LOG_LEVEL=debug SONARQUBE_TOKEN=sqp_xxx ./cloudvoyager test -c config.json
```

---

## Desktop App (Optional)

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

CloudVoyager also has a desktop GUI app. To run it:

```bash
cd desktop
npm install

# Copy the CLI binary into the app
node scripts/prepare-cli.js

# Launch the desktop app
npm start
```

The desktop app provides a wizard interface for configuring migrations without using the terminal.

---

## Next Steps

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Now that you have CloudVoyager running, check out these guides:

- [Configuration Reference](configuration.md) — All config options explained
- [Architecture](architecture.md) — How CloudVoyager works under the hood
- [Troubleshooting](troubleshooting.md) — Common errors and fixes
- [CLI Reference](#) — Full list of all commands and flags

---

**Last updated:** 2026-05-07
