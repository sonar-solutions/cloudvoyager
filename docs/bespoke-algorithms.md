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

## 5. Accurate Issue Creation Date Backdating

<!-- updated: 2026-04-25_18:00:00 -->
<!-- <section-updated last-updated="2026-04-25T18:00:00Z" updated-by="Claude" /> -->

### Problem

SonarCloud's Compute Engine assigns creation dates to NEW issues from SCM blame data. Each file's changeset protobuf has `changesets[]` (array of `{revision, author, date}`) and `changesetIndexByLine[]` (maps each line to a changeset index). The CE takes **MAX(date)** across an issue's `textRange.startLine..endLine` to determine its creation date.

Without backdating, all issues in a migrated project would get the same creation date (the extraction timestamp). The goal is **1:1 accuracy** — each issue's creation date in SonarCloud should match its original `creationDate` from SonarQube. A 5K-per-day safety split handles rare cases where a single calendar day has >5K issues (SonarCloud's ES visualization cap is 10K per date bucket).

### Algorithm

```
backdateChangesets(extractedData):
  issues = extractedData.issues
  fallbackDate = extractedData.metadata.extractedAt || Date.now()

  // Phase 0: Safety split for oversized dates
  effectiveDates = Map<issueKey, dateMs>()
  dateGroups = group issues by creationDate (truncated to calendar day)
  FOR EACH (day, dayIssues) WHERE dayIssues.length > 5000:
    sort dayIssues by component
    subBatches = groupFilesIntoBatches(dayIssues, 5000)  // no file splitting
    FOR EACH subBatch (except last):
      syntheticDate = day - (totalBatches - 1 - batchIdx) * 1 day
      FOR EACH issue IN subBatch:
        effectiveDates.set(issue.key, syntheticDate)
    // Last sub-batch keeps original date

  // Phase 1: Per-file, per-line date map
  fileLineDates = Map<componentKey, Map<line(1-indexed), oldestDateMs>>
  FOR EACH issue:
    dateMs = effectiveDates[issue.key] ?? parse(issue.creationDate) ?? fallbackDate
    startLine = issue.textRange?.startLine || issue.line || 0
    endLine = issue.textRange?.endLine || startLine
    IF startLine <= 0: SKIP  // file-level issue
    FOR ln = startLine TO endLine:
      IF !fileLineDates[component][ln] OR dateMs < existing:
        fileLineDates[component][ln] = dateMs  // OLDEST wins

  // Phase 2: Rebuild changesets per file
  FOR EACH (compKey, lineDateMap) IN fileLineDates:
    cs = extractedData.changesets.get(compKey)
    IF !cs OR lineCount == 0: CONTINUE
    uniqueDates = sorted unique values from lineDateMap
    cs.changesets = one {revision, author, date} per unique date
    FOR EACH line i (0..lineCount-1):
      IF lineDateMap has (i+1): newIndexByLine[i] = dateToIndex[lineDateMap[i+1]]
      ELSE: newIndexByLine[i] = 0  // oldest date (safe default)
    cs.changesetIndexByLine = newIndexByLine
```

### Why "Oldest Wins" for Overlapping Lines

The CE takes MAX across a multi-line issue's range:
- **Older issue**: all its lines ≤ its date → MAX = its date (correct)
- **Newer issue**: overlapping lines have older date, but non-overlapping lines have its correct date → MAX = correct date (correct)
- **Exception**: newer issue entirely contained within older issue's range → inherits older date (unavoidable CE MAX limitation — rare for real code issues)

Non-issue lines default to the file's oldest issue date to prevent accidental MAX inflation for any multi-line issue spanning them.

### Key Invariants

- **All projects are backdated** — no early return for small projects. Every project gets accurate dates.
- **Per-line granularity** — each line in a file can have a different date, enabling multiple issues with different creation dates in the same file.
- **Safety split threshold = 5,000** — matches the `ISSUE_BATCH_SIZE` constant. Days exceeding this get sub-grouped with 1-day spacing.
- **No file splitting** — the safety split groups whole files into sub-batches; a file's issues are never split across different synthetic dates.
- **Fallback chain** — `effectiveDates[key]` → `parse(issue.creationDate)` → `extractedAt` → `Date.now()`.
- **Files with no issues unchanged** — only files appearing in `fileLineDates` get their changesets rewritten; others keep their original stub.

### Pipeline Integration

All 6 pipeline `transfer-branch` entry points call `backdateChangesets(extractedData)` before the protobuf build step. No signature change — the function mutates `extractedData.changesets` in place.

### Implementation

```
src/shared/utils/batch-distributor/helpers/
  backdate-changesets.js  — Per-line date backdating from issue.creationDate
  should-batch.js         — ISSUE_BATCH_SIZE constant (5000); shouldBatch() returns false

Legacy files (unchanged, no longer used by backdateChangesets):
  compute-batch-plan.js   — Returns batch descriptors with start/end indices
  compute-batch-date.js   — Computes 30-day-spaced backdated dates
  create-batch-extracted-data.js — Shallow clone with sliced issues
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
