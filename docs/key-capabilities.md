# CloudVoyager — Key Capabilities

A comprehensive overview of CloudVoyager's engineering, architecture, and capabilities for techno-functional leadership review.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Core Innovation: Reverse-Engineered Scanner Protocol](#2-the-core-innovation-reverse-engineered-scanner-protocol)
3. [Exhaustive SonarQube Data Extraction](#3-exhaustive-sonarqube-data-extraction)
4. [Protobuf Report Encoding Engine](#4-protobuf-report-encoding-engine)
5. [SonarCloud Integration and Upload](#5-sonarcloud-integration-and-upload)
6. [Full Organization Migration Pipeline](#6-full-organization-migration-pipeline)
7. [Issue and Hotspot Metadata Synchronization](#7-issue-and-hotspot-metadata-synchronization)
8. [Quality Profile and Quality Gate Migration](#8-quality-profile-and-quality-gate-migration)
9. [Permissions, Groups, and Governance Migration](#9-permissions-groups-and-governance-migration)
10. [Multi-Organization Mapping and DevOps Binding Awareness](#10-multi-organization-mapping-and-devops-binding-awareness)
11. [Concurrency Engine and Performance Optimization](#11-concurrency-engine-and-performance-optimization)
12. [Auto-Tuning and Adaptive Resource Management](#12-auto-tuning-and-adaptive-resource-management)
13. [Single Executable Application (SEA) Binary](#13-single-executable-application-sea-binary)
14. [Build Pipeline Optimizations](#14-build-pipeline-optimizations)
15. [Rate Limiting and API Resilience](#15-rate-limiting-and-api-resilience)
16. [Incremental and Stateful Transfers](#16-incremental-and-stateful-transfers)
17. [Comprehensive Reporting Suite](#17-comprehensive-reporting-suite)
18. [Configuration System and Schema Validation](#18-configuration-system-and-schema-validation)
19. [CLI Design and Operational Modes](#19-cli-design-and-operational-modes)
20. [Error Handling Architecture](#20-error-handling-architecture)
21. [Engineering Summary](#21-engineering-summary)

---

## 1. Executive Summary

CloudVoyager is a CLI tool that migrates complete SonarQube installations to SonarCloud **without requiring a single line of code to be re-scanned**. It achieves this by reverse-engineering SonarScanner's internal protobuf report protocol and rebuilding the entire data pipeline from the ground up in Node.js.

Where existing migration approaches require re-running CI/CD scanners against every project (a process that can take days or weeks across large portfolios), CloudVoyager extracts all data directly from SonarQube's API and repackages it into the exact binary format that SonarCloud's Compute Engine expects. The result is a migration that preserves code issues, security hotspots, measures, quality gates, quality profiles, permissions, and project metadata — all in a fraction of the time.

**Key metrics from production use:**
- 29 out of 29 projects migrated successfully in a single run (~16 minutes)
- 53 quality profiles migrated, 2 groups created
- 12+ distinct resource types migrated per organization (quality gates, profiles, permissions, templates, portfolios, groups, settings, tags, links, bindings, new code periods, webhooks)
- 6 platform binaries built from a single codebase (macOS ARM64/x64, Linux ARM64/x64, Windows x64/ARM64)

---

## 2. The Core Innovation: Reverse-Engineered Scanner Protocol

### The Problem

SonarCloud's ingestion pipeline is not designed for external data import. It accepts data exclusively through a proprietary protobuf-based scanner report format, submitted to an internal Compute Engine (CE) endpoint. This format is undocumented for external consumers. There is no official migration path from SonarQube to SonarCloud that preserves historical data without re-scanning.

### The Approach

CloudVoyager reverse-engineered the scanner report protocol by:

1. **Capturing real scanner reports** — Running SonarScanner against known projects and intercepting the `.scannerwork/scanner-report/` output directory before submission.
2. **Decoding the protobuf schema** — Analyzing the `.pb` binary files to reconstruct the Protocol Buffer message definitions, including metadata, component structures, issue formats, measure encodings, active rule definitions, and changeset formats.
3. **Identifying encoding conventions** — Discovering that the report uses two distinct encoding styles:
   - **Single-message encoding** for metadata, components, and changesets (one protobuf message per file)
   - **Length-delimited streaming** for issues, measures, and active rules (multiple messages concatenated with varint length prefixes)
4. **Mapping the ZIP archive structure** — Reconstructing the exact file naming conventions (`metadata.pb`, `component-{ref}.pb`, `issues-{ref}.pb`, `measures-{ref}.pb`, `source-{ref}.txt`, `activerules.pb`, `changesets-{ref}.pb`, `context-props.pb`) expected by SonarCloud's CE endpoint.
5. **Rebuilding the pipeline in Node.js** — Implementing the entire encode-and-submit pipeline using `protobufjs`, with the proto schemas inlined directly into the bundle so no external schema files are needed at runtime.

### Why This Matters

This is a novel capability. No other tool reconstructs SonarScanner's internal binary protocol to inject data into SonarCloud. The approach bypasses the need for source code access entirely — CloudVoyager needs only API-level access to SonarQube to produce a report that SonarCloud treats as a legitimate scanner submission.

---

## 3. Exhaustive SonarQube Data Extraction

CloudVoyager includes **24 specialized extractor modules** covering every category of data available through SonarQube's REST API. The extraction system is designed to be both exhaustive and resilient — server-wide extraction continues even if individual items fail.

### Code and Analysis Data

| Extractor | Data Extracted | API Endpoints |
|-----------|---------------|---------------|
| **Projects** | Project metadata, name, key, visibility | `/api/projects/search` |
| **Issues** | All code issues with full pagination, text ranges, flows, comments, tags | `/api/issues/search` |
| **Hotspots** | Security hotspots with status, resolution, review comments | `/api/hotspots/search`, `/api/hotspots/show` |
| **Measures** | Project and component-level metrics (coverage, complexity, duplications, etc.) | `/api/measures/component_tree` |
| **Metrics** | Metric definitions (keys, types, domains, descriptions) | `/api/metrics/search` |
| **Sources** | Full source code files with language metadata | `/api/sources/raw` |
| **Changesets** | SCM blame/changeset data per file (author, date, revision) | `/api/sources/scm` |
| **Active Rules** | Rules from quality profiles, filtered to languages in use, with severity/impact mapping | `/api/rules/search` |
| **Symbols** | Symbol reference tables per file | `/api/sources/symbols` (internal) |
| **Syntax Highlighting** | Syntax highlighting metadata per file | `/api/sources/syntax_highlighting` (internal) |

### Quality Management Data

| Extractor | Data Extracted | API Endpoints |
|-----------|---------------|---------------|
| **Quality Gates** | Gate definitions, conditions (metric + operator + threshold), permissions, project assignments | `/api/qualitygates/list`, `/api/qualitygates/show` |
| **Quality Profiles** | Profile definitions, backup XML (all rule configs + severity overrides + parameter values), inheritance chains, user/group permissions | `/api/qualityprofiles/search`, `/api/qualityprofiles/backup` |
| **Rules** | Active rule details with language detection, severity mapping, and Clean Code impact extraction | `/api/rules/search` |

### Administration and Governance Data

| Extractor | Data Extracted | API Endpoints |
|-----------|---------------|---------------|
| **Permissions** | Global permissions, project-level permissions, permission templates with group assignments | `/api/permissions/groups`, `/api/permissions/search_templates` |
| **Groups** | User group definitions with names and descriptions | `/api/user_groups/search` |
| **Portfolios** | Portfolio definitions, project associations, hierarchy | `/api/views/list` |
| **Project Settings** | Non-inherited project-level configuration values | `/api/settings/values` |
| **Project Tags** | Custom project tags | `/api/project_tags/search` |
| **Project Links** | External project links (CI, docs, issue tracker) | `/api/project_links/search` |
| **New Code Periods** | New code period definitions per project and branch | `/api/new_code_periods/list` |
| **DevOps Bindings** | ALM/DevOps platform settings and per-project bindings (GitHub, GitLab, Azure, Bitbucket) | `/api/alm_settings/list_definitions`, `/api/alm_settings/list` |
| **Server Info** | Server version, installed plugins, server-level settings, global webhooks | `/api/system/info`, `/api/plugins/installed`, `/api/settings/values`, `/api/webhooks/list` |
| **Webhooks** | Project-level webhook configurations | `/api/webhooks/list` |

### Pagination Handling

The SonarQube API client handles pagination transparently via a `getPaginated` method that auto-fetches all pages and concatenates results. Different endpoints enforce different page size limits (some cap at 100 instead of 500), and each extractor handles this automatically.

---

## 4. Protobuf Report Encoding Engine

### Two-Phase Encoding Architecture

CloudVoyager uses a **builder-encoder** architecture that separates message construction from binary serialization:

1. **Builder phase** (`builder.js`, `build-components.js`, `build-issues.js`, `build-measures.js`) — Transforms extracted SonarQube data into structured JavaScript objects matching the protobuf schema. Manages component reference mapping (sequential integer IDs) to maintain relationships between files, issues, and measures.

2. **Encoder phase** (`encoder.js`) — Takes the built messages and serializes them to binary protobuf format using `protobufjs`. Handles both single-message and length-delimited encoding styles.

### Proto Schema Inlining

The `.proto` schema files are loaded as inline text at build time (via esbuild's `.proto: 'text'` loader), eliminating any dependency on external schema files at runtime. This means the standalone binary is entirely self-contained — no `.proto` files need to ship alongside it.

### Encoding Methods

| Method | Encoding Style | Used For |
|--------|---------------|----------|
| `encodeMetadata()` | Single message | Analysis metadata with SCM revision, org, branch info |
| `encodeComponent()` | Single message | Component definitions (project root, files) |
| `encodeIssueDelimited()` | Length-delimited stream | Issues with text ranges, flows, severity |
| `encodeMeasureDelimited()` | Length-delimited stream | Typed metric values (int, double, string) |
| `encodeActiveRuleDelimited()` | Length-delimited stream | Quality profile rules filtered by language |
| `encodeChangeset()` | Single message | SCM blame data per file |

### Flat Component Model

Components use a flat structure where all files are direct children of the project root (no intermediate directory components). Line counts are derived from actual source file content rather than SonarQube's measures API, ensuring accuracy.

### Measure Type Intelligence

Measures are encoded with the correct typed value field based on metric type:
- **Integer metrics** (`intValue`): `ncloc`, `complexity`, `violations`, `functions`, `classes`, etc.
- **Float/percentage metrics** (`doubleValue`): `coverage`, `duplicated_lines_density`, ratings
- **String metrics** (`stringValue`): `executable_lines_data`, `ncloc_data`, `alert_status`

### Active Rule Optimization

Active rules are filtered to only include languages actually used in the project, resulting in approximately **84% reduction in payload size** compared to including all rules from all profiles.

---

## 5. SonarCloud Integration and Upload

### Report Packaging

The `ReportUploader` assembles the encoded protobuf messages into a ZIP archive that exactly matches SonarScanner's submission format:

```
scanner-report.zip
├── metadata.pb            # Analysis metadata with SCM revision
├── activerules.pb         # Language-filtered quality profile rules
├── context-props.pb       # SCM and CI detection metadata
├── component-{ref}.pb     # Component definitions (one per file)
├── issues-{ref}.pb        # Code issues per component
├── measures-{ref}.pb      # Metrics per component
├── changesets-{ref}.pb    # SCM blame per component
└── source-{ref}.txt       # Source code files (plain text)
```

### Compute Engine Submission

The report is submitted to SonarCloud's CE endpoint as a multipart form upload with:
- The ZIP archive as the report payload
- Project key and organization context
- Optional analysis parameters

### Duplicate Detection via SCM Revision

Each report includes an `scm_revision_id` (git commit hash) in its metadata. SonarCloud uses this to detect and reject duplicate submissions, preventing accidental data duplication across multiple migration runs.

### Branch Name Resolution

The tool resolves the main branch name from SonarCloud (not SonarQube) to avoid mismatches where SonarQube uses "main" but SonarCloud expects "master" or vice versa.

### Analysis Wait Mode

The `--wait` flag causes the tool to poll SonarCloud's CE task queue until the uploaded report has been fully analyzed. This is useful for CI/CD integration or sequential migration workflows where downstream steps depend on analysis completion.

---

## 6. Full Organization Migration Pipeline

The `migrate` command orchestrates a comprehensive, multi-stage pipeline that transfers an entire SonarQube installation — not just code, but all organizational configuration.

### Pipeline Stages

```
1. Configuration Load and Validation
   ↓
2. Output Directory Initialization
   ↓
3. SonarQube Connection Verification
   ↓
4. Full Project Discovery
   ↓
5. Server-Wide Data Extraction (parallel, non-fatal)
   ├── Quality Gates        ├── Permission Templates
   ├── Quality Profiles     ├── Portfolios
   ├── Groups               ├── DevOps Bindings
   ├── Permissions          └── Server Info (plugins, webhooks, settings)
   ↓
6. Organization Mapping Generation (by DevOps binding)
   ↓
7. Server Info Reference File Export
   ↓
8. Per-Organization Migration Loop
   ├── Create groups
   ├── Set global permissions
   ├── Create quality gates with conditions
   ├── Restore quality profiles via backup XML
   ├── Generate quality profile diff reports
   ├── Create permission templates
   └── For Each Project:
       ├── Resolve globally unique project key
       ├── Upload scanner report (full transfer pipeline)
       ├── Sync issue metadata (status, assignments, comments, tags)
       ├── Sync hotspot metadata (status, comments)
       ├── Apply project settings, tags, links, new code periods
       ├── Set DevOps binding
       ├── Assign quality gate
       ├── Assign migrated quality profiles
       ├── Set project-level permissions
       └── Create portfolios and assign projects
   ↓
9. Migration Report Generation (JSON, TXT, MD, PDF)
```

### Non-Fatal Extraction Design

Server-wide extraction wraps each item in a non-fatal handler. If extracting quality gates succeeds but portfolio extraction fails, the pipeline continues — the failure is logged and reported, but does not block the rest of the migration.

### Dry-Run Mode

The `--dry-run` flag executes all extraction and mapping steps but stops before making any changes to SonarCloud. This allows teams to:
- Review the generated organization mapping CSVs
- Validate that all SonarQube data is accessible
- Verify project key resolution without side effects

---

## 7. Issue and Hotspot Metadata Synchronization

After uploading the scanner report (which creates issues in SonarCloud with default "Open" status), CloudVoyager synchronizes the full lifecycle metadata from SonarQube.

### Issue Sync

For each issue in SonarQube, the sync engine:

1. **Matches** the corresponding SonarCloud issue by composite key: `rule + component + line number`
2. **Transitions** the status using SonarCloud's workflow API:
   - `CONFIRMED` → `confirm`
   - `RESOLVED` → `resolve`
   - `ACCEPTED` → `accept`
   - `FALSE-POSITIVE` → `wontfix` (false positive)
   - `WONTFIX` → `wontfix`
3. **Assigns** the issue to the same user (if the user exists in SonarCloud)
4. **Copies comments** from SonarQube to SonarCloud
5. **Sets tags** to match the SonarQube tags

When multiple SonarCloud issues match the same composite key, the engine uses a first-unmatched-candidate strategy to avoid double-assignment.

### Hotspot Sync

Security hotspots follow a similar pattern:

1. **Matches** by `rule + component + line number`
2. **Transitions** status: `TO_REVIEW` → `REVIEWED` with the appropriate resolution (`SAFE`, `FIXED`, `ACKNOWLEDGED`)
3. **Copies** review comments

### Standalone Metadata Sync

The `sync-metadata` command allows metadata synchronization to be run independently of the transfer pipeline. This is useful for:
- Retrying after rate-limit interruptions
- Syncing metadata for projects that were transferred in a previous run
- Running issue sync and hotspot sync selectively (`--skip-issue-metadata-sync`, `--skip-hotspot-metadata-sync`)

The operation is **idempotent** — running it multiple times will not duplicate comments or re-apply transitions.

---

## 8. Quality Profile and Quality Gate Migration

### Quality Profile Migration

Quality profiles are migrated using SonarQube's **backup/restore XML format**, which preserves:
- All rule activations and deactivations
- Severity overrides
- Rule parameter values
- Language-specific configurations

**Built-in profile handling** is a noteworthy engineering detail. SonarCloud's built-in profiles (e.g., "Sonar way") cannot be overwritten. CloudVoyager handles this by:
1. Extracting the built-in profile's backup XML from SonarQube
2. Restoring it as a **custom profile** with a `(SonarQube Migrated)` suffix
3. Automatically assigning the migrated custom profile to each project

This ensures that the exact same rules are active in SonarCloud as they were in SonarQube, even when the built-in profiles have diverged between versions.

**Inheritance chains** are preserved by restoring profiles in dependency order — parent profiles are restored before their children.

### Quality Profile Diff Reports

After migration, a side-by-side comparison report is generated per language:
- **Missing rules**: Active in SonarQube but not available in SonarCloud (may cause fewer issues to be detected)
- **Added rules**: Available in SonarCloud but not in SonarQube (may create new issues)

This enables teams to review rule parity before going live.

### Quality Gate Migration

Quality gates are created with their full condition definitions (metric, operator, error threshold). Gate permissions are migrated for custom gates, and project assignments are applied per the organization mapping. Built-in gates are skipped since SonarCloud provides its own defaults.

---

## 9. Permissions, Groups, and Governance Migration

### Group Migration

User groups are extracted from SonarQube and recreated in each target SonarCloud organization with matching names and descriptions.

### Permission Migration

Three levels of permissions are migrated:

1. **Global Permissions** — Organization-wide permissions assigned to groups (e.g., admin, quality gate admin, quality profile admin)
2. **Project-Level Permissions** — Per-project group permissions (e.g., codeviewer, issueadmin, securityhotspotadmin)
3. **Permission Templates** — Reusable permission templates with group assignments, set as defaults where applicable

### Portfolio Migration

Portfolios are recreated in SonarCloud with their project associations preserved, maintaining the organizational hierarchy for executive-level views.

### Project Configuration Migration

Per-project settings that are migrated include:
- **Project tags** — Custom categorization labels
- **Project links** — External URLs (CI/CD, documentation, issue trackers)
- **New code periods** — Definitions controlling which code is considered "new" for quality gate evaluation
- **DevOps bindings** — ALM platform integrations (GitHub, GitLab, Azure DevOps, Bitbucket)
- **Project-level settings** — Non-inherited configuration values

---

## 10. Multi-Organization Mapping and DevOps Binding Awareness

### Intelligent Project-to-Organization Mapping

For enterprises migrating to multiple SonarCloud organizations, CloudVoyager automatically maps projects to target organizations based on their **DevOps platform bindings**:

1. Projects are grouped by their ALM binding (e.g., GitHub organization, GitLab group, Azure DevOps team)
2. Each binding group is matched to the corresponding target SonarCloud organization
3. Unbound projects fall back to the first configured organization
4. The mapping is exported as CSV for human review before execution

### Project Key Resolution

SonarCloud requires globally unique project keys across all organizations. CloudVoyager handles this with a smart fallback strategy:

1. Attempt to use the original SonarQube project key
2. If the key is already taken by another organization, fall back to `{org}_{key}`
3. If the key is already owned by the target organization (from a previous run), reuse it
4. All key conflicts are logged and reported in the migration summary

### CSV Generation

The mapping module generates structured CSV files for:
- Organization assignments (which project goes where)
- DevOps binding groups (how projects are clustered)
- Project metadata (names, keys, binding info)
- Resource mappings (gates, profiles, templates per organization)

---

## 11. Concurrency Engine and Performance Optimization

### Zero-Dependency Concurrency Layer

CloudVoyager implements its own concurrency primitives (`src/utils/concurrency.js`) with **zero external dependencies**:

- **`createLimiter(n)`** — Bounds concurrent async operations to `n` at a time (functionally equivalent to `p-limit`, but without the dependency)
- **`mapConcurrent(items, fn, options)`** — Parallel map over items with bounded concurrency, supporting:
  - **Settled mode**: Collects errors rather than aborting, allowing partial success
  - **Progress callbacks**: Real-time logging of completion progress
  - **Configurable concurrency**: Different limits per operation type

### Per-Operation Concurrency Tuning

Different operations have different optimal concurrency levels, reflecting API rate limits and resource constraints:

| Operation | Default Concurrency | Rationale |
|-----------|-------------------|-----------|
| Source file extraction | 10 | I/O-bound, benefits from parallelism |
| Hotspot detail fetching | 10 | Many small requests |
| Issue metadata sync | 5 | Write operations, moderate rate limits |
| Hotspot metadata sync | 3 | Aggressive SonarCloud rate limiting |
| Project migration | 1 | Heavy per-project workload |

### Progress Tracking

Long-running concurrent operations emit progress logs (e.g., "Fetching sources: 142/350 completed") via `createProgressLogger`, giving operators real-time visibility into migration progress.

---

## 12. Auto-Tuning and Adaptive Resource Management

### Hardware-Aware Configuration

The `--auto-tune` flag enables automatic performance configuration based on available system resources:

| Resource | Detection Method | Tuning Strategy |
|----------|-----------------|-----------------|
| CPU cores | `os.availableParallelism()` | Scale concurrency from core count |
| System RAM | `os.totalmem()` | Set heap to 75% of RAM (max 16 GB) |

### Auto-Tuned Concurrency Formulas

- `sourceExtraction` = CPU cores x 2
- `hotspotExtraction` = CPU cores x 2
- `issueSync` = CPU cores
- `hotspotSync` = min(max(CPU cores / 2, 3), 5)
- `projectMigration` = max(1, CPU cores / 3)

### Automatic Memory Management

When `maxMemoryMB` is configured (via auto-tune or explicit flag), the tool:

1. Checks the current V8 heap limit via `v8.getHeapStatistics()`
2. If insufficient, **re-spawns itself** with `NODE_OPTIONS="--max-old-space-size=<value>"`
3. Sets a `CLOUDVOYAGER_RESPAWNED=1` environment variable to prevent infinite respawn loops
4. Output streams seamlessly through the respawned process — the user sees no interruption

### SEA Binary Detection

The respawn logic correctly detects whether it's running as a Node.js script or a Single Executable Application (SEA) binary by comparing `process.argv[0]` and `process.argv[1]`. This is critical because SEA binaries duplicate the executable path in argv, and incorrect detection would cause argument corruption on respawn.

---

## 13. Single Executable Application (SEA) Binary

### Zero-Install Distribution

CloudVoyager builds standalone binaries using **Node.js Single Executable Applications (SEA)**, meaning users download a single file and run it — no Node.js installation, no `npm install`, no dependency management.

### Supported Platforms

| Platform | Architecture |
|----------|-------------|
| macOS | ARM64 (Apple Silicon) |
| macOS | x64 (Intel) |
| Linux | ARM64 |
| Linux | x64 |
| Windows | x64 |
| Windows | ARM64 |

### Build Process

1. **esbuild** bundles the entire ESM source tree into a single CJS file (`dist/cli.cjs`)
2. A **SEA configuration blob** is generated with V8 code cache enabled
3. The host platform's `node` binary is copied
4. **postject** injects the SEA blob into the binary
5. On macOS, the binary is **code-signed** (signature removal → blob injection → re-signing)

### CI/CD Matrix Build

Multi-platform binaries are built via **GitHub Actions** using a platform matrix, since Node.js SEA can only build for the platform it's running on. This produces all 6 platform variants automatically on each release.

---

## 14. Build Pipeline Optimizations

### esbuild Configuration

| Optimization | Impact |
|-------------|--------|
| **Target: Node 21** | Modern syntax output, fewer polyfill transforms, smaller bundle |
| **Minification** | Reduces bundle size by removing whitespace, shortening identifiers |
| **Tree Shaking** | Dead code elimination removes unused exports across the dependency tree |
| **Proto as Text** | `.proto` files inlined as strings, eliminating runtime file I/O |
| **CJS Output** | Single `dist/cli.cjs` file, compatible with SEA blob generation |

### V8 Code Cache

The SEA configuration enables `useCodeCache: true`, which:
- Pre-compiles JavaScript to **V8 bytecode** at build time
- Stores the compiled bytecode alongside the source in the SEA blob
- On startup, V8 loads the cached bytecode directly instead of parsing and compiling from source
- Results in **significantly faster cold startup** times, especially for the ~8,100-line codebase

### Simplified Encoding Pipeline

An earlier architecture used **worker threads** for protobuf encoding. This was replaced with in-process encoding for greater reliability and simpler error propagation, with no measurable performance regression (encoding is CPU-bound but fast relative to network I/O).

---

## 15. Rate Limiting and API Resilience

### Two-Layer Rate Limiting Strategy

The SonarCloud API client implements a configurable two-layer approach:

**Layer 1: Exponential Backoff Retry**
- Triggers on HTTP 503 (Service Unavailable) and 429 (Too Many Requests) responses
- Retries up to `maxRetries` times (default: 3)
- Delay doubles each attempt: `baseDelay × 2^(attempt-1)` (e.g., 1s → 2s → 4s)
- Logs warnings before each retry for operator visibility

**Layer 2: Write Request Throttling**
- POST requests are spaced at least `minRequestInterval` milliseconds apart
- Implemented via an Axios request interceptor
- Proactively prevents rate-limit triggers during high-volume write operations

### Graceful Degradation

- **Settled-mode concurrency**: Source file and hotspot extraction continue past individual failures, collecting errors rather than aborting
- **Non-fatal server-wide extraction**: The migration pipeline continues even if specific resource types fail to extract
- **Partial success handling**: Projects that fail during migration are logged and reported, but do not block other projects

---

## 16. Incremental and Stateful Transfers

### State Tracking

CloudVoyager maintains a JSON state file that tracks:

```json
{
  "lastSync": "2026-02-18T12:00:00Z",
  "processedIssues": ["issue-key-1", "issue-key-2", "..."],
  "completedBranches": ["main", "develop"],
  "syncHistory": [
    { "timestamp": "...", "success": true, "stats": { "..." } }
  ]
}
```

### Incremental Mode

When `transfer.mode` is set to `"incremental"`:
- Issues are filtered by creation date (only issues created after `lastSync` are extracted)
- Previously processed issue keys are skipped
- Completed branches are not re-transferred
- State is updated only after successful upload, ensuring consistency

### Full Mode

When set to `"full"`, all data is re-extracted and re-transferred regardless of state. The state file is still updated to record the transfer.

### State Management Commands

- `cloudvoyager status` — View current sync state and transfer history (last 10 entries)
- `cloudvoyager reset` — Clear all state to force a full re-transfer

---

## 17. Comprehensive Reporting Suite

The migration pipeline generates reports in **6 formats** across **3 report types**:

### Report Types

| Report | Purpose | Audience |
|--------|---------|----------|
| **Migration Report** | Full detailed breakdown of every migration step, per-project and per-org | Engineering teams |
| **Executive Summary** | High-level overview with success/failure counts and key metrics | Leadership and stakeholders |
| **Performance Report** | Timing analysis for each pipeline stage | Operations and optimization |

### Output Formats

Each report type is generated in multiple formats:
- **JSON** — Machine-readable, for downstream tooling and dashboards
- **Markdown** — Rendered in GitHub/GitLab, wikis, and documentation systems
- **Plain Text** — Terminal-friendly, for quick review
- **PDF** — Presentation-ready, generated via `pdfmake` (best-effort; failures are logged but non-blocking)

### Report Content

Reports include:
- Per-project transfer status (success, failure, skipped)
- Per-organization resource migration summaries
- Issue and hotspot sync statistics (matched, transitioned, failed)
- Quality gate and quality profile migration results
- Permission and group creation results
- Error details with full context for failed operations
- Execution timing breakdowns per pipeline stage

### Quality Profile Diff Report

A specialized JSON report (`quality-profile-diff.json`) compares active rules per language between SonarQube source profiles and SonarCloud target profiles, identifying:
- **Missing rules**: Rules active in SonarQube but not available on SonarCloud
- **Added rules**: Rules on SonarCloud not present in SonarQube

---

## 18. Configuration System and Schema Validation

### Schema-Validated Configuration

All configuration is validated at startup using **Ajv (Another JSON Validator)** with strict schema enforcement. Validation errors are surfaced with specific field-level messages before any API calls are made.

### Configuration Scopes

| Scope | Config File | Used By |
|-------|------------|---------|
| Single project transfer | `config.json` | `transfer`, `transfer-all` |
| Full migration | `migrate-config.json` | `migrate`, `sync-metadata` |

### Environment Variable Overrides

Sensitive values can be provided via environment variables, keeping secrets out of config files:

| Variable | Overrides |
|----------|----------|
| `SONARQUBE_TOKEN` | `sonarqube.token` |
| `SONARCLOUD_TOKEN` | `sonarcloud.token` |
| `SONARQUBE_URL` | `sonarqube.url` |
| `SONARCLOUD_URL` | `sonarcloud.url` |

### Shared Schema Definitions

Performance and rate-limit schemas are shared across all configuration types, ensuring consistent tuning options regardless of migration scenario.

---

## 19. CLI Design and Operational Modes

### Command Suite

| Command | Description | Key Flags |
|---------|-------------|-----------|
| `transfer` | Single project transfer | `--wait`, `--concurrency`, `--max-memory`, `--auto-tune` |
| `transfer-all` | All projects to one org (code + issues) | `--dry-run`, `--wait`, `--concurrency`, `--max-memory`, `--project-concurrency`, `--auto-tune` |
| `migrate` | Full multi-org migration | `--dry-run`, `--wait`, `--skip-issue-metadata-sync`, `--skip-hotspot-metadata-sync`, `--concurrency`, `--max-memory`, `--project-concurrency`, `--auto-tune` |
| `sync-metadata` | Standalone metadata sync | `--skip-issue-metadata-sync`, `--skip-hotspot-metadata-sync`, `--concurrency`, `--max-memory`, `--auto-tune` |
| `validate` | Configuration validation | — |
| `test` | Connection testing | — |
| `status` | View sync state | — |
| `reset` | Clear sync state | `-y` (skip confirmation) |

### Operational Safeguards

- **`validate`** — Always run before migration to catch config issues early
- **`test`** — Verify connectivity to both SonarQube and SonarCloud before committing to a long migration
- **`--dry-run`** — Execute extraction and mapping without writing to SonarCloud
- **`--verbose`** — Debug-level logging for troubleshooting

### Logging

Winston-based logging with:
- Configurable levels via `LOG_LEVEL` environment variable
- Optional file output via `LOG_FILE` environment variable
- Structured timestamps and log formatting
- `--verbose` flag sets level to `debug`

---

## 20. Error Handling Architecture

### Custom Error Hierarchy

```
CloudVoyagerError (base)
├── ConfigurationError        (invalid config)
├── ValidationError           (schema validation failures)
├── SonarQubeAPIError         (SQ API failures with endpoint context)
├── SonarCloudAPIError        (SC API failures with endpoint context)
├── AuthenticationError       (401 errors with service identification)
├── ProtobufEncodingError     (encoding failures)
└── StateError                (state file read/write failures)
```

### Connection Error Diagnostics

API client errors include specific diagnostics based on the underlying network error:
- `ECONNREFUSED` — Server not running or wrong port
- `ETIMEDOUT` — Network timeout, possible firewall issue
- `ENOTFOUND` — DNS resolution failure, wrong URL

### Fail-Fast with Graceful Degradation

- **Critical failures** (config invalid, no connectivity, project not found) stop immediately with clear error messages
- **Non-critical failures** (individual resource extraction, single project in batch) are logged and reported but do not block the overall pipeline

---

## 21. Engineering Summary

### By the Numbers

| Metric | Value |
|--------|-------|
| Total source lines | ~8,100+ |
| Source files | 100+ |
| SonarQube extractor modules | 24 |
| SonarCloud migrator modules | 9 |
| CLI commands | 8 |
| Report output formats | 6 (JSON, MD, TXT, PDF x3 types) |
| Supported binary platforms | 6 |
| Production dependencies | 8 |
| Resource types migrated | 12+ per organization |

### Key Engineering Decisions

| Decision | Rationale |
|----------|-----------|
| Reverse-engineer scanner protocol | No official migration path exists; this is the only way to avoid re-scanning |
| Zero-dependency concurrency | Avoid bloat; the custom implementation is ~80 lines and covers all use cases |
| Inline proto schemas | Eliminate runtime file I/O dependencies for SEA binary compatibility |
| Builder-encoder separation | Clean architecture; business logic in builders, serialization in encoder |
| Non-fatal extraction | Maximize migration completeness even when individual items fail |
| Settled-mode concurrency | Partial success is better than total failure for large-scale operations |
| V8 code cache in SEA | Fastest possible cold startup for a ~8K-line bundled application |
| Auto-tune from hardware | One flag replaces manual tuning of 6+ concurrency/memory parameters |

### What Makes This Novel

1. **No existing tool does this.** CloudVoyager is the first to reverse-engineer SonarScanner's protobuf protocol and reconstruct it programmatically.
2. **Zero source code access required.** The migration operates entirely at the API level — no repository cloning, no build systems, no CI/CD integration needed.
3. **Complete fidelity.** Issues, hotspots, measures, quality gates, quality profiles, permissions, groups, templates, portfolios, settings, tags, links, bindings, and new code periods are all preserved.
4. **Production-proven at scale.** Successfully migrated 29 projects with 16,000+ issues in a single automated run.
5. **Single binary, zero dependencies.** Distributed as a standalone executable — no runtime, no package manager, no setup.
6. **Fast.** 29 projects, 53 quality profiles, and all organizational configuration migrated in under 16 minutes.
