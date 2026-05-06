# Design Principles

<!-- Last updated: 2026-05-07 -->

<!-- Updated: 2026-05-07 -->

CloudVoyager follows a set of design principles that prioritize code clarity, maintainability, and reliability. These principles guide every architectural decision and implementation choice in the codebase.

---

## 1. Folder-Centric Architecture

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

One folder per feature, one file per responsibility.

The folder structure tells the story of the system. A well-named folder tree reveals the architecture at a glance, without reading a single line of code.

### The Pattern

Each logical unit (feature, endpoint, pipeline stage) gets its own folder. Inside, concerns are split into separate files:

```
src/
├── shared/
│   ├── state/                    # State management
│   │   ├── checkpoint/          # Checkpoint journal for pause/resume
│   │   │   ├── index.js         # Factory: createCheckpointJournal
│   │   │   └── helpers/         # One function per file
│   │   │       ├── phase-tracking.js
│   │   │       ├── branch-tracking.js
│   │   │       └── validate-fingerprint.js
│   │   ├── storage.js           # Re-export shim
│   │   └── lock.js              # Re-export shim
│   └── utils/
│       ├── concurrency/         # Concurrency primitives
│       │   ├── index.js
│       │   └── helpers/
│       │       ├── create-limiter.js
│       │       ├── map-concurrent.js
│       │       └── parallel-issue-sync.js
│       └── errors/
│           ├── index.js
│           └── helpers/
│               ├── cloud-voyager-error.js
│               ├── sonarqube-api-error.js
│               └── graceful-shutdown-error.js
└── pipelines/
    └── sq-2025/
        ├── sonarcloud/
        │   ├── api-client/
        │   │   ├── index.js
        │   │   └── helpers/
        │   │       ├── create-sonarcloud-client.js
        │   │       ├── attach-issue-methods.js
        │   │       └── attach-perm-methods.js
        │   └── migrators/
        │       └── permissions/
        │           ├── index.js
        │           └── helpers/
        │               ├── migrate-global-permissions.js
        │               └── migrate-project-permissions.js
        └── transfer-pipeline/
            ├── index.js
            └── helpers/
                └── sync-transfer-metadata/
                    ├── index.js
                    └── helpers/
                        ├── fetch-and-sync-issues.js
                        └── fetch-and-sync-hotspots.js
```

### Backward-Compatible Re-exports

To preserve import paths when decomposing a module, a re-export shim sits at the original path:

```javascript
// -------- Re-export Shim --------
// Preserves import path compatibility for `./checkpoint.js`

export { CheckpointJournal, createCheckpointJournal } from './checkpoint/index.js';
```

### Example: State Management Structure

The `src/shared/state/` directory demonstrates this principle:

- `storage.js` — Re-export shim pointing to `storage/index.js`
- `storage/index.js` — Atomic file-based persistence
- `storage/helpers/` — Single-responsibility helpers for atomic writes, backup rotation

---

## 2. Micro Files Over Monoliths

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Every file should do one thing and do it well. No file exceeds 50 lines.

### The Rule

When a file grows beyond ~30 lines, decompose it into a folder with an orchestrator (`index.js`) and helper files. Each helper exports exactly one function.

### Examples from the Codebase

**Error Classes (one per file):**

```
src/shared/utils/errors/helpers/
├── cloud-voyager-error.js       # Base error class
├── configuration-error.js       # Config validation errors
├── sonarqube-api-error.js      # SQ API errors
├── sonarcloud-api-error.js      # SC API errors
├── authentication-error.js      # Auth failures
├── protobuf-encoding-error.js   # Encoding errors
├── state-error.js               # State persistence errors
├── validation-error.js          # Input validation errors
├── graceful-shutdown-error.js   # SIGINT/SIGTERM handling
├── lock-error.js                # Lock file errors
└── stale-resume-error.js        # Resume validation errors
```

**Concurrency Helpers (one function per file):**

```javascript
// src/shared/utils/concurrency/helpers/create-limiter.js

export function createLimiter(concurrency) {
  if (!concurrency || concurrency < 1) throw new Error(`createLimiter: concurrency must be >= 1, got ${concurrency}`);
  let active = 0;
  const queue = [];
  const next = () => {
    while (queue.length > 0 && active < concurrency) {
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn().then(resolve, reject).finally(() => { active--; next(); });
    }
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}
```

**Phase Tracking (small, focused functions):**

```javascript
// src/shared/state/checkpoint/helpers/phase-tracking.js

// Check if a phase has been completed
export function isPhaseCompleted(journal, phaseName) {
  return journal.phases[phaseName]?.status === 'completed';
}

// Create a started phase entry
export function createStartedPhase(phaseName) {
  return {
    status: 'in_progress',
    startedAt: new Date().toISOString(),
  };
}

// Create a completed phase entry, preserving startedAt
export function createCompletedPhase(existingPhase, meta = {}) {
  return {
    status: 'completed',
    completedAt: new Date().toISOString(),
    ...(existingPhase?.startedAt ? { startedAt: existingPhase.startedAt } : {}),
    ...meta,
  };
}

// Create a failed phase entry
export function createFailedPhase(existingPhase, error) {
  return {
    ...existingPhase,
    status: 'failed',
    failedAt: new Date().toISOString(),
    error,
  };
}
```

### Why It Matters

- **Navigable:** Developers find exactly what they need without scrolling
- **Testable:** Each function can be unit tested in isolation
- **Reviewable:** Pull requests are smaller and focused
- **Maintainable:** Bugs are easier to isolate; changes are scoped

---

## 3. Flat Over Nested

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Avoid deeply nested logic. Prefer flat sequential flows and helper decomposition.

### The Problem with Nesting

Nested callbacks, promise chains, and conditional pyramids are hard to read and harder to debug:

```javascript
// AVOID: Nested, hard to follow
generateSalt(function(salt) {
  generateHash(password, salt, function(hash) {
    insertUser(userId, hash, function(user) {
      sendWelcomeEmail(user, function() {
        // ... more nesting
      });
    });
  });
});
```

### The CloudVoyager Approach

Chain small, focused functions together. Each step does one job:

```javascript
// PREFERRED: Flat, readable, top-to-bottom

async function transferProject(options) {
  const { lockFile, stateTracker } = await initializeState(transferConfig, forceUnlock);
  const { journal, cache } = await initializeCheckpoint(transferConfig, projectKey, forceRestart, forceFreshExtract);
  registerShutdown(shutdownCoordinator, journal, stateTracker, lockFile);

  try {
    return await executeTransfer({
      sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig,
      wait, skipConnectionTest, projectKey, shutdownCheck, isIncremental,
      syncAllBranches, excludeBranches, includeBranches, lockFile,
      stateTracker, journal, cache, prebuiltEnrichmentMap, initialProjectName,
    });
  } catch (error) {
    if (!(error instanceof GracefulShutdownError) && journal) {
      await journal.markInterrupted().catch(() => {});
    }
    await lockFile.release();
    throw error;
  }
}
```

### Factory Functions Over Classes

Instead of deeply nested class hierarchies, use factory functions that return configured instances:

```javascript
// src/shared/state/checkpoint/index.js

function createCheckpointJournal(journalPath) {
  const storage = new StateStorage(journalPath);
  const withLock = createWriteLock();
  let journal = null;

  const self = {
    get journalPath() { return journalPath; },
    get journal() { return journal; },
    get sessionStartTime() { return journal?.sessionFingerprint?.startedAt; },
    async initialize(fp) { return initializeJournal(self, storage, withLock, fp, j => { journal = j; }); },
    async completePhase(name, meta) { return withLock(async () => { journal.phases[name] = createCompletedPhase(journal.phases[name], meta); await self._saveUnsafe(); }); },
    // ... more methods
  };
  return self;
}
```

### Helper Decomposition

When a function has multiple steps, extract each step into a named helper:

```javascript
// Instead of one long function with nested conditionals:
// - Extract conditionals into named functions
// - Extract loops into helpers
// - Extract complex logic into descriptive helpers
```

---

## 4. Readable at a Glance

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Code should be self-documenting. Use whitespace, comments, and consistent formatting so a developer can understand a file in seconds.

### Section Header Comments

Divide files into scannable zones:

```javascript
// -------- Dependencies --------
// -------- Configuration --------
// -------- Main Logic --------
// -------- Helper Functions --------
```

### Descriptive Naming

Use descriptive, full-word names that convey intent:

```javascript
// GOOD: Descriptive names
const stateTracker = await initializeState(transferConfig, forceUnlock);
const { journal, cache } = await initializeCheckpoint(transferConfig, projectKey, forceRestart, forceFreshExtract);
registerShutdown(shutdownCoordinator, journal, stateTracker, lockFile);

// GOOD: Named helper functions
export function isPhaseCompleted(journal, phaseName) { ... }
export function createStartedPhase(phaseName) { ... }
export function createCompletedPhase(existingPhase, meta = {}) { ... }
export function createFailedPhase(existingPhase, error) { ... }
```

### Whitespace as a Visual Tool

Use blank lines to separate logical sections within a file:

```javascript
// -------- Logger --------
import logger from '../../utils/logger.js';
import { StateStorage } from '../storage.js';
import { createWriteLock } from './helpers/with-lock.js';

// -------- Factory Function --------
function createCheckpointJournal(journalPath) {
  const storage = new StateStorage(journalPath);
  const withLock = createWriteLock();
  let journal = null;

  const self = {
    get journalPath() { return journalPath; },
    get journal() { return journal; },

    async initialize(fp) { return initializeJournal(self, storage, withLock, fp, j => { journal = j; }); },

    async completePhase(name, meta) {
      return withLock(async () => {
        journal.phases[name] = createCompletedPhase(journal.phases[name], meta);
        await self._saveUnsafe();
      });
    },

    async failPhase(name, error) {
      return withLock(async () => {
        journal.phases[name] = createFailedPhase(journal.phases[name], error);
        await self._saveUnsafe();
      });
    },
  };
  return self;
}
```

### Inline Comments for Why, Not What

```javascript
// WHY: Explain non-obvious decisions
// Binary-split a date window to handle 10K+ issue retrieval efficiently
export function bisectWindow(entries, dateField, startDate, endDate) { ... }

// WHY: Document intent when behavior is subtle
// Preserve startedAt when completing a phase (don't lose the start timestamp)
export function createCompletedPhase(existingPhase, meta = {}) { ... }
```

---

## 5. Shared Libraries for Reuse

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Don't duplicate logic. Extract reusable code into shared libraries under `src/shared/`.

### Shared Modules

| Module | Purpose | Example Contents |
|--------|---------|------------------|
| `config/` | Configuration loading and validation | JSON schema, Ajv validators |
| `mapping/` | Organization mapping and CSV tools | CSV parsing, entity filters |
| `reports/` | Report generation | Text, Markdown, PDF formatters |
| `state/` | State management and persistence | Checkpoint journal, locks, storage |
| `utils/` | Shared utilities | Logger, errors, concurrency, shutdown |
| `verification/` | Migration verification | Per-check modules, report generation |

### Example: Concurrency Utilities

Instead of duplicating limiter logic across pipelines, once in `src/shared/utils/concurrency/`:

```javascript
// src/shared/utils/concurrency/helpers/create-limiter.js
export function createLimiter(concurrency) { ... }

// src/shared/utils/concurrency/helpers/map-concurrent.js
export async function mapConcurrent(items, fn, concurrency) { ... }
```

All pipelines import from the shared location:

```javascript
import { createLimiter, mapConcurrent } from '../../../shared/utils/concurrency/index.js';
```

### Example: Error Classes

All errors extend a common base, defined once:

```javascript
// src/shared/utils/errors/helpers/cloud-voyager-error.js
export class CloudVoyagerError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'CloudVoyagerError';
    this.context = context;
  }
}
```

Specific errors extend the base:

```javascript
// src/shared/utils/errors/helpers/sonarqube-api-error.js
import { CloudVoyagerError } from './cloud-voyager-error.js';
export class SonarQubeAPIError extends CloudVoyagerError { ... }
```

### Version-Specific with Shared Foundation

Each `src/pipelines/sq-{version}/` contains version-specific logic, but all rely on shared utilities:

```
src/pipelines/sq-2025/
├── sonarqube/           # Version-specific API integration
├── sonarcloud/          # Version-specific API integration
└── transfer-pipeline/  # Orchestrates using shared state/utils
```

---

## 6. Error Handling

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Graceful degradation with proper error classification and logging.

### Custom Error Hierarchy

All errors extend `CloudVoyagerError`, providing context for debugging:

```javascript
// -------- Base Error --------
export class CloudVoyagerError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'CloudVoyagerError';
    this.context = context;
  }
}

// -------- Domain-Specific Errors --------
export class ConfigurationError extends CloudVoyagerError { }
export class SonarQubeAPIError extends CloudVoyagerError { }
export class SonarCloudAPIError extends CloudVoyagerError { }
export class AuthenticationError extends CloudVoyagerError { }
export class StateError extends CloudVoyagerError { }
export class ValidationError extends CloudVoyagerError { }
export class GracefulShutdownError extends CloudVoyagerError { }
export class LockError extends CloudVoyagerError { }
```

### Graceful Shutdown Handling

The `GracefulShutdownError` allows pipelines to respond to SIGINT/SIGTERM:

```javascript
// src/shared/utils/shutdown/helpers/create-shutdown-coordinator.js
import { GracefulShutdownError } from '../../errors/index.js';

export function createShutdownCoordinator() {
  let isShuttingDown = false;
  return {
    bind() {
      process.on('SIGINT', () => { isShuttingDown = true; });
      process.on('SIGTERM', () => { isShuttingDown = true; });
    },
    isShuttingDown() { return isShuttingDown; },
    shutdownCheck() {
      if (isShuttingDown) throw new GracefulShutdownError('Shutdown requested');
      return false;
    },
  };
}
```

Pipelines catch and handle gracefully:

```javascript
try {
  return await executeTransfer({ ... });
} catch (error) {
  if (!(error instanceof GracefulShutdownError) && journal) {
    await journal.markInterrupted().catch(() => {});
  }
  await lockFile.release();
  throw error;
}
```

### Lock Files for Concurrent Run Prevention

Advisory locks prevent concurrent pipeline runs:

```javascript
// src/shared/state/checkpoint/helpers/with-lock.js
import { LockError } from '../../../utils/errors/index.js';

export function createWriteLock() {
  return async function withLock(fn) {
    // Atomic lock acquisition with timeout
    // Throws LockError if already held
  };
}
```

---

## 7. State Management

<!-- <subsection-updated last-updated="2026-05-07T01:15:00Z" updated-by="Claude" /> -->

Checkpoint journal for resumability. State persists across failures.

### Checkpoint Journal Pattern

The `CheckpointJournal` tracks phase completion, enabling pause/resume:

```javascript
// src/shared/state/checkpoint/index.js

function createCheckpointJournal(journalPath) {
  const storage = new StateStorage(journalPath);
  const withLock = createWriteLock();

  return {
    // Phase tracking
    async startPhase(name) { ... },
    async completePhase(name, meta) { ... },
    async failPhase(name, error) { ... },
    isPhaseCompleted(name) { ... },
    getResumePoint() { for (const [n, p] of Object.entries(journal.phases)) { if (p.status !== 'completed') return n; } return null; },

    // Branch tracking
    async startBranch(name) { ... },
    async markBranchCompleted(name, ceTaskId) { ... },
    async markBranchFailed(name, error) { ... },

    // Persistence
    async save() { return withLock(async () => { await storage.save(journal); }); },
    exists() { return storage.exists(); },
  };
}
```

### State Persistence

Atomic writes with backup rotation ensure no state loss:

```javascript
// src/shared/state/storage/index.js
export class StateStorage {
  async save(state) {
    // 1. Write to temp file
    // 2. Atomic rename to target
    // 3. Rotate backups (keep last N)
  }
}
```

### Journal Structure

```javascript
{
  sessionFingerprint: {
    startedAt: '2026-05-07T01:00:00Z',
    cloudvoyagerVersion: '1.2.0',
  },
  status: 'in_progress' | 'completed' | 'interrupted',
  phases: {
    extraction: { status: 'completed', startedAt: '...', completedAt: '...' },
    encoding: { status: 'in_progress', startedAt: '...' },
    upload: { status: 'pending' },
  },
  branches: {
    'main': { status: 'completed', ceTaskId: 'abc123' },
    'feature-x': { status: 'in_progress', phases: { ... } },
  },
  uploadedCeTasks: {
    'main': { taskId: 'abc123', submittedAt: '...' },
  },
}
```

### Resume Flow

```javascript
async function resumeTransfer(transferConfig, projectKey) {
  const journal = await loadJournal(transferConfig.journalPath);

  // Find where we left off
  const resumePoint = journal.getResumePoint();

  // Validate this journal matches current run
  journal.validateFingerprint(currentFingerprint);

  // Execute from resume point
  switch (resumePoint) {
    case 'extraction':
      await runExtraction();
      // fall through
    case 'encoding':
      await runEncoding();
      // fall through
    case 'upload':
      await runUpload();
  }
}
```

### Lock Integration

Locks prevent concurrent runs that could corrupt state:

```javascript
const { lockFile, stateTracker } = await initializeState(transferConfig, forceUnlock);
const { journal, cache } = await initializeCheckpoint(transferConfig, projectKey, forceRestart, forceFreshExtract);

// Lock released on success, failure, or shutdown
registerShutdown(shutdownCoordinator, journal, stateTracker, lockFile);
```

---

## Summary

| Principle | Practice |
|-----------|----------|
| **Folder-Centric** | One folder per feature, `index.js` + `helpers/` pattern |
| **Micro Files** | No file over 50 lines; one function per helper file |
| **Flat Over Nested** | Sequential flows, factory functions, named helpers |
| **Readable at a Glance** | Section headers, descriptive naming, whitespace |
| **Shared Libraries** | `src/shared/` for reusable config, state, utils, verification |
| **Error Handling** | Custom error hierarchy, graceful shutdown, lock files |
| **State Management** | Checkpoint journal for pause/resume, atomic writes |
