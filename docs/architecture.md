# Architecture

## Project Structure

```
src/
├── index.js                  # CLI entry point (Commander-based)
├── transfer-pipeline.js      # Single-project transfer (extract → build → encode → upload)
├── migrate-pipeline.js       # Full multi-org migration orchestrator
├── config/
│   ├── loader.js             # Config loading and validation (Ajv)
│   └── schema.js             # JSON schemas (configSchema, migrateConfigSchema)
├── sonarqube/
│   ├── api-client.js         # HTTP client with pagination, auth, SCM revision
│   ├── models.js             # Data models (with language support)
│   └── extractors/           # Specialized data extractors
│       ├── index.js           # DataExtractor orchestrator
│       ├── projects.js        # Project metadata, branches, quality gates
│       ├── issues.js          # Issues with pagination
│       ├── hotspots.js        # Security hotspots with status and comments
│       ├── metrics.js         # Metric definitions
│       ├── measures.js        # Project and component measures
│       ├── sources.js         # Source code files (with language info)
│       ├── rules.js           # Active rules extraction
│       ├── changesets.js      # SCM changeset data per file
│       ├── symbols.js         # Symbol references
│       ├── syntax-highlighting.js  # Syntax highlighting data
│       ├── quality-gates.js   # Quality gate definitions, conditions, permissions
│       ├── quality-profiles.js # Quality profile definitions, backup XML, permissions
│       ├── groups.js          # User group definitions
│       ├── permissions.js     # Global, project, and template permissions
│       ├── portfolios.js      # Portfolio definitions and membership
│       ├── project-settings.js # Non-inherited project-level settings
│       ├── project-tags.js    # Custom project tags
│       ├── project-links.js   # External project links
│       ├── new-code-periods.js # New code period definitions (per project/branch)
│       ├── devops-bindings.js # ALM/DevOps settings and project bindings
│       ├── server-info.js     # Server version, plugins, settings
│       └── webhooks.js        # Server and project-level webhooks
├── protobuf/
│   ├── builder.js            # Transforms extracted data into protobuf messages
│   ├── encoder.js            # Encodes messages using protobufjs
│   └── schema/               # Protocol buffer definitions (.proto files)
│       ├── scanner-report.proto
│       └── constants.proto
├── sonarcloud/
│   ├── api-client.js         # SonarCloud HTTP client (retry, throttle, quality profiles)
│   ├── uploader.js           # Report packaging and CE submission
│   └── migrators/            # SonarCloud migration modules
│       ├── quality-gates.js   # Create gates, assign to projects
│       ├── quality-profiles.js # Restore profiles via backup XML
│       ├── groups.js          # Create user groups
│       ├── permissions.js     # Global, project, and template permissions
│       ├── portfolios.js      # Create portfolios, assign projects
│       ├── project-config.js  # Settings, tags, links, new code periods, DevOps bindings
│       ├── issue-sync.js      # Sync issue statuses, assignments, comments, tags
│       └── hotspot-sync.js    # Sync hotspot statuses and comments
├── mapping/
│   ├── org-mapper.js         # Map projects to target orgs (by DevOps binding)
│   └── csv-generator.js      # Generate mapping CSVs for review
├── state/
│   ├── storage.js            # File-based state persistence
│   └── tracker.js            # Incremental transfer state tracking
└── utils/
    ├── logger.js             # Winston-based logging
    └── errors.js             # Custom error classes
```

## Commands and Pipelines

### `transfer` — Single Project

Uses `transfer-pipeline.js`:

1. **Load config** — validate and apply env var overrides
2. **Initialize state** — load previous state for incremental transfers
3. **Test connections** — verify SonarQube and SonarCloud connectivity
4. **Extract data** — extract project data from SonarQube (issues, sources, measures, etc.)
5. **Build messages** — transform extracted data into protobuf message structures
6. **Encode** — encode messages to binary protobuf format
7. **Upload** — submit encoded report to SonarCloud CE endpoint
8. **Update state** — record successful transfer in state file

### `transfer-all` — All Projects to Single Org

Uses `transfer-pipeline.js` in a loop:

1. **Discover projects** — list all SonarQube projects, apply exclusions
2. **Map project keys** — apply prefix or explicit key mappings
3. **Transfer each project** — run the single-project pipeline for each

### `migrate` — Full Multi-Org Migration

Uses `migrate-pipeline.js`:

1. **Extract server-wide data** — projects, quality gates, quality profiles, groups, permissions, templates, portfolios, DevOps bindings, server info, webhooks
2. **Generate organization mappings** — map projects to target orgs by DevOps binding, generate CSV files for review
3. **Save server info** — write system, plugins, settings, webhooks, ALM settings as JSON reference files
4. **For each target organization:**
   - Create groups
   - Set global permissions
   - Create quality gates
   - Restore quality profiles (via backup XML)
   - Create permission templates
   - For each project:
     - Upload scanner report (via transfer pipeline)
     - Sync issue statuses, assignments, comments, tags
     - Sync hotspot statuses and comments
     - Set project settings, tags, links, new code periods
     - Set DevOps binding
     - Assign quality gate
     - Set project-level permissions
   - Create portfolios and assign projects

## Key Design Patterns

- **Extractor Pattern** — specialized modules for each data type with consistent interface
- **Migrator Pattern** — specialized modules for each SonarCloud migration target
- **Client-Service Pattern** — API clients handle HTTP, services handle business logic
- **Builder Pattern** — ProtobufBuilder constructs complex message structures
- **State Pattern** — StateTracker manages transfer state for incremental sync
- **Error Hierarchy** — custom error classes provide specific error handling

## Generated Report Structure

```
scanner-report.zip:
├── metadata.pb          - Analysis metadata with SCM revision ID (single message)
├── activerules.pb       - Language-filtered quality profile rules (length-delimited)
├── context-props.pb     - SCM and CI detection metadata (empty file)
├── component-{ref}.pb   - Component definitions, flat structure (single message each)
├── issues-{ref}.pb      - Code issues with text ranges and flows (length-delimited)
├── measures-{ref}.pb    - Metrics and measurements per file component (length-delimited)
├── changesets-{ref}.pb  - SCM changeset info per file component (single message each)
└── source-{ref}.txt     - Source code files (plain text)
```

Measures are only generated for file components (no project-level `measures-1.pb`). Components use a flat structure where all files are direct children of the project (no directory components).
