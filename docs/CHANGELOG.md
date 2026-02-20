# Changelog

All notable changes to CloudVoyager are documented in this file. Entries are ordered with the most recent changes first.

---

## [1.0.0] - 2026-02-18

Initial release of CloudVoyager — a CLI tool for migrating data from self-hosted SonarQube to SonarCloud without requiring a full re-scan of source code.

---

### 2026-02-19 — Unit Tests, Local Dev Guide, Build Optimizations, and SEA Binary Fixes

#### Build Optimizations
- Updated esbuild target from Node 18 to Node 21 for modern syntax and fewer polyfill transforms
- Enabled minification and tree shaking in esbuild bundle for smaller binary size
- Enabled V8 code cache (`useCodeCache`) in SEA configuration for faster startup by pre-compiling JS to bytecode at build time

#### SEA Binary Fix
- Fixed `ensureHeapSize` respawn logic to correctly detect SEA binaries where `process.argv[0]` and `process.argv[1]` are duplicated, preventing extra argument passing to child processes

#### Refactored
- Simplified protobuf schema imports in encoder.js by removing redundant path resolution

#### New API Endpoints and Reporting
- Added new API endpoints and enhanced reporting features for migration workflows
- Enhanced documentation and reports for migration process, including new transfer scenarios and improved output paths

#### Testing
- Added unit tests for SonarQube models, state management, transfer pipeline, concurrency utilities, error handling, and logging

#### Documentation
- Added local development guide for building and running CloudVoyager from source with step-by-step instructions

---

### 2026-02-18 — Reporting, Quality Profile Diffs, and Stability Fixes

#### Migration Report Generation
- Added comprehensive migration report output in multiple formats: **PDF**, **JSON**, **Markdown**, and **plain text**
- Reports include executive summaries, per-project breakdowns, and performance timing analysis
- Enables stakeholders to review migration outcomes at a glance

#### Quality Profile Diff Reports
- Added side-by-side comparison of active rules per language between SonarQube and SonarCloud
- Identifies rule discrepancies after profile migration, so teams can verify policy parity before go-live

#### New Code Period Migration
- Migrates "new code" period definitions (used for quality gate evaluations) to SonarCloud via the settings API
- Supports all SonarQube new code period types with automatic mapping to SonarCloud equivalents

#### Auto-Tune Performance
- Added `--auto-tune` flag that detects available CPU cores and RAM to automatically configure concurrency and memory limits
- Replaces previously separate high-memory and fast migration scripts with a single unified option
- Automatic process respawn with increased heap size when memory limits are configured

#### CLI Enhancements
- Added `--wait` flag to block until SonarCloud finishes analyzing the uploaded report, useful for CI/CD pipelines
- Branch name is now resolved from SonarCloud (not SonarQube) to avoid mismatches in multi-branch setups

#### SonarCloud Integration Improvements
- Added project key availability check to detect naming conflicts before migration begins
- Improved duplicate report prevention via SCM revision tracking

#### Encoding and Architecture Improvements
- Simplified protobuf encoding pipeline by removing worker threads — encoding now runs in-process for greater reliability
- Protobuf schemas are inlined into the bundled binary, eliminating external file dependencies
- Improved quality gate migration with modular condition and permission handling
- Improved permission template migration with clearer error handling

#### Documentation Updates
- Expanded README with reverse-engineering approach explanation, Quick Start guide, and detailed download instructions
- Added Windows ARM64 to the list of supported binary platforms

#### Bug Fixes
- Fixed macOS version in CI/CD build matrix (updated from macOS 13 to macOS 15)
- Fixed incorrect file paths for organization mapping CSV and quality profile diff outputs in reports

---

### 2026-02-17 — Full Migration Pipeline, Metadata Sync, and Concurrency

#### Full Migration Pipeline (`migrate` command)
- **Issue metadata sync** — migrates issue statuses, assignments, comments, and tags from SonarQube to SonarCloud
- **Hotspot metadata sync** — migrates security hotspot statuses and review comments
- **Permissions migration** — transfers global permissions, project-level permissions, and permission templates
- **Portfolio migration** — recreates portfolios in SonarCloud while preserving project associations
- **Project settings migration** — migrates tags, links, DevOps bindings, and project-level configuration
- **Quality gates migration** — transfers gate definitions, conditions, project assignments, and access permissions
- **Quality profiles migration** — uses backup/restore to transfer profiles via XML; built-in profiles are migrated as custom copies with inheritance chains and permissions preserved
- Added 12 new data extractors covering DevOps bindings, groups, hotspots, new code periods, permissions, portfolios, project links, project settings, project tags, quality gates, quality profiles, and server info (plugins + webhooks)

#### Standalone Metadata Sync (`sync-metadata` command)
- Added a dedicated command for syncing issue and hotspot metadata independently of the main migration
- Designed to be safely retryable — can be re-run without duplicating data
- Generates detailed migration reports with per-organization and per-project summaries

#### Rate Limiting
- Added configurable rate limiting for SonarCloud API write requests with exponential backoff on 503/429 responses
- Prevents API throttling during large-scale migrations

#### Concurrency and Performance Tuning
- Introduced configurable per-operation concurrency limits (source extraction, hotspot extraction, issue sync, hotspot sync, project migration)
- Custom zero-dependency concurrency layer for parallel task execution with configurable limits
- Performance configuration can be passed to all migration and transfer functions

#### Documentation and Configuration
- Added comprehensive configuration documentation with examples for migration and bulk transfer scenarios
- Updated architecture documentation to reflect new migration pipeline components
- Added LICENSE file for open-source compliance
- Created scenario-based migration guides:
  - **Single project** — migrate one specific project
  - **Single organization** — migrate all projects to one SonarCloud organization
- Removed outdated usage guide (content consolidated into scenario documents)

---

### 2026-02-16 — Core Transfer Engine, CLI, Build System, and Initial Documentation

#### Data Extraction Engine
- Built the core extraction engine that pulls all relevant data from SonarQube via its REST API:
  - Project metadata, branches, and quality gate associations
  - Issues with full pagination support and incremental sync capability
  - Measures and metrics at both project and component level
  - Source code files with configurable extraction limits
  - SCM blame/changeset data for accurate authorship tracking
  - Active rules from quality profiles, filtered to languages in use
  - Symbol references and syntax highlighting data
- Supports incremental transfers — tracks previously synced data to avoid reprocessing on subsequent runs

#### CLI Interface
- Commander-based CLI with four core commands:
  - `transfer` — extract from SonarQube, build protobuf report, upload to SonarCloud
  - `validate` — validate configuration file before running
  - `status` — view current sync state and transfer history
  - `reset` — clear sync state to force a full re-transfer
- Supports `--verbose` flag for detailed debug output
- Tokens can be provided via environment variables (`SONARQUBE_TOKEN`, `SONARCLOUD_TOKEN`) to avoid storing secrets in config files

#### Protobuf Report Builder
- Transforms extracted SonarQube data into protobuf-encoded scanner reports matching SonarCloud's internal Compute Engine format
- Uses a flat component structure (no directory hierarchy) with line counts derived from source files
- Maintains component reference mapping to preserve relationships between files, issues, and measures

#### Configuration System
- JSON-based configuration with schema validation
- Supports SonarQube source settings, SonarCloud target settings, and transfer options (mode, batch size, state file)
- Environment variable overrides for sensitive tokens

#### State Management
- File-based state persistence tracks last sync timestamp, processed issues, completed branches, and sync history
- Enables incremental transfers — only new or changed data is processed on subsequent runs
- State is only updated after a successful upload, ensuring consistency

#### Build and Release
- Standalone binary packaging via esbuild with Node.js Single Executable Applications
- Pre-built binaries for **6 platforms**: macOS (ARM64, x64), Linux (ARM64, x64), Windows (x64, ARM64)
- Automated CI/CD via GitHub Actions for building, testing, and releasing multi-platform binaries
- Protobuf schemas bundled inline — no external file dependencies at runtime

#### Code Quality
- Refactored all imports to use the `node:` prefix convention
- Refactored data models from classes to factory functions for simplicity
- General codebase cleanup for readability and maintainability

#### Documentation
- Added initial documentation suite:
  - Architecture overview
  - Configuration reference
  - Technical details
  - Troubleshooting guide
- Updated README with download instructions and migration constraints
- Added compliance scan script for internal code quality checks
