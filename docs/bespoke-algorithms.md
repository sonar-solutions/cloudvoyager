# Bespoke Algorithms

<!-- <doc-updated last-updated="2026-04-21T00:00:00Z" updated-by="Claude" /> -->

This document describes custom, non-trivial algorithms implemented from scratch within CloudVoyager — logic that required deliberate design decisions rather than off-the-shelf solutions.

---

## Table of Contents

1. [Date-Window Slicing (10K+ Issue Retrieval)](#1-date-window-slicing-10k-issue-retrieval)
2. [Migration Graph Visualization (Desktop DAG Renderer)](#2-migration-graph-visualization-desktop-dag-renderer)
3. [Atomic Checkpoint Journal](#3-atomic-checkpoint-journal)
4. [Protobuf Report Encoding](#4-protobuf-report-encoding)
5. [Issue Batch Distribution (Upload-Side 10K Mitigation)](#5-issue-batch-distribution-upload-side-10k-mitigation)

---

## 1. Date-Window Slicing (10K+ Issue Retrieval)

<!-- <section-updated last-updated="2026-01-01T00:00:00Z" updated-by="Claude" /> -->

SonarQube's `/api/issues/search` endpoint caps results at 10,000 items per query. Projects with large issue counts require the response window to be sliced by creation date and results stitched together.

### Algorithm

```
fetchWithSlicing(projectKey, params):
  1. Probe the total count for the full date range
  2. If total <= 10,000 → return single fetch
  3. Otherwise bisect the date window:
     a. Split [startDate, endDate] at the midpoint
     b. Recurse on each half
     c. Merge and deduplicate results by issue key
  4. Continue splitting until each window fits under 10,000
```

### Implementation

`src/shared/utils/search-slicer/index.js` — orchestrator
`src/shared/utils/search-slicer/helpers/bisect-window.js` — binary split
`src/shared/utils/search-slicer/helpers/build-windows.js` — initial partition
`src/shared/utils/search-slicer/helpers/fetch-window.js` — single window fetch
`src/shared/utils/search-slicer/helpers/merge-results.js` — deduplication

---

## 2. Migration Graph Visualization (Desktop DAG Renderer)

<!-- <section-updated last-updated="2026-04-01T00:00:00Z" updated-by="Claude" /> -->

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

## 5. SCM Date-Bucket Distribution (Upload-Side 10K Mitigation)

<!-- updated: 2026-04-23_14:46:00 -->

### Problem

SonarCloud's Elasticsearch visualization layer caps results at **10,000 issues per date bucket**. When CloudVoyager migrates a branch, the scanner report is uploaded with a single `analysis_date`. If the branch carries more than 10K issues, only the first 10,000 are visible in the SonarCloud UI — the rest silently disappear from the Issues tab. This is an ES index-time bucketing limitation, not an API pagination issue, so it cannot be solved client-side.

### Why Multi-Analysis Batching Failed

The original approach split issues across multiple scanner report uploads with distinct analysis dates. This failed because SonarCloud's CE issue tracker treats each analysis as a **complete snapshot** — issues from prior analyses not present in the current one are **closed**. Only the last batch's issues survived, silently destroying all prior batches' data.

### Current Solution: Single-Analysis SCM Backdating

All issues are uploaded in a **single analysis**. The CE assigns issue creation dates from SCM blame data, so by modifying the changeset blame dates per file, we control which date bucket each issue lands in — all within one report.

### Algorithm

```
backdateChangesets(extractedData):
  issues = extractedData.issues
  IF issues.length <= 5000: RETURN   // no-op for small projects

  baseDate = extractedData.metadata.extractedAt

  // Sort issues by file so files are contiguous
  issues.sort(by component key)

  // Group files into batches of ≤5K issues (no file splitting)
  fileBatches = buildFileBatches(issues)
  IF fileBatches.length <= 1: RETURN

  // Backdate ALL lines of each file in non-final batches
  FOR EACH batch (except last):
    batchDate = computeBatchDate(baseDate, batchIdx, totalBatches)
    FOR EACH file IN batch:
      changeset = extractedData.changesets.get(file)
      changeset.changesets = [{ revision: batchRevision, author: stub, date: batchDate }]
      changeset.changesetIndexByLine.fill(0)  // all lines → single backdated entry

  // Last batch keeps original dates (untouched)
```

### Critical Insight: Full-File Backdating

Setting only individual issue lines is **insufficient**. The CE uses the MAX of SCM dates across an issue's line range — surrounding lines with the current date override any backdated line. The solution sets **every line** of each file to the batch date, ensuring the CE has no newer line to fall back on.

### Key Invariants

- **Batch size = 5,000 (constant)** — 50% safety margin under the 10K ES limit.
- **Single analysis** — all issues uploaded in one report, preserving data integrity. No CE issue tracker conflicts.
- **File-level granularity** — all lines of a file share the same batch date. Files are never split across batches.
- **30-day spacing** — batches are spaced 30 days apart (via `computeBatchDate`) for clear separation in the SonarCloud UI date facet.
- **Last batch untouched** — the final batch keeps original SCM dates; only earlier batches are backdated.
- **`shouldBatch` always returns false** — multi-analysis batching is permanently disabled. `backdateChangesets()` is called unconditionally before protobuf build; it no-ops when issues ≤ 5K.

### Example

A branch with 31,641 issues extracted on 2026-04-23:

| Batch | Files | Issues | SCM Blame Date |
|-------|-------|--------|----------------|
| 1/7 | Files A–F | ~4,854 | Oct 2025 |
| 2/7 | Files G–K | ~4,816 | Nov 2025 |
| 3/7 | Files L–P | ~4,959 | Dec 2025 |
| 4/7 | Files Q–T | ~4,767 | Jan 2026 |
| 5/7 | Files U–W | ~4,921 | Feb 2026 |
| 6/7 | Files X–Y | ~4,958 | Mar 2026 |
| 7/7 | Files Z+ | ~2,366 | Apr 2026 (original) |

### Pipeline Integration

All 6 pipeline `transfer-branch` entry points call `backdateChangesets(extractedData)` before `buildProtobufMessages()`. The function is a no-op for projects with ≤5K issues.

```
transfer-branch.js
  └── backdateChangesets(extractedData)   // mutates SCM dates in-place
  └── buildProtobufMessages(extractedData)
  └── encodeAndUpload(messages)
```

### Implementation Files

| File | Role |
|------|------|
| `src/shared/utils/batch-distributor/helpers/backdate-changesets.js` | Core: sorts issues by file, groups into batches, backdates all lines per file |
| `src/shared/utils/batch-distributor/helpers/should-batch.js` | Exports `ISSUE_BATCH_SIZE` constant; `shouldBatch()` always returns false (multi-analysis disabled) |
| `src/shared/utils/batch-distributor/helpers/compute-batch-date.js` | Computes backdated ISO date per batch (30-day spacing) |

### Implementation

```
src/shared/utils/batch-distributor/
  index.js                                  — Re-exports all helpers
  helpers/
    should-batch.js                         — Gate: issues.length > 5000
    compute-batch-plan.js                   — Returns [{startIndex, endIndex, batchIndex, isLast}]
    compute-batch-date.js                   — Backdates: baseDate - N days
    create-batch-extracted-data.js          — Shallow clone with sliced issues + metadata override

src/pipelines/<version>/transfer-pipeline/helpers/
  transfer-branch.js                        — shouldBatch gate, delegates to batched or single path
  transfer-branch-batched.js                — Batch loop: build → encode → uploadAndWait per batch
```

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
