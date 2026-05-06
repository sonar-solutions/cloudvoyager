# Audit & Error Events Logging Strategy

<!-- last-updated="2026-05-07T01:15:00Z" updated-by="Claude" -->

This document describes the logging architecture, log levels, destinations, and audit trail implementation for CloudVoyager. All logging is handled through the centralized Winston-based logger at `src/shared/utils/logger/`.

---

## 1. Logging Architecture

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

CloudVoyager uses [Winston](https://github.com/winstonjs/winston) as its logging framework, providing a flexible and extensible architecture for handling logs across all pipeline operations.

### Core Components

The logging system is split into three modules within `src/shared/utils/logger/`:

| File | Purpose |
|------|---------|
| `helpers/create-logger.js` | Creates and exports the default logger instance with console transport |
| `helpers/enable-file-logging.js` | Adds file-based transports with level filtering |
| `helpers/log-format.js` | Defines the log format templates |

### Logger Initialization

The default logger is created with console transport and respects the `LOG_LEVEL` environment variable (defaults to `info`):

```javascript
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: baseFormat,
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    })
  ]
});
```

---

## 2. Log Levels

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

CloudVoyager uses the standard severity levels defined by Winston. Each level has a specific use case within the migration pipelines.

| Level | Numeric Priority | Usage |
|-------|------------------|-------|
| `error` | 0 | Fatal failures, unhandled exceptions, API errors that abort operations |
| `warn` | 1 | Recoverable issues, partial failures, deprecated usage, skipped steps |
| `info` | 2 | Normal operations, step completions, API responses, configuration loaded |
| `debug` | 3 | Detailed diagnostic information, request/response bodies, intermediate values |

### Environment-Based Level Control

Set the log level via the `LOG_LEVEL` environment variable:

```bash
# Production - only info and above
LOG_LEVEL=info node migrate.js

# Development - verbose debug output
LOG_LEVEL=debug node migrate.js
```

### Usage Examples

```javascript
import logger from '../shared/utils/logger.js';

// Error - unrecoverable failure
logger.error(`Project ${projectKey} FAILED: ${error.message}`);

// Warn - partial success or recoverable issue
logger.warn(`Project ${project.key} partially migrated (${failedCount} step(s) failed)`);

// Info - normal operation completion
logger.info(`[${project.key}] Project configuration complete`);

// Debug - detailed diagnostics
logger.debug(`Skipping project config for ${scProjectKey} (already applied)`);
```

---

## 3. Log Destinations

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

CloudVoyager supports multiple log destinations, configurable based on environment and requirements.

### Console Transport

All logs are written to stdout by default with colorized output for readability:

```
2026-05-07 01:15:00 [info]: Logs directory: migration-output/logs/2026-05-07T01-15-00
2026-05-07 01:15:00 [info]:   Raw logs:   migration-output/logs/2026-05-07T01-15-00/cloudvoyager-migrate.log
2026-05-07 01:15:00 [error]: Project JIRA-123 FAILED (sync_issues: connection timeout)
```

### File Transports

File logging is enabled by calling `enableFileLogging(commandName)`. This creates a timestamped directory under `migration-output/logs/` with four separate log files:

| File | Contents |
|------|----------|
| `cloudvoyager-{name}.log` | All levels (raw/unfiltered) |
| `cloudvoyager-{name}.info.log` | Only `info` level messages |
| `cloudvoyager-{name}.warn.log` | Only `warn` level messages |
| `cloudvoyager-{name}.error.log` | Only `error` level messages |

### Directory Structure

```
migration-output/
  logs/
    2026-05-07T01-15-00/          <- Timestamp of migration run
      cloudvoyager-migrate.log    <- All debug+ messages
      cloudvoyager-migrate.info.log
      cloudvoyager-migrate.warn.log
      cloudvoyager-migrate.error.log
```

### Legacy Single File Transport

For ad-hoc logging, the `LOG_FILE` environment variable directs all logs to a single file:

```bash
LOG_FILE=/var/log/cloudvoyager.log node migrate.js
```

---

## 4. Structured Logging

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

### Text Format

CloudVoyager uses a human-readable text format optimized for operator review:

```
{timestamp} [{level}]: {message}
```

With stack traces appended for errors:

```
{timestamp} [{level}]: {message}
{stack_trace}
```

### Format Examples

**Standard log entry:**
```
2026-05-07 01:15:00 [info]: Project JIRA-123 migrated successfully
```

**Error with stack trace:**
```
2026-05-07 01:15:00 [error]: Project JIRA-456 FAILED
Error: SonarQube API error
    at SonarQubeClient.request (/src/sonarqube/api-client.js:45:12)
    at async migrateOneProjectCore (/src/pipelines/sq-2025/pipeline/project-core-migrator/helpers/migrate-one-project-core.js:67:20)
```

### JSON Extraction

For machine parsing, extract fields using standard text parsing:

```
2026-05-07 01:15:00 [info]: Project JIRA-123 migrated successfully
```

| Field | Extraction Pattern |
|-------|-------------------|
| Timestamp | `^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})` |
| Level | `\[(info|warn|error|debug)\]` |
| Message | `: (.*)$` |

---

## 5. Error Event Classification

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

CloudVoyager defines a hierarchy of error types in `src/shared/utils/errors/`, all inheriting from the base `CloudVoyagerError` class.

### Error Class Hierarchy

```
CloudVoyagerError (base)
├── ConfigurationError          <- Invalid configuration values
├── ValidationError             <- Input validation failures
├── StateError                  <- Invalid state transitions
├── SonarQubeAPIError           <- SonarQube API failures
├── SonarCloudAPIError           <- SonarCloud API failures
├── AuthenticationError          <- Auth/credential failures
├── ProtobufEncodingError       <- Protobuf serialization errors
├── GracefulShutdownError       <- Controlled shutdown signal
├── LockError                   <- Concurrency lock failures
└── StaleResumeError            <- Stale resume checkpoint
```

### Base Error Class

```javascript
export class CloudVoyagerError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

### API-Specific Errors

API errors include endpoint information for debugging:

```javascript
export class SonarQubeAPIError extends CloudVoyagerError {
  constructor(message, statusCode = 500, endpoint = null) {
    super(message, statusCode);
    this.endpoint = endpoint;
  }
}
```

### Error Logging Pattern

Errors are logged with context at the point of capture:

```javascript
try {
  await sonarCloudClient.createProject(projectKey);
} catch (error) {
  logger.error(`Failed to create project ${projectKey}: ${error.message}`);
  projectResult.steps.push({
    step: 'create_project',
    status: 'failed',
    error: error.message
  });
}
```

---

## 6. Audit Trail

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

CloudVoyager logs specific events for compliance auditing and operational visibility.

### Migration Lifecycle Events

| Event | Level | Description |
|-------|-------|-------------|
| Migration start | `info` | Pipeline initialization with configuration |
| Project migration start | `info` | Individual project migration begins |
| Project migration success | `info` | Project migrated without errors |
| Project partial failure | `warn` | Project migrated with some steps failed |
| Project complete failure | `error` | Project migration failed entirely |
| Step completion | `debug` | Individual migration step finished |
| API request/response | `debug` | External API calls (body redacted) |

### Audit Log Examples

**Project success:**
```
2026-05-07 01:15:00 [info]: Project JIRA-123 migrated successfully
```

**Partial failure:**
```
2026-05-07 01:15:00 [warn]: Project JIRA-456 partially migrated (2 step(s) failed: sync_issues, sync_hotspots)
```

**Complete failure:**
```
2026-05-07 01:15:00 [error]: Project JIRA-789 FAILED (3 step(s) failed: project_permissions: connection refused; sync_issues: timeout; sync_hotspots: quota exceeded)
```

### Step Tracking

Each project migration records step outcomes in `projectResult.steps`:

```javascript
const projectResult = {
  projectKey: project.key,
  scProjectKey,
  status: 'success',  // 'success' | 'partial' | 'failed'
  steps: [
    { step: 'upload_scanner_report', status: 'success' },
    { step: 'project_settings', status: 'success' },
    { step: 'sync_issues', status: 'failed', error: 'connection timeout' }
  ],
  errors: []
};
```

### Compliance Recording

Failed steps are aggregated into a structured error log:

```javascript
if (failedSteps.length > 0) {
  results.errors.push({
    project: project.key,
    failedSteps: failedSteps.map(s => ({ step: s.step, error: s.error }))
  });
}
```

---

## 7. Log Rotation and Retention

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

CloudVoyager creates new log directories for each migration run, providing natural separation for rotation.

### Directory Naming Convention

Logs are stored in timestamped directories using ISO 8601 format (with colons/dots replaced):

```
migration-output/logs/2026-05-07T01-15-00/
migration-output/logs/2026-05-07T03-45-30/
migration-output/logs/2026-05-08T00-00-15/
```

### Rotation Strategy

| Aspect | Implementation |
|--------|----------------|
| Rotation trigger | New directory per `enableFileLogging()` call |
| Granularity | Separate files per log level |
| Timestamp precision | Full ISO 8601 to the second |
| Filename safety | Command names sanitized to `[^a-zA-Z0-9_-]` |

### Retention Recommendations

Since CloudVoyager does not implement automatic retention, it is recommended to:

1. **Set up external rotation** - Use `logrotate` on Linux or similar tools
2. **Archive old runs** - Compress and move completed migration logs to cold storage
3. **Define retention policy** - Example `logrotate` config:

```bash
/migration-output/logs {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
}
```

### Manual Cleanup

To clean up old logs manually:

```bash
# Remove logs older than 30 days
find migration-output/logs -type d -mtime +30 -exec rm -rf {} +
```

### Disk Space Monitoring

Monitor log directory size to prevent disk exhaustion:

```bash
du -sh migration-output/logs/
```

---

## Quick Reference

### Importing the Logger

```javascript
import logger from '../shared/utils/logger.js';
```

### Enabling File Logging

```javascript
import { enableFileLogging } from '../shared/utils/logger.js';

enableFileLogging('migrate');  // Creates migration-output/logs/{timestamp}/cloudvoyager-migrate.*
```

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LOG_LEVEL` | `info` | Minimum log level to output |
| `LOG_FILE` | (none) | Single file for all logs |

### Log Level Quick Reference

- Use `error` for failures that prevent operation completion
- Use `warn` for recoverable issues or partial successes
- Use `info` for significant milestones and configuration
- Use `debug` for diagnostic traces (not for production)
