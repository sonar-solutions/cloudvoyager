# Architecture

## Project Structure

```
src/
├── index.js              # CLI entry point (Commander-based)
├── transfer-pipeline.js  # Transfer orchestrator (extract → build → encode → upload)
├── config/
│   ├── loader.js         # Config loading and validation (Ajv)
│   └── schema.js         # JSON schema definition
├── sonarqube/
│   ├── api-client.js     # HTTP client with pagination, auth, SCM revision
│   ├── models.js         # Data models (with language support)
│   └── extractors/       # Specialized data extractors
│       ├── index.js      # DataExtractor orchestrator
│       ├── projects.js   # Project metadata, branches, quality gates
│       ├── issues.js     # Issues with pagination
│       ├── metrics.js    # Metric definitions
│       ├── measures.js   # Project and component measures
│       ├── sources.js    # Source code files (with language info)
│       ├── rules.js      # Active rules extraction
│       ├── changesets.js  # SCM changeset data per file
│       ├── symbols.js    # Symbol references
│       └── syntax-highlighting.js  # Syntax highlighting data
├── protobuf/
│   ├── builder.js        # Transforms extracted data into protobuf messages
│   ├── encoder.js        # Encodes messages using protobufjs
│   └── schema/           # Protocol buffer definitions (.proto files)
│       ├── scanner-report.proto
│       └── constants.proto
├── sonarcloud/
│   ├── api-client.js     # SonarCloud HTTP client (retry, throttle, quality profiles)
│   └── uploader.js       # Report packaging and CE submission
├── state/
│   ├── storage.js        # File-based state persistence
│   └── tracker.js        # Incremental transfer state tracking
└── utils/
    ├── logger.js         # Winston-based logging
    └── errors.js         # Custom error classes
```

## Data Flow

1. **Configuration Loading** - Load and validate config, apply env var overrides
2. **State Initialization** - Load previous state for incremental transfers
3. **Connection Testing** - Verify connectivity to SonarQube and SonarCloud
4. **Data Extraction** - Extract all data from SonarQube using specialized extractors
5. **Message Building** - Transform extracted data into protobuf message structures
6. **Encoding** - Encode messages to binary protobuf format
7. **Upload** - Submit encoded report to SonarCloud CE endpoint
8. **State Update** - Record successful transfer in state file

## Key Design Patterns

- **Extractor Pattern** - Specialized modules for each data type with consistent interface
- **Client-Service Pattern** - API clients handle HTTP, services handle business logic
- **Builder Pattern** - ProtobufBuilder constructs complex message structures
- **State Pattern** - StateTracker manages transfer state for incremental sync
- **Error Hierarchy** - Custom error classes provide specific error handling

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
