# Bespoke Algorithms

<!-- <doc-updated last-updated="2026-04-02T12:00:00Z" updated-by="Claude" /> -->

This document describes custom, non-trivial algorithms implemented from scratch within CloudVoyager — logic that required deliberate design decisions rather than off-the-shelf solutions.

---

## Table of Contents

1. [Date-Window Slicing (10K+ Issue Retrieval)](#1-date-window-slicing-10k-issue-retrieval)
2. [Migration Graph Visualization (Desktop DAG Renderer)](#2-migration-graph-visualization-desktop-dag-renderer)
3. [Atomic Checkpoint Journal](#3-atomic-checkpoint-journal)
4. [Protobuf Report Encoding](#4-protobuf-report-encoding)
5. [Parallel Project Config Migration (All Pipelines)](#5-parallel-project-config-migration-all-pipelines)
6. [Parallel Migrator Operations](#6-parallel-migrator-operations)

---

## 1. Date-Window Slicing (10K+ Issue Retrieval)

<!-- <section-updated last-updated="2026-04-02T12:00:00Z" updated-by="Claude" /> -->

SonarQube's `/api/issues/search` endpoint caps results at 10,000 items per query. Projects with large issue counts require the response window to be sliced by creation date and results stitched together.

### Algorithm

```
fetchWithSlicing(projectKey, params, { concurrency = 6 }):
  1. Probe the total count for the full date range
  2. If total <= 10,000 → return single fetch
  3. Otherwise:
     a. Build 12 date windows spanning SonarQube epoch → now
     b. Fetch ALL windows in parallel (mapConcurrent, concurrency = 6)
     c. Within each window, if results > 10,000: recursively subdivide
     d. Flatten and deduplicate all results by key
```

### Implementation

`src/shared/utils/search-slicer/index.js` — orchestrator (adds concurrency pass-through)
`src/shared/utils/search-slicer/helpers/slice-by-creation-date.js` — parallel window dispatch
`src/shared/utils/search-slicer/helpers/build-date-windows.js` — initial partition
`src/shared/utils/search-slicer/helpers/fetch-window.js` — single window fetch
`src/shared/utils/search-slicer/helpers/deduplicate-results.js` — deduplication

---

## 2. Migration Graph Visualization (Desktop DAG Renderer)

<!-- <section-updated last-updated="2026-04-02T13:00:00Z" updated-by="Claude" /> -->

The CloudVoyager Desktop execution screen renders a real-time animated DAG (directed acyclic graph) on an HTML5 Canvas. Nodes represent migration phases; edges show dependencies. Nodes transition from grey (pending) to amber (active) to green (done) as log lines stream in from the CLI backend.

### Architecture

The graph is implemented as a mixin-composed singleton (`window.MigrationGraph`) split across five files:

| File | Responsibility |
|------|---------------|
| `migration-graph.js` | Core: graph definitions, lifecycle, state machine, layout |
| `migration-graph-projects.js` | Dynamic per-project fan-out node generation and layout |
| `migration-graph-parsers.js` | Log-line parsing for all four modes |
| `migration-graph-rendering.js` | Force simulation, draw loop, edges, nodes |
| `migration-graph-camera.js` | Zoom, pan, drag, auto-fit |

### Graph Topology (migrate mode)

The static org-level DAG for `migrate` mode is defined in `_graphDefs.migrate`:

```
setup → groups → permissions → projects → portfolios
      → qualityGates          ↑
      → qualityProfiles → ────┘
      groups → permTemplates → projects
```

Column positions (as fractions of canvas width):
`[0.06, 0.20, 0.36, 0.52, 0.92]`

The `projects → portfolios` edge is present in the static graph definition so `portfolios` is always connected in the DAG, even before any per-project fan-out nodes are created.

### Per-Project Fan-out

When the first log line matching `--- Project N/M: <key>` is seen, `_addProjectBranch` dynamically creates four child nodes per project:

```
projects → upload:<key> → config:<key> → issues:<key>
                                       → hotspots:*<key>
```

All four nodes have `isProjectNode: true`.

### Intra-Node Parallelization

<!-- <subsection-updated last-updated="2026-04-02T12:00:00Z" updated-by="Claude" /> -->

While the DAG topology remains unchanged, operations within individual nodes now execute concurrently:

- **`config:<key>`** — project settings, gate assignment, profile assignment, and permissions all execute via concurrent `mapConcurrent` API calls
- **`upload:<key>`** — date-window extraction (if >10K issues) now fetches windows in parallel
- The DAG topology remains unchanged — parallelization is internal to each node

### Layout: Portfolios Node Positioning

<!-- <subsection-updated last-updated="2026-04-01T00:00:00Z" updated-by="Claude" /> -->

After per-project fan-out nodes are placed, `_computeProjectPositions` repositions the `portfolios` node to avoid overlap with the rightmost per-project nodes (Issues and Hotspots, placed at `projectsNode.targetX + 540`):

```
portfolios.targetX = projectsNode.targetX + 720
portfolios.targetY = projectsNode.targetY
```

**Bug fix (2026-04-01):** The offset was previously `+560`, which caused the Portfolios node to overlap the Issues/Hotspots fan-out nodes at `+540`. Changed to `+720` to provide clear separation.

### Dependency Check: `setNodeState` Parent Filtering

<!-- <subsection-updated last-updated="2026-04-01T00:00:00Z" updated-by="Claude" /> -->

`setNodeState(nodeId, 'active')` enforces a dependency gate: a node cannot activate until all its incoming edge sources have left the `pending` state. The parent lookup filters to org-level parents only:

```javascript
const parents = this.edges
  .filter(e => e.to === nodeId)
  .map(e => this._nodeById(e.from))
  .filter(n => n && !n.isProjectNode);
```

**Bug fix (2026-04-01):** Before this fix, the filter was `.filter(Boolean)` (no `isProjectNode` exclusion). Because `_addProjectBranch` adds a `config → portfolios` fanout edge, portfolios had per-project `config` nodes as parents. Those nodes start as `pending` and only advance as individual projects complete, so `portfolios` was permanently blocked from activating. Adding `.filter(n => n && !n.isProjectNode)` restricts the dependency check to org-level parents only, matching the intended graph semantics.

### Counter Race Fix for Concurrent Projects

<!-- <subsection-updated last-updated="2026-04-02T13:00:00Z" updated-by="Claude" /> -->

With `projectMigration.concurrency > 1`, `--- Project N/M:` log lines can arrive out of order. The counter now tracks the maximum index seen and only updates when a higher index arrives, preventing the counter from regressing (e.g., showing "2/3" when "3/3" was already logged).

```javascript
const idxNum = parseInt(idx, 10);
if (idxNum > this._maxProjectIdx) {
  this._maxProjectIdx = idxNum;
  this._setNodeCount('projects', idx + '/' + total);
}
```

### Progress Log Parsing for Issue/Hotspot Sync

<!-- <subsection-updated last-updated="2026-04-02T13:00:00Z" updated-by="Claude" /> -->

Issue and hotspot sync modules now emit progress logs with a `[projectKey]` prefix (e.g., `[my-project] Issue sync: 280/1041 (27%)`). The graph parser recognizes these intermediate progress lines and keeps the corresponding Issues/Hotspots nodes in the `active` state, preventing the graph from appearing frozen during long sync operations:

```javascript
// In _parseProjectSubPhase — keeps node active during progress
if (/Issue sync: \d+\/\d+/.test(line)) {
  this.setNodeState(ids.issues, 'active');
  return;
}
```

### Fallback Log Parser Completion Patterns

<!-- <subsection-updated last-updated="2026-04-01T00:00:00Z" updated-by="Claude" /> -->

Two parser paths handle log lines that are not prefixed with `[projectKey]`:

- `_parseProjectSubPhase` — handles prefixed lines (primary path)
- `_tryParseProjectSubPhase` — handles non-prefixed lines (fallback, concurrency=1 backward compat)
- `_parseSyncMetadataLine` — inline fallback block for `sync-metadata` mode

**Bug fix (2026-04-01):** The fallback parsers were missing completion patterns that the primary prefixed parsers handled. The following patterns are now consistent across both paths:

| Signal | Primary (`_parseProjectSubPhase`) | Fallback (`_tryParseProjectSubPhase` / `_parseSyncMetadataLine`) |
|--------|----------------------------------|----------------------------------------------------------------|
| Issue sync done | `Issue sync:.*matched` or `Issue sync — already completed` | Same patterns added |
| Hotspot sync done | `Hotspot sync:.*matched` or `Hotspot sync — already completed` | Same patterns added |
| Issue sync complete (alt) | — | `Issue metadata sync complete` added |
| Hotspot sync complete (alt) | — | `Hotspot metadata sync complete` added |

This ensures nodes advance to `done` correctly when running with `concurrency=1` (no `[projectKey]` prefixes) or in `sync-metadata` mode.

### State Color Interpolation

Node color is computed by linearly interpolating through three stops keyed to `node.progress` (0.0 = pending, 0.5 = active, 1.0 = done):

```
progress 0.0 → theme pending color  (grey)
progress 0.5 → rgb(210, 153, 34)    (amber)
progress 1.0 → rgb(63, 185, 80)     (green)
```

Interpolation is split at `p = 0.5`: below uses `pending → amber`, above uses `amber → green`.

### Force Simulation

Nodes converge to their `targetX / targetY` via a simple Euler integrator:

```
vx += (targetX - x) * gravity
vy += (targetY - y) * gravity
vx *= damping;  vy *= damping
x += vx;        y += vy
```

Org-level nodes additionally repel each other (strength = 1500) to prevent visual collapse. Per-project nodes are excluded from repulsion to keep fan-out rows visually parallel.

---

## 3. Atomic Checkpoint Journal

<!-- <section-updated last-updated="2026-01-01T00:00:00Z" updated-by="Claude" /> -->

CloudVoyager checkpoints migration progress so a run can be resumed after any interruption. The journal must be durable (survives crash mid-write) and must never corrupt the last known good state.

### Write Protocol

```
1. Serialize new state to JSON
2. Write to <journal>.tmp (new file descriptor, O_CREAT | O_TRUNC)
3. fsync the file descriptor
4. Rename <journal>.tmp → <journal>  (atomic on POSIX filesystems)
5. Rotate: keep last 3 backups at <journal>.backup.N
```

`rename()` is atomic on POSIX — the reader always sees either the old or the new file, never a partial write.

### Implementation

`src/shared/state/checkpoint.js`

---

## 5. Parallel Project Config Migration (All Pipelines)

<!-- <section-updated last-updated="2026-04-02T12:00:00Z" updated-by="Claude" /> -->

`migrateProjectConfig` in all four pipelines orchestrates two independent sub-migration groups for each project:

| Group | Steps | API touched | Depends on the other? |
|---|---|---|---|
| Settings block | Project settings, tags, links, new code periods, DevOps binding | `/api/settings/set`, `/api/project_links/create`, etc. | No |
| Gates block | Quality gate assignment, quality profiles, permissions | `/api/qualitygates/select`, `/api/permissions/add_group`, etc. | No |

Because neither group reads or writes state shared by the other, they are dispatched concurrently via `Promise.all`:

```
await Promise.all([
  migrateProjectConfigSettings(...),   // 5 parallel sub-steps internally
  migrateProjectConfigGates(...),      // 3 parallel sub-steps internally
]);
```

### Implementation

- `src/pipelines/sq-10.4/pipeline/project-migration/helpers/migrate-project-config.js`
- `src/pipelines/sq-10.0/pipeline/project-migration/helpers/migrate-project-config.js`
- `src/pipelines/sq-2025/pipeline/project-config-migrator/helpers/migrate-project-config.js`
- `src/pipelines/sq-9.9/pipeline/project-migration/helpers/migrate-project-config.js`

---

## 6. Parallel Migrator Operations

<!-- <section-updated last-updated="2026-04-02T12:00:00Z" updated-by="Claude" /> -->

All SonarCloud migrators now use `mapConcurrent` for concurrent API calls instead of sequential `for...await` loops. Each operation uses `settled: true` mode so individual failures do not abort the batch.

| Migrator | Before | After | Concurrency |
|----------|--------|-------|-------------|
| Global permissions | Nested `for group → for perm → await` (N×M sequential) | `flatMap` + `mapConcurrent` (single batch) | 10 |
| Project permissions | Nested `for group → for perm → await` (N×M sequential) | `flatMap` + `mapConcurrent` (single batch) | 10 |
| Project settings | `for setting → await` (50-200 sequential) | `mapConcurrent` | 10 |
| Quality gates | `for gate → await create` (sequential) | `mapConcurrent` | 5 |
| Gate assignments | `for project → await assign` (sequential) | filter + `mapConcurrent` | 10 |
| Permission templates | `for template → await` (sequential) | `mapConcurrent` | 5 |
| Quality profiles | `for chain → for profile → await` (nested sequential) | `mapConcurrent` across chains, sequential within | 5 |
| Portfolios | `for portfolio → await` (sequential) | `mapConcurrent` | 5 |
| Report generation | Sequential text then PDF | `Promise.all([text, pdf])` | 2 |
| QG detail extraction | `for gate → await details` (sequential) | `mapConcurrent` | 5 |

### Implementation

Applied across all 4 pipelines: `sq-9.9`, `sq-10.0`, `sq-10.4`, `sq-2025`.

---

## 4. Protobuf Report Encoding

<!-- <section-updated last-updated="2026-01-01T00:00:00Z" updated-by="Claude" /> -->

SonarCloud's Compute Engine accepts analysis reports encoded as protobuf-over-zip, matching the format produced by SonarScanner. CloudVoyager reconstructs this format without running an actual scan.

### Encoding Pipeline

```
1. Fetch all issues, hotspots, measures from SonarQube API
2. Map each entity to the corresponding protobuf message type
   (ScannerReport.Issue, ScannerReport.Hotspot, ScannerReport.Measure, …)
3. Write one binary protobuf file per component (source file / module)
4. Bundle all component files + metadata.pb + component-X.pb into a ZIP
5. POST the ZIP to /api/ce/submit with the project key and organization
```

The protobuf schemas were reverse-engineered from the SonarScanner source and are re-implemented as hand-written binary encoders (no generated code).

### Implementation

`src/pipelines/<version>/transfer-pipeline/` — per-version protobuf builder
`src/pipelines/<version>/sonarcloud/api/` — SonarCloud upload client
