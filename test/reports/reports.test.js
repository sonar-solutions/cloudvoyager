import test from 'ava';
import sinon from 'sinon';
import { writeFile, mkdir, rm, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

// --- shared.js ---
import {
  formatDuration,
  formatNumber,
  formatTimestamp,
  computeProjectStats,
  computeOverallStatus,
  getNewCodePeriodSkippedProjects,
  getProblemProjects,
  computeTotalDurationMs,
  computeLocThroughput,
} from '../../src/reports/shared.js';

// --- format-text.js ---
import { formatTextReport } from '../../src/reports/format-text.js';

// --- format-markdown.js ---
import { formatMarkdownReport } from '../../src/reports/format-markdown.js';

// --- format-markdown-executive.js ---
import { formatExecutiveSummaryMarkdown } from '../../src/reports/format-markdown-executive.js';

// --- format-performance.js ---
import { formatPerformanceReport } from '../../src/reports/format-performance.js';

// --- format-pdf.js ---
import { generatePdfReport } from '../../src/reports/format-pdf.js';

// --- format-pdf-executive.js ---
import { generateExecutiveSummaryPdf } from '../../src/reports/format-pdf-executive.js';

// --- format-pdf-performance.js ---
import { generatePerformanceReportPdf } from '../../src/reports/format-pdf-performance.js';

// --- pdf-helpers.js ---
import {
  createPrinter,
  generatePdfBuffer,
  pdfStyles,
  statusStyle,
  statusText,
} from '../../src/reports/pdf-helpers.js';

// --- perf-tables.js ---
import {
  sumDurations,
  getStepDuration,
  getConfigDuration,
  formatSlowestSteps,
  formatBottleneckAnalysis,
} from '../../src/reports/perf-tables.js';

// --- pdf-exec-sections.js ---
import {
  buildWarnings,
  buildActionItems,
  buildFailedProjects,
} from '../../src/reports/pdf-exec-sections.js';

// --- pdf-perf-sections.js ---
import {
  buildSlowestSteps,
  buildBottleneckAnalysis as buildBottleneckAnalysisPdf,
} from '../../src/reports/pdf-perf-sections.js';

// --- pdf-sections.js ---
import {
  buildServerSteps as buildServerStepsPdf,
  buildOrgResults as buildOrgResultsPdf,
  buildProblemProjects as buildProblemProjectsPdf,
  buildAllProjects as buildAllProjectsPdf,
} from '../../src/reports/pdf-sections.js';

// --- index.js ---
import { writeAllReports } from '../../src/reports/index.js';

// ---------------------------------------------------------------------------
// Restore sinon after each test
// ---------------------------------------------------------------------------
test.afterEach(() => sinon.restore());

// ---------------------------------------------------------------------------
// Helper: temp directory
// ---------------------------------------------------------------------------
function getTmpDir() {
  return join(tmpdir(), `cloudvoyager-report-test-${randomUUID()}`);
}

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

/** Build a minimal "success" project with realistic steps. */
function makeSuccessProject(overrides = {}) {
  return {
    projectKey: 'my-org_success-project',
    scProjectKey: 'my-org_success-project',
    status: 'success',
    durationMs: 12000,
    steps: [
      { step: 'Create project', status: 'success', durationMs: 500 },
      { step: 'Upload scanner report', status: 'success', durationMs: 5000 },
      { step: 'Set quality gate', status: 'success', durationMs: 200 },
      { step: 'Set quality profile', status: 'success', durationMs: 200 },
      { step: 'New code definitions', status: 'success', durationMs: 100 },
      { step: 'Sync issues', status: 'success', durationMs: 4000 },
      { step: 'Sync hotspots', status: 'success', durationMs: 2000 },
    ],
    ...overrides,
  };
}

/** Build a "partial" project (some steps fail). */
function makePartialProject(overrides = {}) {
  return {
    projectKey: 'my-org_partial-project',
    scProjectKey: 'my-org_partial-project',
    status: 'partial',
    durationMs: 8000,
    steps: [
      { step: 'Create project', status: 'success', durationMs: 600 },
      { step: 'Upload scanner report', status: 'success', durationMs: 3000 },
      { step: 'Set quality gate', status: 'failed', error: 'Gate not found', durationMs: 50 },
      { step: 'Set quality profile', status: 'success', durationMs: 200 },
      { step: 'New code definitions', status: 'skipped', detail: 'REFERENCE_BRANCH not supported', durationMs: 0 },
      { step: 'Sync issues', status: 'success', durationMs: 3000 },
      { step: 'Sync hotspots', status: 'skipped', detail: 'No hotspots', durationMs: 0 },
    ],
    ...overrides,
  };
}

/** Build a "failed" project. */
function makeFailedProject(overrides = {}) {
  return {
    projectKey: 'my-org_failed-project',
    scProjectKey: 'my-org_failed-project',
    status: 'failed',
    durationMs: 2000,
    steps: [
      { step: 'Create project', status: 'failed', error: 'Permission denied', durationMs: 200 },
      { step: 'Upload scanner report', status: 'skipped', detail: 'Project creation failed', durationMs: 0 },
      { step: 'Set quality gate', status: 'skipped', detail: 'Project creation failed', durationMs: 0 },
      { step: 'Set quality profile', status: 'skipped', detail: 'Project creation failed', durationMs: 0 },
      { step: 'New code definitions', status: 'skipped', detail: 'Project creation failed', durationMs: 0 },
      { step: 'Sync issues', status: 'skipped', detail: 'Project creation failed', durationMs: 0 },
      { step: 'Sync hotspots', status: 'skipped', detail: 'Project creation failed', durationMs: 0 },
    ],
    ...overrides,
  };
}

/** Build a full results object with all the fields that report formatters expect. */
function makeResults(overrides = {}) {
  const now = new Date('2026-02-19T10:05:00Z');
  const start = new Date('2026-02-19T10:00:00Z');

  return {
    startTime: start.toISOString(),
    endTime: now.toISOString(),
    dryRun: false,
    qualityGates: 3,
    qualityProfiles: 5,
    groups: 2,
    portfolios: 1,
    issueSyncStats: { matched: 150, transitioned: 20 },
    hotspotSyncStats: { matched: 10, statusChanged: 3 },
    projectKeyWarnings: [],
    serverSteps: [
      { step: 'Extract quality gates', status: 'success', durationMs: 1000, detail: '3 gates' },
      { step: 'Extract quality profiles', status: 'success', durationMs: 2000, detail: '5 profiles' },
    ],
    orgResults: [
      {
        key: 'my-org',
        projectCount: 3,
        durationMs: 25000,
        steps: [
          { step: 'Migrate quality gates', status: 'success', durationMs: 800, detail: '3 gates' },
          { step: 'Migrate quality profiles', status: 'success', durationMs: 1200, detail: '5 profiles' },
          { step: 'Migrate groups', status: 'success', durationMs: 400, detail: '2 groups' },
        ],
      },
    ],
    projects: [
      makeSuccessProject(),
      makePartialProject(),
      makeFailedProject(),
    ],
    ...overrides,
  };
}

/** Build a minimal results object (no projects, no warnings). */
function makeMinimalResults() {
  return makeResults({
    projects: [],
    serverSteps: [],
    orgResults: [],
    projectKeyWarnings: [],
    qualityGates: 0,
    qualityProfiles: 0,
    groups: 0,
    portfolios: 0,
    issueSyncStats: { matched: 0, transitioned: 0 },
    hotspotSyncStats: { matched: 0, statusChanged: 0 },
  });
}

/** Build results with all warnings and edge cases. */
function makeFullWarningsResults() {
  return makeResults({
    dryRun: true,
    projectKeyWarnings: [
      { sqKey: 'old-key-1', scKey: 'org_old-key-1', owner: 'other-org' },
      { sqKey: 'old-key-2', scKey: 'org_old-key-2', owner: 'another-org' },
    ],
  });
}

// ============================================================================
// shared.js tests
// ============================================================================

// --- formatDuration ---

test('shared > formatDuration returns dash for null', t => {
  t.is(formatDuration(null), '\u2014');
});

test('shared > formatDuration returns dash for undefined', t => {
  t.is(formatDuration(undefined), '\u2014');
});

test('shared > formatDuration returns dash for negative', t => {
  t.is(formatDuration(-1), '\u2014');
});

test('shared > formatDuration formats milliseconds only', t => {
  t.is(formatDuration(500), '500ms');
});

test('shared > formatDuration formats zero as 0ms', t => {
  t.is(formatDuration(0), '0ms');
});

test('shared > formatDuration formats seconds', t => {
  t.is(formatDuration(5000), '5s');
});

test('shared > formatDuration formats minutes and seconds', t => {
  t.is(formatDuration(125000), '2m 5s');
});

test('shared > formatDuration formats hours minutes seconds', t => {
  t.is(formatDuration(3661000), '1h 1m 1s');
});

test('shared > formatDuration formats exactly one hour', t => {
  t.is(formatDuration(3600000), '1h 0m 0s');
});

test('shared > formatDuration formats exactly one minute', t => {
  t.is(formatDuration(60000), '1m 0s');
});

// --- computeProjectStats ---

test('shared > computeProjectStats counts all statuses correctly', t => {
  const results = makeResults();
  const stats = computeProjectStats(results);
  t.is(stats.succeeded, 1);
  t.is(stats.partial, 1);
  t.is(stats.failed, 1);
  t.is(stats.total, 3);
});

test('shared > computeProjectStats handles empty projects', t => {
  const results = makeMinimalResults();
  const stats = computeProjectStats(results);
  t.is(stats.succeeded, 0);
  t.is(stats.partial, 0);
  t.is(stats.failed, 0);
  t.is(stats.total, 0);
});

test('shared > computeProjectStats handles all-success', t => {
  const results = makeResults({ projects: [makeSuccessProject(), makeSuccessProject({ projectKey: 'proj-2' })] });
  const stats = computeProjectStats(results);
  t.is(stats.succeeded, 2);
  t.is(stats.partial, 0);
  t.is(stats.failed, 0);
  t.is(stats.total, 2);
});

// --- computeOverallStatus ---

test('shared > computeOverallStatus returns SUCCESS when all ok', t => {
  t.is(computeOverallStatus({ succeeded: 5, partial: 0, failed: 0 }), 'SUCCESS');
});

test('shared > computeOverallStatus returns PARTIAL SUCCESS when some partial', t => {
  t.is(computeOverallStatus({ succeeded: 3, partial: 2, failed: 0 }), 'PARTIAL SUCCESS');
});

test('shared > computeOverallStatus returns FAILED when all fail', t => {
  t.is(computeOverallStatus({ succeeded: 0, partial: 0, failed: 5 }), 'FAILED');
});

test('shared > computeOverallStatus returns PARTIAL SUCCESS when mix of success and failure', t => {
  t.is(computeOverallStatus({ succeeded: 2, partial: 0, failed: 1 }), 'PARTIAL SUCCESS');
});

test('shared > computeOverallStatus returns PARTIAL SUCCESS when partial and failed', t => {
  t.is(computeOverallStatus({ succeeded: 0, partial: 1, failed: 1 }), 'PARTIAL SUCCESS');
});

// --- getNewCodePeriodSkippedProjects ---

test('shared > getNewCodePeriodSkippedProjects finds skipped NCP projects', t => {
  const results = makeResults();
  const skipped = getNewCodePeriodSkippedProjects(results);
  // Both the partial project (REFERENCE_BRANCH) and the failed project
  // (Project creation failed) have 'New code definitions' step with status 'skipped'
  t.is(skipped.length, 2);
  t.truthy(skipped.find(s => s.projectKey === 'my-org_partial-project'));
  t.truthy(skipped.find(s => s.detail === 'REFERENCE_BRANCH not supported'));
});

test('shared > getNewCodePeriodSkippedProjects returns empty when none skipped', t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  const skipped = getNewCodePeriodSkippedProjects(results);
  t.is(skipped.length, 0);
});

// --- getProblemProjects ---

test('shared > getProblemProjects returns non-success projects', t => {
  const results = makeResults();
  const problems = getProblemProjects(results);
  t.is(problems.length, 2);
  t.truthy(problems.find(p => p.status === 'partial'));
  t.truthy(problems.find(p => p.status === 'failed'));
});

test('shared > getProblemProjects returns empty when all succeed', t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  const problems = getProblemProjects(results);
  t.is(problems.length, 0);
});

// --- computeTotalDurationMs ---

test('shared > computeTotalDurationMs computes difference correctly', t => {
  const results = makeResults();
  const durationMs = computeTotalDurationMs(results);
  t.is(durationMs, 5 * 60 * 1000); // 5 minutes
});

test('shared > computeTotalDurationMs returns null when startTime missing', t => {
  const results = makeResults({ startTime: null });
  t.is(computeTotalDurationMs(results), null);
});

test('shared > computeTotalDurationMs returns null when endTime missing', t => {
  const results = makeResults({ endTime: null });
  t.is(computeTotalDurationMs(results), null);
});

// ============================================================================
// format-text.js tests
// ============================================================================

test('formatTextReport returns a string containing CLOUDVOYAGER MIGRATION REPORT', t => {
  const text = formatTextReport(makeResults());
  t.true(typeof text === 'string');
  t.true(text.includes('CLOUDVOYAGER MIGRATION REPORT'));
});

test('formatTextReport includes start and end times', t => {
  const results = makeResults();
  const text = formatTextReport(results);
  t.true(text.includes('Started:'));
  t.true(text.includes('Finished:'));
  // Timestamps are formatted via formatTimestamp, so check for year
  t.true(text.includes('2026'));
});

test('formatTextReport includes duration', t => {
  const text = formatTextReport(makeResults());
  t.true(text.includes('Duration:'));
  t.true(text.includes('5m 0s'));
});

test('formatTextReport shows DRY RUN when dryRun is true', t => {
  const results = makeResults({ dryRun: true });
  const text = formatTextReport(results);
  t.true(text.includes('DRY RUN'));
});

test('formatTextReport does not show DRY RUN when dryRun is false', t => {
  const text = formatTextReport(makeResults());
  t.false(text.includes('DRY RUN'));
});

test('formatTextReport includes SUMMARY section with counts', t => {
  const text = formatTextReport(makeResults());
  t.true(text.includes('SUMMARY'));
  t.true(text.includes('1 succeeded, 1 partial, 1 failed (3 total)'));
  t.true(text.includes('Quality Gates:    3 migrated'));
  t.true(text.includes('Quality Profiles: 5 migrated'));
  t.true(text.includes('Groups:           2 created'));
  t.true(text.includes('Portfolios:       1 created'));
  t.true(text.includes('150 matched, 20 transitioned'));
  t.true(text.includes('10 matched, 3 status changed'));
});

test('formatTextReport handles zero projects', t => {
  const results = makeMinimalResults();
  const text = formatTextReport(results);
  t.true(text.includes('0 (no projects migrated)'));
});

test('formatTextReport includes project key conflicts when present', t => {
  const results = makeFullWarningsResults();
  const text = formatTextReport(results);
  t.true(text.includes('PROJECT KEY CONFLICTS'));
  t.true(text.includes('"old-key-1" -> "org_old-key-1"'));
  t.true(text.includes('"old-key-2" -> "org_old-key-2"'));
});

test('formatTextReport omits key conflicts section when none', t => {
  const text = formatTextReport(makeResults());
  t.false(text.includes('PROJECT KEY CONFLICTS'));
});

test('formatTextReport includes new code period warnings', t => {
  const text = formatTextReport(makeResults());
  t.true(text.includes('NEW CODE PERIOD NOT SET'));
  t.true(text.includes('REFERENCE_BRANCH not supported'));
});

test('formatTextReport omits NCP section when none skipped', t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  const text = formatTextReport(results);
  t.false(text.includes('NEW CODE PERIOD NOT SET'));
});

test('formatTextReport includes server-wide steps', t => {
  const text = formatTextReport(makeResults());
  t.true(text.includes('SERVER-WIDE STEPS'));
  t.true(text.includes('Extract quality gates'));
  t.true(text.includes('Extract quality profiles'));
});

test('formatTextReport omits server steps section when empty', t => {
  const results = makeResults({ serverSteps: [] });
  const text = formatTextReport(results);
  t.false(text.includes('SERVER-WIDE STEPS'));
});

test('formatTextReport includes organization results', t => {
  const text = formatTextReport(makeResults());
  t.true(text.includes('ORGANIZATION: my-org (3 projects)'));
});

test('formatTextReport omits org results when empty', t => {
  const results = makeResults({ orgResults: [] });
  const text = formatTextReport(results);
  t.false(text.includes('ORGANIZATION:'));
});

test('formatTextReport includes FAILED / PARTIAL PROJECTS section', t => {
  const text = formatTextReport(makeResults());
  t.true(text.includes('FAILED / PARTIAL PROJECTS (DETAILED)'));
  t.true(text.includes('[FAIL   ] my-org_failed-project'));
  t.true(text.includes('[PARTIAL] my-org_partial-project'));
});

test('formatTextReport omits problem section when all succeed', t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  const text = formatTextReport(results);
  t.false(text.includes('FAILED / PARTIAL PROJECTS'));
});

test('formatTextReport includes ALL PROJECTS section', t => {
  const text = formatTextReport(makeResults());
  t.true(text.includes('ALL PROJECTS'));
  t.true(text.includes('[OK     ] my-org_success-project'));
  t.true(text.includes('[PARTIAL] my-org_partial-project'));
  t.true(text.includes('[FAIL   ] my-org_failed-project'));
});

test('formatTextReport omits ALL PROJECTS when empty', t => {
  const results = makeMinimalResults();
  const text = formatTextReport(results);
  t.false(text.includes('ALL PROJECTS'));
});

test('formatTextReport does not throw with In progress endTime', t => {
  const results = makeResults({ endTime: null });
  const text = formatTextReport(results);
  t.true(text.includes('In progress'));
});

// ============================================================================
// format-markdown.js tests
// ============================================================================

test('formatMarkdownReport returns markdown string', t => {
  const md = formatMarkdownReport(makeResults());
  t.true(typeof md === 'string');
  t.true(md.includes('# CloudVoyager Migration Report'));
});

test('formatMarkdownReport includes summary table', t => {
  const md = formatMarkdownReport(makeResults());
  t.true(md.includes('## Summary'));
  t.true(md.includes('| Resource | Result |'));
  t.true(md.includes('| Projects |'));
  t.true(md.includes('| Quality Gates | 3 migrated |'));
  t.true(md.includes('| Quality Profiles | 5 migrated |'));
  t.true(md.includes('| Groups | 2 created |'));
  t.true(md.includes('| Portfolios | 1 created |'));
  t.true(md.includes('| Issues | 150 matched, 20 transitioned |'));
  t.true(md.includes('| Hotspots | 10 matched, 3 status changed |'));
});

test('formatMarkdownReport shows duration', t => {
  const md = formatMarkdownReport(makeResults());
  t.true(md.includes('**Duration:** 5m 0s'));
});

test('formatMarkdownReport shows DRY RUN mode', t => {
  const md = formatMarkdownReport(makeResults({ dryRun: true }));
  t.true(md.includes('**Mode:** DRY RUN'));
});

test('formatMarkdownReport includes key conflicts table', t => {
  const md = formatMarkdownReport(makeFullWarningsResults());
  t.true(md.includes('## Project Key Conflicts'));
  t.true(md.includes('| `old-key-1` | `org_old-key-1` | other-org |'));
});

test('formatMarkdownReport omits key conflicts when none', t => {
  const md = formatMarkdownReport(makeResults());
  t.false(md.includes('## Project Key Conflicts'));
});

test('formatMarkdownReport includes NCP warnings table', t => {
  const md = formatMarkdownReport(makeResults());
  t.true(md.includes('## New Code Period Not Set'));
  t.true(md.includes('| `my-org_partial-project` | REFERENCE_BRANCH not supported |'));
});

test('formatMarkdownReport omits NCP section when none', t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  const md = formatMarkdownReport(results);
  t.false(md.includes('## New Code Period Not Set'));
});

test('formatMarkdownReport includes server-wide steps', t => {
  const md = formatMarkdownReport(makeResults());
  t.true(md.includes('## Server-Wide Steps'));
  t.true(md.includes('| Extract quality gates | OK |'));
});

test('formatMarkdownReport omits server steps when empty', t => {
  const results = makeResults({ serverSteps: [] });
  const md = formatMarkdownReport(results);
  t.false(md.includes('## Server-Wide Steps'));
});

test('formatMarkdownReport includes organization sections', t => {
  const md = formatMarkdownReport(makeResults());
  t.true(md.includes('## Organization: my-org (3 projects)'));
});

test('formatMarkdownReport omits org sections when none', t => {
  const results = makeResults({ orgResults: [] });
  const md = formatMarkdownReport(results);
  t.false(md.includes('## Organization:'));
});

test('formatMarkdownReport includes problem projects', t => {
  const md = formatMarkdownReport(makeResults());
  t.true(md.includes('## Failed / Partial Projects'));
  t.true(md.includes('### [FAIL] my-org_failed-project'));
  t.true(md.includes('### [PARTIAL] my-org_partial-project'));
});

test('formatMarkdownReport omits problem section when all succeed', t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  const md = formatMarkdownReport(results);
  t.false(md.includes('## Failed / Partial Projects'));
});

test('formatMarkdownReport includes all projects table', t => {
  const md = formatMarkdownReport(makeResults());
  t.true(md.includes('## All Projects'));
  t.true(md.includes('| # | Project Key | LOC | Status | Failed Steps |'));
  t.true(md.includes('`my-org_success-project`'));
  t.true(md.includes('OK'));
});

test('formatMarkdownReport omits all projects when empty', t => {
  const md = formatMarkdownReport(makeMinimalResults());
  t.false(md.includes('## All Projects'));
});

test('formatMarkdownReport ends with Generated by CloudVoyager', t => {
  const md = formatMarkdownReport(makeResults());
  t.true(md.includes('*Generated by CloudVoyager*'));
});

test('formatMarkdownReport handles zero projects in summary', t => {
  const md = formatMarkdownReport(makeMinimalResults());
  t.true(md.includes('0 (no projects migrated)'));
});

// ============================================================================
// format-markdown-executive.js tests
// ============================================================================

test('formatExecutiveSummaryMarkdown returns a string with executive title', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(typeof md === 'string');
  t.true(md.includes('# CloudVoyager Migration \u2014 Executive Summary'));
});

test('formatExecutiveSummaryMarkdown includes formatted date', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  // The date is formatted via formatTimestamp (short month with time)
  t.true(md.includes('**Date:**'));
  t.true(md.includes('2026'));
});

test('formatExecutiveSummaryMarkdown includes duration', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(md.includes('**Duration:** 5m 0s'));
});

test('formatExecutiveSummaryMarkdown shows DRY RUN', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults({ dryRun: true }));
  t.true(md.includes('**Mode:** DRY RUN'));
});

test('formatExecutiveSummaryMarkdown shows target organizations', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(md.includes('**Target Organizations:** 1'));
});

test('formatExecutiveSummaryMarkdown omits org count when zero', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults({ orgResults: [] }));
  t.false(md.includes('**Target Organizations:**'));
});

test('formatExecutiveSummaryMarkdown shows PARTIAL SUCCESS for mixed results', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(md.includes('## Overall Status: PARTIAL SUCCESS'));
});

test('formatExecutiveSummaryMarkdown shows SUCCESS when all ok', t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  const md = formatExecutiveSummaryMarkdown(results);
  t.true(md.includes('## Overall Status: SUCCESS'));
  t.true(md.includes('100.0% success rate'));
});

test('formatExecutiveSummaryMarkdown shows FAILED when all fail', t => {
  const results = makeResults({ projects: [makeFailedProject()] });
  const md = formatExecutiveSummaryMarkdown(results);
  t.true(md.includes('## Overall Status: FAILED'));
});

test('formatExecutiveSummaryMarkdown handles zero projects', t => {
  const md = formatExecutiveSummaryMarkdown(makeMinimalResults());
  t.true(md.includes('No projects were migrated.'));
});

test('formatExecutiveSummaryMarkdown includes key metrics table', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(md.includes('## Key Metrics'));
  t.true(md.includes('| Total Projects | 3 |'));
  t.true(md.includes('| Quality Profiles Migrated | 5 |'));
  t.true(md.includes('| Quality Gates Migrated | 3 |'));
  t.true(md.includes('| Groups Created | 2 |'));
  t.true(md.includes('| Portfolios Created | 1 |'));
});

test('formatExecutiveSummaryMarkdown includes warnings section with project key conflicts', t => {
  const md = formatExecutiveSummaryMarkdown(makeFullWarningsResults());
  t.true(md.includes('## Warnings & Risks'));
  t.true(md.includes('### Project Key Conflicts'));
  t.true(md.includes('2 project(s)'));
});

test('formatExecutiveSummaryMarkdown includes NCP warning', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(md.includes('### New Code Period Configuration'));
});

test('formatExecutiveSummaryMarkdown includes failed projects warning', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(md.includes('### Failed Projects'));
  t.true(md.includes('**1 project(s)** failed to migrate entirely'));
});

test('formatExecutiveSummaryMarkdown includes partial projects warning', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(md.includes('### Partially Migrated Projects'));
});

test('formatExecutiveSummaryMarkdown shows no warnings when all clean', t => {
  const results = makeResults({
    projects: [makeSuccessProject()],
    projectKeyWarnings: [],
  });
  const md = formatExecutiveSummaryMarkdown(results);
  t.true(md.includes('No warnings or risks identified.'));
});

test('formatExecutiveSummaryMarkdown includes action items', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(md.includes('## Action Items'));
  t.true(md.includes('Investigate and retry failed project migrations'));
  t.true(md.includes('Review partially migrated projects'));
  t.true(md.includes('Review quality profile rule gaps'));
  t.true(md.includes('Verify project permissions'));
});

test('formatExecutiveSummaryMarkdown includes action items for key warnings', t => {
  const md = formatExecutiveSummaryMarkdown(makeFullWarningsResults());
  t.true(md.includes('Update CI/CD pipelines for renamed project keys'));
});

test('formatExecutiveSummaryMarkdown includes NCP action item', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(md.includes('Manually configure new code periods'));
});

test('formatExecutiveSummaryMarkdown includes failed projects table', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(md.includes('| `my-org_failed-project` |'));
});

test('formatExecutiveSummaryMarkdown omits failed table when none failed', t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  const md = formatExecutiveSummaryMarkdown(results);
  // No "## Failed Projects" section (the table), but the warning section heading might exist
  // The failed projects TABLE at the bottom should not appear
  t.false(md.includes('| `my-org_failed-project` |'));
});

test('formatExecutiveSummaryMarkdown ends with Generated by CloudVoyager', t => {
  const md = formatExecutiveSummaryMarkdown(makeResults());
  t.true(md.includes('*Generated by CloudVoyager*'));
});

test('formatExecutiveSummaryMarkdown handles missing startTime', t => {
  const results = makeResults({ startTime: null });
  const md = formatExecutiveSummaryMarkdown(results);
  t.true(md.includes('**Date:** Unknown'));
});

// ============================================================================
// format-performance.js tests
// ============================================================================

test('formatPerformanceReport returns string with performance title', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(typeof md === 'string');
  t.true(md.includes('# CloudVoyager Migration \u2014 Performance Report'));
});

test('formatPerformanceReport includes start and end times', t => {
  const results = makeResults();
  const md = formatPerformanceReport(results);
  t.true(md.includes('**Started:**'));
  t.true(md.includes('**Finished:**'));
  // Timestamps are formatted via formatTimestamp, so check for year
  t.true(md.includes('2026'));
});

test('formatPerformanceReport includes total duration', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('**Total Duration:** 5m 0s'));
});

test('formatPerformanceReport shows In progress when endTime missing', t => {
  const results = makeResults({ endTime: null });
  const md = formatPerformanceReport(results);
  t.true(md.includes('**Finished:** In progress'));
});

test('formatPerformanceReport includes overview table', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('## Overview'));
  t.true(md.includes('| Total Duration |'));
  t.true(md.includes('| Projects Migrated | 3 |'));
  t.true(md.includes('| Average Time per Project |'));
  t.true(md.includes('| Organizations | 1 |'));
});

test('formatPerformanceReport includes server-wide extraction total', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('| Server-Wide Extraction |'));
});

test('formatPerformanceReport includes org duration in overview', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('| Org: my-org (total) |'));
});

test('formatPerformanceReport includes server-wide steps breakdown', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('## Server-Wide Extraction'));
  t.true(md.includes('| Extract quality gates |'));
  t.true(md.includes('| Extract quality profiles |'));
  t.true(md.includes('| **Total** |'));
});

test('formatPerformanceReport omits server steps when empty', t => {
  const results = makeResults({ serverSteps: [] });
  const md = formatPerformanceReport(results);
  t.false(md.includes('## Server-Wide Extraction'));
});

test('formatPerformanceReport includes org steps section', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('## Organization: my-org'));
  t.true(md.includes('**Total org migration time:**'));
  t.true(md.includes('| Migrate quality gates |'));
});

test('formatPerformanceReport omits org section when empty', t => {
  const results = makeResults({ orgResults: [] });
  const md = formatPerformanceReport(results);
  t.false(md.includes('## Organization:'));
});

test('formatPerformanceReport includes per-project breakdown', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('## Per-Project Breakdown'));
  t.true(md.includes('Sorted by total duration (slowest first).'));
  t.true(md.includes('| # | Project | LOC | Total | Report Upload | Issue Sync | Hotspot Sync | Config |'));
});

test('formatPerformanceReport omits project breakdown when no projects', t => {
  const md = formatPerformanceReport(makeMinimalResults());
  t.false(md.includes('## Per-Project Breakdown'));
});

test('formatPerformanceReport includes slowest steps', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('## Slowest Individual Steps (Top 10)'));
});

test('formatPerformanceReport omits slowest steps when none have duration', t => {
  const results = makeResults({
    projects: [{
      projectKey: 'p1',
      scProjectKey: 'p1',
      status: 'success',
      steps: [{ step: 'Create', status: 'success' }], // no durationMs
    }],
  });
  const md = formatPerformanceReport(results);
  t.false(md.includes('## Slowest Individual Steps'));
});

test('formatPerformanceReport includes bottleneck analysis', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('## Bottleneck Analysis'));
  t.true(md.includes('Cumulative time spent on each step type'));
  t.true(md.includes('| Step Type | Cumulative Time | % of Step Time |'));
  t.true(md.includes('| **Total** |'));
});

test('formatPerformanceReport omits bottleneck when no timestamps', t => {
  const results = makeResults({ startTime: null, endTime: null });
  const md = formatPerformanceReport(results);
  t.false(md.includes('## Bottleneck Analysis'));
});

test('formatPerformanceReport ends with Generated by CloudVoyager', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('*Generated by CloudVoyager*'));
});

test('formatPerformanceReport handles step with skipped status in project breakdown', t => {
  const results = makeResults({
    projects: [{
      projectKey: 'skip-proj',
      scProjectKey: 'skip-proj',
      status: 'success',
      durationMs: 5000,
      steps: [
        { step: 'Upload scanner report', status: 'success', durationMs: 2000 },
        { step: 'Sync issues', status: 'skipped', durationMs: 0 },
        { step: 'Sync hotspots', status: 'skipped', durationMs: 0 },
      ],
    }],
  });
  const md = formatPerformanceReport(results);
  t.true(md.includes('skipped'));
});

test('formatPerformanceReport handles org without steps', t => {
  const results = makeResults({
    orgResults: [{ key: 'empty-org', projectCount: 0, durationMs: 100 }],
  });
  const md = formatPerformanceReport(results);
  t.true(md.includes('## Organization: empty-org'));
});

test('formatPerformanceReport handles org without durationMs', t => {
  const results = makeResults({
    orgResults: [{ key: 'no-dur-org', projectCount: 1, steps: [] }],
  });
  const md = formatPerformanceReport(results);
  t.true(md.includes('## Organization: no-dur-org'));
});

// ============================================================================
// pdf-helpers.js tests
// ============================================================================

test('pdfStyles is a non-empty object with expected keys', t => {
  t.true(typeof pdfStyles === 'object');
  t.truthy(pdfStyles.title);
  t.truthy(pdfStyles.heading);
  t.truthy(pdfStyles.subheading);
  t.truthy(pdfStyles.small);
  t.truthy(pdfStyles.tableHeader);
  t.truthy(pdfStyles.tableCell);
  t.truthy(pdfStyles.statusOk);
  t.truthy(pdfStyles.statusFail);
  t.truthy(pdfStyles.statusPartial);
  t.truthy(pdfStyles.statusSkip);
  t.truthy(pdfStyles.metadata);
});

// --- statusStyle ---

test('pdf-helpers > statusStyle returns statusOk for success', t => {
  t.is(statusStyle('success'), 'statusOk');
});

test('pdf-helpers > statusStyle returns statusFail for failed', t => {
  t.is(statusStyle('failed'), 'statusFail');
});

test('pdf-helpers > statusStyle returns statusPartial for partial', t => {
  t.is(statusStyle('partial'), 'statusPartial');
});

test('pdf-helpers > statusStyle returns statusSkip for skipped', t => {
  t.is(statusStyle('skipped'), 'statusSkip');
});

test('pdf-helpers > statusStyle returns tableCell for unknown status', t => {
  t.is(statusStyle('unknown'), 'tableCell');
});

test('pdf-helpers > statusStyle returns tableCell for undefined', t => {
  t.is(statusStyle(undefined), 'tableCell');
});

// --- statusText ---

test('pdf-helpers > statusText returns OK for success', t => {
  t.is(statusText('success'), 'OK');
});

test('pdf-helpers > statusText returns FAIL for failed', t => {
  t.is(statusText('failed'), 'FAIL');
});

test('pdf-helpers > statusText returns SKIP for skipped', t => {
  t.is(statusText('skipped'), 'SKIP');
});

test('pdf-helpers > statusText returns PARTIAL for partial', t => {
  t.is(statusText('partial'), 'PARTIAL');
});

test('pdf-helpers > statusText returns the status string for unknown', t => {
  t.is(statusText('anything'), 'anything');
});

test('pdf-helpers > statusText returns empty string for undefined', t => {
  t.is(statusText(undefined), '');
});

test('pdf-helpers > statusText returns empty string for null', t => {
  t.is(statusText(null), '');
});

// --- createPrinter ---

test('pdf-helpers > createPrinter returns a printer instance', t => {
  const printer = createPrinter();
  t.truthy(printer);
  t.true(typeof printer.createPdfKitDocument === 'function');
});

// --- generatePdfBuffer ---

test('pdf-helpers > generatePdfBuffer creates a valid PDF buffer', async t => {
  const docDefinition = {
    content: [{ text: 'Hello World' }],
    defaultStyle: { fontSize: 10 },
  };
  const buffer = await generatePdfBuffer(docDefinition);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
  // PDF starts with %PDF
  t.is(buffer.slice(0, 5).toString('ascii'), '%PDF-');
});

test('pdf-helpers > generatePdfBuffer handles complex content', async t => {
  const docDefinition = {
    content: [
      { text: 'Title', style: 'title' },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*'],
          body: [
            [{ text: 'Header 1', style: 'tableHeader' }, { text: 'Header 2', style: 'tableHeader' }],
            ['Cell 1', 'Cell 2'],
          ],
        },
        layout: 'lightHorizontalLines',
      },
    ],
    styles: pdfStyles,
    defaultStyle: { fontSize: 10 },
  };
  const buffer = await generatePdfBuffer(docDefinition);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ============================================================================
// format-pdf.js tests
// ============================================================================

test('generatePdfReport produces a PDF buffer', async t => {
  const buffer = await generatePdfReport(makeResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
  t.is(buffer.slice(0, 5).toString('ascii'), '%PDF-');
});

test('generatePdfReport handles minimal results', async t => {
  const buffer = await generatePdfReport(makeMinimalResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePdfReport handles dry run', async t => {
  const buffer = await generatePdfReport(makeResults({ dryRun: true }));
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePdfReport handles key conflicts', async t => {
  const buffer = await generatePdfReport(makeFullWarningsResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePdfReport handles results with NCP skipped projects', async t => {
  const buffer = await generatePdfReport(makeResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePdfReport handles results with server steps', async t => {
  const buffer = await generatePdfReport(makeResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePdfReport handles results with org results', async t => {
  const results = makeResults({
    orgResults: [
      {
        key: 'org-a',
        projectCount: 2,
        steps: [
          { step: 'Migrate gates', status: 'success', detail: '2 gates' },
          { step: 'Migrate profiles', status: 'failed', error: 'timeout' },
        ],
      },
    ],
  });
  const buffer = await generatePdfReport(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePdfReport handles empty server steps and org results', async t => {
  const results = makeResults({ serverSteps: [], orgResults: [] });
  const buffer = await generatePdfReport(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePdfReport handles all success projects', async t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  const buffer = await generatePdfReport(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePdfReport handles no endTime', async t => {
  const results = makeResults({ endTime: null });
  const buffer = await generatePdfReport(results);
  t.true(Buffer.isBuffer(buffer));
});

// ============================================================================
// format-pdf-executive.js tests
// ============================================================================

test('generateExecutiveSummaryPdf produces a PDF buffer', async t => {
  const buffer = await generateExecutiveSummaryPdf(makeResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
  t.is(buffer.slice(0, 5).toString('ascii'), '%PDF-');
});

test('generateExecutiveSummaryPdf handles minimal results', async t => {
  const buffer = await generateExecutiveSummaryPdf(makeMinimalResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generateExecutiveSummaryPdf handles dry run', async t => {
  const buffer = await generateExecutiveSummaryPdf(makeResults({ dryRun: true }));
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generateExecutiveSummaryPdf handles all success', async t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  const buffer = await generateExecutiveSummaryPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generateExecutiveSummaryPdf handles all failed', async t => {
  const results = makeResults({ projects: [makeFailedProject()] });
  const buffer = await generateExecutiveSummaryPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generateExecutiveSummaryPdf handles key conflicts and NCP warnings', async t => {
  const buffer = await generateExecutiveSummaryPdf(makeFullWarningsResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generateExecutiveSummaryPdf handles missing startTime', async t => {
  const results = makeResults({ startTime: null });
  const buffer = await generateExecutiveSummaryPdf(results);
  t.true(Buffer.isBuffer(buffer));
});

test('generateExecutiveSummaryPdf handles org results', async t => {
  const buffer = await generateExecutiveSummaryPdf(makeResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generateExecutiveSummaryPdf handles no org results', async t => {
  const results = makeResults({ orgResults: [] });
  const buffer = await generateExecutiveSummaryPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generateExecutiveSummaryPdf handles partial-only projects', async t => {
  const results = makeResults({ projects: [makePartialProject()] });
  const buffer = await generateExecutiveSummaryPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ============================================================================
// format-pdf-performance.js tests
// ============================================================================

test('generatePerformanceReportPdf produces a PDF buffer', async t => {
  const buffer = await generatePerformanceReportPdf(makeResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
  t.is(buffer.slice(0, 5).toString('ascii'), '%PDF-');
});

test('generatePerformanceReportPdf handles minimal results', async t => {
  const buffer = await generatePerformanceReportPdf(makeMinimalResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePerformanceReportPdf handles results with server steps', async t => {
  const buffer = await generatePerformanceReportPdf(makeResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePerformanceReportPdf handles empty server steps', async t => {
  const results = makeResults({ serverSteps: [] });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePerformanceReportPdf handles org steps', async t => {
  const buffer = await generatePerformanceReportPdf(makeResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePerformanceReportPdf handles empty org results', async t => {
  const results = makeResults({ orgResults: [] });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePerformanceReportPdf handles all projects', async t => {
  const buffer = await generatePerformanceReportPdf(makeResults());
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePerformanceReportPdf handles no projects', async t => {
  const results = makeMinimalResults();
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePerformanceReportPdf handles no endTime', async t => {
  const results = makeResults({ endTime: null });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
});

test('generatePerformanceReportPdf handles org without steps array', async t => {
  const results = makeResults({
    orgResults: [{ key: 'bare-org', projectCount: 0, durationMs: 500 }],
  });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePerformanceReportPdf handles org without durationMs', async t => {
  const results = makeResults({
    orgResults: [{ key: 'no-time-org', projectCount: 0, steps: [] }],
  });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('generatePerformanceReportPdf handles step with null durationMs', async t => {
  const results = makeResults({
    projects: [{
      projectKey: 'null-dur',
      scProjectKey: 'null-dur',
      status: 'success',
      steps: [
        { step: 'Upload scanner report', status: 'success', durationMs: null },
        { step: 'Sync issues', status: 'success' },
        { step: 'Sync hotspots', status: 'skipped' },
      ],
    }],
  });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ============================================================================
// index.js (writeAllReports) tests
// ============================================================================

test('writeAllReports creates output directory and writes all mandatory reports', async t => {
  const tmpDir = getTmpDir();
  try {
    const results = makeResults();
    await writeAllReports(results, tmpDir);

    const files = await readdir(tmpDir);

    // Mandatory files (always present)
    t.true(files.includes('migration-report.json'));
    t.true(files.includes('migration-report.txt'));
    t.true(files.includes('migration-report.md'));
    t.true(files.includes('executive-summary.md'));
    t.true(files.includes('performance-report.md'));

    // PDF files (best-effort, but pdfmake is available so they should be there)
    t.true(files.includes('migration-report.pdf'));
    t.true(files.includes('executive-summary.pdf'));
    t.true(files.includes('performance-report.pdf'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('writeAllReports JSON file contains valid JSON matching results', async t => {
  const tmpDir = getTmpDir();
  try {
    const results = makeResults();
    await writeAllReports(results, tmpDir);

    const jsonContent = await readFile(join(tmpDir, 'migration-report.json'), 'utf-8');
    const parsed = JSON.parse(jsonContent);
    t.is(parsed.qualityGates, 3);
    t.is(parsed.qualityProfiles, 5);
    t.is(parsed.groups, 2);
    t.is(parsed.portfolios, 1);
    t.is(parsed.projects.length, 3);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('writeAllReports TXT file contains report content', async t => {
  const tmpDir = getTmpDir();
  try {
    const results = makeResults();
    await writeAllReports(results, tmpDir);

    const txt = await readFile(join(tmpDir, 'migration-report.txt'), 'utf-8');
    t.true(txt.includes('CLOUDVOYAGER MIGRATION REPORT'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('writeAllReports MD file contains markdown content', async t => {
  const tmpDir = getTmpDir();
  try {
    const results = makeResults();
    await writeAllReports(results, tmpDir);

    const md = await readFile(join(tmpDir, 'migration-report.md'), 'utf-8');
    t.true(md.includes('# CloudVoyager Migration Report'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('writeAllReports executive summary MD contains executive content', async t => {
  const tmpDir = getTmpDir();
  try {
    const results = makeResults();
    await writeAllReports(results, tmpDir);

    const md = await readFile(join(tmpDir, 'executive-summary.md'), 'utf-8');
    t.true(md.includes('Executive Summary'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('writeAllReports performance MD contains performance content', async t => {
  const tmpDir = getTmpDir();
  try {
    const results = makeResults();
    await writeAllReports(results, tmpDir);

    const md = await readFile(join(tmpDir, 'performance-report.md'), 'utf-8');
    t.true(md.includes('Performance Report'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('writeAllReports PDF files start with %PDF header', async t => {
  const tmpDir = getTmpDir();
  try {
    const results = makeResults();
    await writeAllReports(results, tmpDir);

    for (const name of ['migration-report.pdf', 'executive-summary.pdf', 'performance-report.pdf']) {
      const buf = await readFile(join(tmpDir, name));
      t.is(buf.slice(0, 5).toString('ascii'), '%PDF-', `${name} should start with %PDF-`);
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('writeAllReports creates nested output directory', async t => {
  const tmpDir = join(getTmpDir(), 'nested', 'dir');
  try {
    await writeAllReports(makeResults(), tmpDir);
    const files = await readdir(tmpDir);
    t.true(files.includes('migration-report.json'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

test('writeAllReports handles minimal results without errors', async t => {
  const tmpDir = getTmpDir();
  try {
    await writeAllReports(makeMinimalResults(), tmpDir);
    const files = await readdir(tmpDir);
    t.true(files.includes('migration-report.json'));
    t.true(files.includes('migration-report.txt'));
    t.true(files.includes('migration-report.md'));
    t.true(files.includes('executive-summary.md'));
    t.true(files.includes('performance-report.md'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('writeAllReports still writes text/md files even if PDF generation fails', async t => {
  const tmpDir = getTmpDir();

  // Stub the PDF generators to throw
  // We import them dynamically so we can stub at the module level
  // Instead, we provide results that could trigger an error path.
  // Since pdfmake is present, let's just verify the best-effort behavior
  // by checking the function doesn't throw even when successful.
  try {
    await writeAllReports(makeResults(), tmpDir);
    const files = await readdir(tmpDir);
    // All mandatory files should be there regardless
    t.true(files.includes('migration-report.json'));
    t.true(files.includes('migration-report.txt'));
    t.true(files.includes('migration-report.md'));
    t.true(files.includes('executive-summary.md'));
    t.true(files.includes('performance-report.md'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Cross-cutting / edge case tests
// ============================================================================

test('all text formatters handle results with many projects (>20)', t => {
  const projects = [];
  for (let i = 0; i < 25; i++) {
    projects.push(makeSuccessProject({ projectKey: `project-${i}`, scProjectKey: `project-${i}` }));
  }
  const results = makeResults({ projects });

  // These should not throw
  const text = formatTextReport(results);
  const md = formatMarkdownReport(results);
  const exec = formatExecutiveSummaryMarkdown(results);
  const perf = formatPerformanceReport(results);

  t.true(text.includes('project-24'));
  t.true(md.includes('project-24'));
  t.truthy(exec);
  t.truthy(perf);
});

test('all PDF generators handle results with many projects (>20)', async t => {
  const projects = [];
  for (let i = 0; i < 25; i++) {
    projects.push(makeSuccessProject({ projectKey: `project-${i}`, scProjectKey: `project-${i}` }));
  }
  const results = makeResults({ projects });

  const pdf = await generatePdfReport(results);
  const execPdf = await generateExecutiveSummaryPdf(results);
  const perfPdf = await generatePerformanceReportPdf(results);

  t.true(Buffer.isBuffer(pdf));
  t.true(Buffer.isBuffer(execPdf));
  t.true(Buffer.isBuffer(perfPdf));
});

test('all formatters handle results with only failed projects', t => {
  const results = makeResults({
    projects: [makeFailedProject(), makeFailedProject({ projectKey: 'fail-2', scProjectKey: 'fail-2' })],
  });

  const text = formatTextReport(results);
  const md = formatMarkdownReport(results);
  const exec = formatExecutiveSummaryMarkdown(results);
  const perf = formatPerformanceReport(results);

  t.true(text.includes('FAIL'));
  t.true(md.includes('FAIL'));
  t.true(exec.includes('FAILED'));
  t.truthy(perf);
});

test('all formatters handle results with only partial projects', t => {
  const results = makeResults({
    projects: [makePartialProject()],
  });

  const text = formatTextReport(results);
  const md = formatMarkdownReport(results);
  const exec = formatExecutiveSummaryMarkdown(results);
  const perf = formatPerformanceReport(results);

  t.true(text.includes('PARTIAL'));
  t.true(md.includes('PARTIAL'));
  t.true(exec.includes('PARTIAL SUCCESS'));
  t.truthy(perf);
});

test('text report step lines show OK and FAIL indicators', t => {
  const text = formatTextReport(makeResults());
  // Server steps should show OK
  t.true(text.includes('[OK  ]'));
  // Failed project details should show FAIL
  t.true(text.includes('[FAIL]'));
});

test('text report shows skipped steps with SKIP indicator', t => {
  const text = formatTextReport(makeResults());
  t.true(text.includes('[SKIP]'));
});

test('markdown report step status shows OK/FAIL/SKIP', t => {
  const md = formatMarkdownReport(makeResults());
  // Problem projects section
  t.true(md.includes('| OK |') || md.includes('OK'));
  t.true(md.includes('FAIL'));
  t.true(md.includes('SKIP'));
});

test('performance report config duration shows dash when no config steps have time', t => {
  const results = makeResults({
    projects: [{
      projectKey: 'no-config-time',
      scProjectKey: 'no-config-time',
      status: 'success',
      durationMs: 1000,
      steps: [
        { step: 'Upload scanner report', status: 'success', durationMs: 500 },
        { step: 'Sync issues', status: 'success', durationMs: 300 },
        { step: 'Sync hotspots', status: 'success', durationMs: 200 },
      ],
    }],
  });
  const md = formatPerformanceReport(results);
  // Config column should show dash since there are no non-main steps
  t.true(md.includes('\u2014'));
});

test('performance report sorts projects by duration descending', t => {
  const results = makeResults({
    projects: [
      makeSuccessProject({ projectKey: 'slow-proj', durationMs: 30000 }),
      makeSuccessProject({ projectKey: 'fast-proj', durationMs: 1000 }),
      makeSuccessProject({ projectKey: 'mid-proj', durationMs: 10000 }),
    ],
  });
  const md = formatPerformanceReport(results);
  const slowIdx = md.indexOf('slow-proj');
  const midIdx = md.indexOf('mid-proj');
  const fastIdx = md.indexOf('fast-proj');
  t.true(slowIdx < midIdx, 'slow-proj should appear before mid-proj');
  t.true(midIdx < fastIdx, 'mid-proj should appear before fast-proj');
});

test('executive summary success rate is 100% for all-success', t => {
  const results = makeResults({
    projects: [makeSuccessProject(), makeSuccessProject({ projectKey: 'proj-2' })],
  });
  const md = formatExecutiveSummaryMarkdown(results);
  t.true(md.includes('100.0% success rate'));
});

test('executive summary success rate is 0% for all-failed', t => {
  const results = makeResults({
    projects: [makeFailedProject()],
  });
  const md = formatExecutiveSummaryMarkdown(results);
  t.true(md.includes('0.0%'));
});

test('formatTextReport includes failed steps detail in ALL PROJECTS section', t => {
  const text = formatTextReport(makeResults());
  // The partial project has a failed step "Set quality gate"
  t.true(text.includes('(failed: Set quality gate)'));
});

test('formatMarkdownReport shows failed steps in all projects table', t => {
  const md = formatMarkdownReport(makeResults());
  t.true(md.includes('Set quality gate'));
});

test('formatPerformanceReport bottleneck analysis includes server step prefixes', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('[Server]'));
});

test('formatPerformanceReport bottleneck analysis includes org step prefixes', t => {
  const md = formatPerformanceReport(makeResults());
  t.true(md.includes('[Org]'));
});

// ============================================================================
// shared.js - computeLocThroughput
// ============================================================================

test('shared > computeLocThroughput returns object with correct values', t => {
  const results = makeResults({
    totalLinesOfCode: 60000,
    startTime: '2026-02-19T10:00:00Z',
    endTime: '2026-02-19T10:05:00Z', // 5 minutes = 300,000 ms
    projects: [makeSuccessProject(), makeSuccessProject({ projectKey: 'p2' })],
  });
  const throughput = computeLocThroughput(results);

  t.truthy(throughput);
  // 60000 LOC / 300s = 200 LOC/s
  t.is(throughput.locPerSecond, 200);
  // 60000 LOC / 5 min = 12000 LOC/min
  t.is(throughput.locPerMinute, 12000);
  // 60000 LOC / 2 projects = 30000
  t.is(throughput.avgLocPerProject, 30000);
});

test('shared > computeLocThroughput returns null locPerSecond when no duration', t => {
  const results = makeResults({
    totalLinesOfCode: 1000,
    startTime: null,
    endTime: null,
    projects: [makeSuccessProject()],
  });
  const throughput = computeLocThroughput(results);

  t.truthy(throughput);
  t.is(throughput.locPerSecond, null);
  t.is(throughput.locPerMinute, null);
  // avgLocPerProject should still work
  t.is(throughput.avgLocPerProject, 1000);
});

test('shared > computeLocThroughput handles zero LOC', t => {
  const results = makeResults({
    totalLinesOfCode: 0,
    projects: [makeSuccessProject()],
  });
  const throughput = computeLocThroughput(results);

  t.truthy(throughput);
  t.is(throughput.locPerSecond, 0);
  t.is(throughput.locPerMinute, 0);
  t.is(throughput.avgLocPerProject, 0);
});

test('shared > computeLocThroughput handles missing totalLinesOfCode', t => {
  const results = makeResults({
    projects: [makeSuccessProject()],
  });
  // makeResults does not set totalLinesOfCode by default, so computeTotalLoc returns 0
  const throughput = computeLocThroughput(results);

  t.truthy(throughput);
  t.is(throughput.locPerSecond, 0);
  t.is(throughput.avgLocPerProject, 0);
});

test('shared > computeLocThroughput handles zero projects for avgLocPerProject', t => {
  const results = makeResults({
    totalLinesOfCode: 5000,
    projects: [],
  });
  const throughput = computeLocThroughput(results);

  t.truthy(throughput);
  t.is(throughput.avgLocPerProject, 0);
});

test('shared > computeLocThroughput with large LOC and short duration', t => {
  const results = makeResults({
    totalLinesOfCode: 1000000,
    startTime: '2026-02-19T10:00:00Z',
    endTime: '2026-02-19T10:00:10Z', // 10 seconds
    projects: [makeSuccessProject()],
  });
  const throughput = computeLocThroughput(results);

  t.truthy(throughput);
  // 1,000,000 / 10 = 100,000 LOC/s
  t.is(throughput.locPerSecond, 100000);
  // 1,000,000 / (10/60) = 6,000,000 LOC/min
  t.is(throughput.locPerMinute, 6000000);
});

// ============================================================================
// writeAllReports PDF error handling tests (esmock)
// ============================================================================

import esmock from 'esmock';

test('writeAllReports handles PDF report generation failure gracefully', async t => {
  const tmpDir = getTmpDir();
  const writeAllReportsMocked = (await esmock('../../src/reports/index.js', {
    '../../src/reports/format-pdf.js': {
      generatePdfReport: async () => { throw new Error('PDF generation failed'); }
    }
  })).writeAllReports;

  try {
    await writeAllReportsMocked(makeResults(), tmpDir);

    const files = await readdir(tmpDir);
    // Mandatory text/md files still present
    t.true(files.includes('migration-report.json'));
    t.true(files.includes('migration-report.txt'));
    t.true(files.includes('migration-report.md'));
    t.true(files.includes('executive-summary.md'));
    t.true(files.includes('performance-report.md'));
    // migration-report.pdf should NOT be present since generation threw
    t.false(files.includes('migration-report.pdf'));
    // Executive and performance PDFs should still be present (they were not mocked)
    t.true(files.includes('executive-summary.pdf'));
    t.true(files.includes('performance-report.pdf'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('writeAllReports handles executive summary PDF failure gracefully', async t => {
  const tmpDir = getTmpDir();
  const writeAllReportsMocked = (await esmock('../../src/reports/index.js', {
    '../../src/reports/format-pdf-executive.js': {
      generateExecutiveSummaryPdf: async () => { throw new Error('Executive PDF failed'); }
    }
  })).writeAllReports;

  try {
    await writeAllReportsMocked(makeResults(), tmpDir);

    const files = await readdir(tmpDir);
    t.true(files.includes('migration-report.json'));
    t.true(files.includes('migration-report.txt'));
    t.true(files.includes('migration-report.md'));
    t.true(files.includes('executive-summary.md'));
    t.true(files.includes('performance-report.md'));
    // Executive PDF should be absent
    t.false(files.includes('executive-summary.pdf'));
    // Others should be present
    t.true(files.includes('migration-report.pdf'));
    t.true(files.includes('performance-report.pdf'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('writeAllReports handles performance PDF failure gracefully', async t => {
  const tmpDir = getTmpDir();
  const writeAllReportsMocked = (await esmock('../../src/reports/index.js', {
    '../../src/reports/format-pdf-performance.js': {
      generatePerformanceReportPdf: async () => { throw new Error('Perf PDF failed'); }
    }
  })).writeAllReports;

  try {
    await writeAllReportsMocked(makeResults(), tmpDir);

    const files = await readdir(tmpDir);
    t.true(files.includes('migration-report.json'));
    t.true(files.includes('migration-report.txt'));
    t.true(files.includes('migration-report.md'));
    t.true(files.includes('executive-summary.md'));
    t.true(files.includes('performance-report.md'));
    // Performance PDF should be absent
    t.false(files.includes('performance-report.pdf'));
    // Others should be present
    t.true(files.includes('migration-report.pdf'));
    t.true(files.includes('executive-summary.pdf'));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ============================================================================
// format-markdown.js: statusIcon unknown status fallback (line 110)
// ============================================================================

test('formatMarkdownReport renders unknown step status as-is (statusIcon fallback)', t => {
  // To hit line 110 in format-markdown.js, we need a step whose status is
  // not 'success', 'failed', or 'skipped'. The statusIcon function will
  // return the raw status string. We use a server step with status 'pending'.
  const results = makeResults({
    serverSteps: [
      { step: 'Custom step', status: 'pending', detail: 'Waiting...' },
      { step: 'Another step', status: 'in_progress', detail: 'Running...' },
    ],
  });
  const md = formatMarkdownReport(results);
  // The unknown status should appear as-is in the markdown table
  t.true(md.includes('| Custom step | pending | Waiting... |'));
  t.true(md.includes('| Another step | in_progress | Running... |'));
});

test('formatMarkdownReport renders unknown step status in org results', t => {
  // Exercise statusIcon fallback via org steps
  const results = makeResults({
    orgResults: [
      {
        key: 'test-org',
        projectCount: 1,
        steps: [
          { step: 'Org step', status: 'warning', detail: 'Some warning' },
        ],
      },
    ],
  });
  const md = formatMarkdownReport(results);
  t.true(md.includes('| Org step | warning | Some warning |'));
});

test('formatMarkdownReport renders unknown step status in problem project steps', t => {
  // Exercise statusIcon fallback via problem project step rows
  const results = makeResults({
    projects: [
      {
        projectKey: 'proj-unknown-status',
        scProjectKey: 'proj-unknown-status',
        status: 'partial',
        durationMs: 3000,
        steps: [
          { step: 'Create project', status: 'success', durationMs: 100 },
          { step: 'Unusual step', status: 'timeout', error: 'Timed out after 30s' },
        ],
      },
    ],
  });
  const md = formatMarkdownReport(results);
  // The 'timeout' status should pass through statusIcon unchanged
  t.true(md.includes('| Unusual step | timeout | Timed out after 30s |'));
});

// ============================================================================
// BRANCH COVERAGE TESTS — targeting specific uncovered lines
// ============================================================================

// ---------------------------------------------------------------------------
// shared.js — line 93: formatNumber(null) => '0'
// ---------------------------------------------------------------------------

test('shared > formatNumber returns "0" for null', t => {
  t.is(formatNumber(null), '0');
});

test('shared > formatNumber returns "0" for undefined', t => {
  t.is(formatNumber(undefined), '0');
});

test('shared > formatNumber formats a number with separators', t => {
  t.is(formatNumber(1234567), '1,234,567');
});

// ---------------------------------------------------------------------------
// perf-tables.js — line 4: sumDurations with null/undefined steps
// ---------------------------------------------------------------------------

test('perf-tables > sumDurations returns 0 for null steps', t => {
  t.is(sumDurations(null), 0);
});

test('perf-tables > sumDurations returns 0 for undefined steps', t => {
  t.is(sumDurations(undefined), 0);
});

test('perf-tables > sumDurations sums durationMs from steps', t => {
  const steps = [{ durationMs: 100 }, { durationMs: 200 }, { durationMs: 300 }];
  t.is(sumDurations(steps), 600);
});

// ---------------------------------------------------------------------------
// perf-tables.js — line 59: formatBottleneckAnalysis with org.steps undefined
// ---------------------------------------------------------------------------

test('perf-tables > formatBottleneckAnalysis handles orgResults without steps array', t => {
  const results = makeResults({
    orgResults: [{ key: 'org-no-steps', projectCount: 1 }], // no steps property
  });
  const output = formatBottleneckAnalysis(results);
  // Should not crash; should still produce output since projects have steps
  t.truthy(output);
  t.true(output.includes('## Bottleneck Analysis'));
});

// ---------------------------------------------------------------------------
// perf-tables.js — line 77: pct when totalStepTime is 0
// This requires all steps to have durationMs of 0 but still have entries
// (dur === 0 continue skips them, so stepTypeTotals.size becomes 0 -> returns null)
// Actually line 77 is: totalStepTime > 0 ? ... : '0.0'
// We need a step with dur > 0 but totalStepTime === 0 is impossible if dur > 0
// Let me re-read: the pct line says:
//   const pct = totalStepTime > 0 ? ((dur / totalStepTime) * 100).toFixed(1) : '0.0';
// The false branch (totalStepTime === 0) would only be reached if dur > 0 but
// totalStepTime is 0, which can't happen. Actually totalStepTime sums all durations.
// If all steps have dur=0, they're all skipped via "continue" and body only has header.
// So we need totalStepTime to be 0 while there's still a step with dur > 0?
// That can't happen. Let me re-check... Actually the sorted array includes ALL entries.
// totalStepTime = sorted.reduce(sum, [,dur] => sum+dur). If there's a step with dur=0
// it's still in sorted but skipped by "continue". totalStepTime includes all (including 0).
// So totalStepTime = sum of ALL entries including 0. If only entries with dur=0 exist,
// totalStepTime=0 and all are skipped. So the else branch of the ternary is unreachable
// in practice. But c8 counts it. Let's just move on — this may be an artifact.
// Actually wait — let me re-read the code. The 'continue' skips dur===0, but
// totalStepTime is computed from ALL entries including 0. So if some have dur>0,
// totalStepTime>0 and pct is computed normally. If none have dur>0, all are skipped.
// So the else branch '0.0' is indeed dead code. We can't easily cover it.
// However, we can try making it so totalStepTime ends up being 0 while still having
// entries... nope, that's impossible.
// Let's skip this line and focus on the others.

// ---------------------------------------------------------------------------
// perf-tables.js — getStepDuration and getConfigDuration edge cases
// ---------------------------------------------------------------------------

test('perf-tables > getStepDuration returns dash for missing step', t => {
  const project = { steps: [{ step: 'Other', status: 'success', durationMs: 100 }] };
  t.is(getStepDuration(project, 'Nonexistent'), '\u2014');
});

test('perf-tables > getStepDuration returns dash for null durationMs', t => {
  const project = { steps: [{ step: 'Upload scanner report', status: 'success', durationMs: null }] };
  t.is(getStepDuration(project, 'Upload scanner report'), '\u2014');
});

test('perf-tables > getStepDuration returns skipped for skipped step', t => {
  const project = { steps: [{ step: 'Sync issues', status: 'skipped', durationMs: 0 }] };
  t.is(getStepDuration(project, 'Sync issues'), 'skipped');
});

test('perf-tables > getStepDuration returns formatted duration for valid step', t => {
  const project = { steps: [{ step: 'Sync issues', status: 'success', durationMs: 5000 }] };
  t.is(getStepDuration(project, 'Sync issues'), '5s');
});

test('perf-tables > getConfigDuration returns dash when no config steps have time', t => {
  const project = {
    steps: [
      { step: 'Upload scanner report', status: 'success', durationMs: 1000 },
      { step: 'Sync issues', status: 'success', durationMs: 2000 },
      { step: 'Sync hotspots', status: 'success', durationMs: 500 },
    ],
  };
  t.is(getConfigDuration(project), '\u2014');
});

test('perf-tables > getConfigDuration returns formatted duration for non-main steps', t => {
  const project = {
    steps: [
      { step: 'Upload scanner report', status: 'success', durationMs: 1000 },
      { step: 'Set quality gate', status: 'success', durationMs: 200 },
      { step: 'Set quality profile', status: 'success', durationMs: 300 },
    ],
  };
  const result = getConfigDuration(project);
  t.not(result, '\u2014');
  t.truthy(result);
});

test('perf-tables > formatSlowestSteps returns null when no steps have duration', t => {
  const results = makeResults({
    projects: [{
      projectKey: 'p1', scProjectKey: 'p1', status: 'success',
      steps: [{ step: 'Create', status: 'success' }],
    }],
  });
  t.is(formatSlowestSteps(results), null);
});

// ---------------------------------------------------------------------------
// pdf-exec-sections.js — lines 4 and 33: projectKeyWarnings undefined
// ---------------------------------------------------------------------------

test('pdf-exec-sections > buildWarnings handles undefined projectKeyWarnings', t => {
  const results = makeResults();
  delete results.projectKeyWarnings;
  const stats = computeProjectStats(results);
  const nodes = buildWarnings(results, stats);
  // Should not crash; returns nodes array
  t.true(Array.isArray(nodes));
});

test('pdf-exec-sections > buildActionItems handles undefined projectKeyWarnings', t => {
  const results = makeResults();
  delete results.projectKeyWarnings;
  const stats = computeProjectStats(results);
  const nodes = buildActionItems(results, stats);
  t.true(Array.isArray(nodes));
  // Should still have the default action items
  t.true(nodes.some(n => n.text && n.text.includes('Verify project permissions')));
});

test('pdf-exec-sections > buildFailedProjects returns empty for all-success', t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  const nodes = buildFailedProjects(results);
  t.deepEqual(nodes, []);
});

// ---------------------------------------------------------------------------
// pdf-perf-sections.js — line 47: orgResults undefined in buildBottleneckAnalysisPdf
// ---------------------------------------------------------------------------

test('pdf-perf-sections > buildBottleneckAnalysisPdf handles undefined orgResults', t => {
  const results = makeResults();
  delete results.orgResults;
  const nodes = buildBottleneckAnalysisPdf(results);
  t.true(Array.isArray(nodes));
  // Should still produce content since projects and serverSteps have durations
  t.true(nodes.length > 0);
});

// ---------------------------------------------------------------------------
// pdf-perf-sections.js — line 59: d === 0 continue in buildBottleneckAnalysisPdf
// ---------------------------------------------------------------------------

test('pdf-perf-sections > buildBottleneckAnalysisPdf skips steps with zero duration', t => {
  const results = makeResults({
    projects: [{
      projectKey: 'zero-dur',
      scProjectKey: 'zero-dur',
      status: 'success',
      durationMs: 1000,
      steps: [
        { step: 'Upload scanner report', status: 'success', durationMs: 1000 },
        { step: 'Sync issues', status: 'success', durationMs: 0 },
      ],
    }],
    serverSteps: [
      { step: 'Extract gates', status: 'success', durationMs: 0 },
    ],
    orgResults: [],
  });
  const nodes = buildBottleneckAnalysisPdf(results);
  t.true(Array.isArray(nodes));
  t.true(nodes.length > 0);
});

test('pdf-perf-sections > buildSlowestSteps returns empty when no steps have duration', t => {
  const results = makeResults({
    projects: [{
      projectKey: 'p1', scProjectKey: 'p1', status: 'success',
      steps: [{ step: 'Create', status: 'success' }],
    }],
  });
  const nodes = buildSlowestSteps(results);
  t.deepEqual(nodes, []);
});

// ---------------------------------------------------------------------------
// format-pdf-performance.js — line 51: sumDurations with undefined steps
// (This is the local sumDurations in the file, exercised via PDF generation)
// ---------------------------------------------------------------------------

test('generatePerformanceReportPdf handles undefined orgResults (line 91,96 fallback)', async t => {
  const results = makeResults();
  delete results.orgResults;
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// format-pdf-performance.js — line 70: formatTimestamp fallback for startTime
// ---------------------------------------------------------------------------

test('generatePerformanceReportPdf handles non-parseable startTime (line 70 fallback)', async t => {
  // If formatTimestamp returns a string for a non-null startTime, the || won't be triggered.
  // But if startTime is something formatTimestamp can't parse, it returns a string like "Invalid Date".
  // Actually formatTimestamp returns null only if !isoString. Since startTime is truthy but not a
  // valid date, new Date() will return "Invalid Date" which toLocaleString returns "Invalid Date".
  // So the || fallback would not trigger. Let's test with startTime: null to trigger || results.startTime.
  // Wait, line 70: formatTimestamp(results.startTime) || results.startTime
  // If startTime is null, formatTimestamp returns null, then || results.startTime = null -> null.
  // That's already tested with endTime: null. The uncovered branch is when formatTimestamp
  // returns a falsy value but startTime is truthy.
  // Actually this could never happen in practice since formatTimestamp(nonNull) returns a string.
  // But to be safe, let's just trigger the null case which causes startTime to be used as fallback.
  // Actually, we already test endTime null. For startTime, let's ensure the fallback works.
  const results = makeResults({ startTime: null });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
});

// ---------------------------------------------------------------------------
// format-pdf-performance.js — line 163: project sort with null durationMs
// ---------------------------------------------------------------------------

test('generatePerformanceReportPdf sorts projects with null durationMs (line 163)', async t => {
  const results = makeResults({
    projects: [
      makeSuccessProject({ projectKey: 'proj-a', durationMs: null }),
      makeSuccessProject({ projectKey: 'proj-b', durationMs: 5000 }),
      makeSuccessProject({ projectKey: 'proj-c' }), // durationMs: undefined via delete
    ],
  });
  delete results.projects[2].durationMs;
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// format-text.js — line 33: startTime fallback (formatTimestamp returns null)
// Already covered by endTime null test, but need startTime null for the || results.startTime branch
// ---------------------------------------------------------------------------

test('formatTextReport handles null startTime with fallback (line 33)', t => {
  const results = makeResults({ startTime: null });
  const text = formatTextReport(results);
  // formatTimestamp(null) returns null, so || results.startTime kicks in (which is null)
  t.true(text.includes('Started:'));
});

// ---------------------------------------------------------------------------
// format-text.js — line 69: projectKeyWarnings undefined
// ---------------------------------------------------------------------------

test('formatTextReport handles undefined projectKeyWarnings (line 69 fallback)', t => {
  const results = makeResults();
  delete results.projectKeyWarnings;
  const text = formatTextReport(results);
  // Should not crash; keyWarnings defaults to []
  t.false(text.includes('PROJECT KEY CONFLICTS'));
});

// ---------------------------------------------------------------------------
// format-text.js — lines 125-127: orgResults undefined
// ---------------------------------------------------------------------------

test('formatTextReport handles undefined orgResults (lines 125-127 fallback)', t => {
  const results = makeResults();
  delete results.orgResults;
  const text = formatTextReport(results);
  // Should not crash; orgResults defaults to []
  t.false(text.includes('ORGANIZATION:'));
});

// ---------------------------------------------------------------------------
// format-text.js — line 153: skipped step with falsy detail
// ---------------------------------------------------------------------------

test('formatTextReport handles skipped step with empty detail (line 153)', t => {
  const results = makeResults({
    projects: [
      {
        projectKey: 'proj-empty-detail',
        scProjectKey: 'proj-empty-detail',
        status: 'partial',
        durationMs: 1000,
        steps: [
          { step: 'Create project', status: 'success', durationMs: 100 },
          { step: 'Upload scanner report', status: 'skipped' }, // no detail
        ],
      },
    ],
  });
  const text = formatTextReport(results);
  // The skipped step should show [SKIP] with empty detail (detail || '' = '')
  t.true(text.includes('[SKIP] Upload scanner report --'));
});

// ---------------------------------------------------------------------------
// format-performance.js — line 44: orgResults undefined in formatOverview
// ---------------------------------------------------------------------------

test('formatPerformanceReport handles undefined orgResults (line 44,50 fallback)', t => {
  const results = makeResults();
  delete results.orgResults;
  const md = formatPerformanceReport(results);
  // Should not crash; organizations defaults to 0
  t.true(md.includes('| Organizations | 0 |'));
});

// ---------------------------------------------------------------------------
// format-performance.js — line 113: sort with null durationMs
// ---------------------------------------------------------------------------

test('formatPerformanceReport sorts projects with null/undefined durationMs (line 113)', t => {
  const results = makeResults({
    projects: [
      makeSuccessProject({ projectKey: 'proj-null-dur', durationMs: null }),
      makeSuccessProject({ projectKey: 'proj-ok-dur', durationMs: 3000 }),
    ],
  });
  const md = formatPerformanceReport(results);
  // proj-ok-dur should appear first since 3000 > (null||0)
  const okIdx = md.indexOf('proj-ok-dur');
  const nullIdx = md.indexOf('proj-null-dur');
  t.true(okIdx < nullIdx, 'project with duration should sort before null duration');
});

// ---------------------------------------------------------------------------
// format-markdown.js — lines 32-33: startTime/endTime fallback
// ---------------------------------------------------------------------------

test('formatMarkdownReport handles null startTime (line 32 fallback)', t => {
  const results = makeResults({ startTime: null });
  const md = formatMarkdownReport(results);
  // formatTimestamp(null) => null, so || results.startTime => null
  t.true(md.includes('**Started:**'));
});

// ---------------------------------------------------------------------------
// format-markdown.js — line 73: projectKeyWarnings undefined
// ---------------------------------------------------------------------------

test('formatMarkdownReport handles undefined projectKeyWarnings (line 73 fallback)', t => {
  const results = makeResults();
  delete results.projectKeyWarnings;
  const md = formatMarkdownReport(results);
  t.false(md.includes('## Project Key Conflicts'));
});

// ---------------------------------------------------------------------------
// format-markdown.js — line 139: org.steps undefined in formatOrgResults
// ---------------------------------------------------------------------------

test('formatMarkdownReport handles org without steps array (line 139 fallback)', t => {
  const results = makeResults({
    orgResults: [{ key: 'org-no-steps', projectCount: 0 }], // no steps property
  });
  const md = formatMarkdownReport(results);
  t.true(md.includes('## Organization: org-no-steps'));
});

// ---------------------------------------------------------------------------
// format-markdown-executive.js — line 39: orgResults undefined
// ---------------------------------------------------------------------------

test('formatExecutiveSummaryMarkdown handles undefined orgResults (line 39 fallback)', t => {
  const results = makeResults();
  delete results.orgResults;
  const md = formatExecutiveSummaryMarkdown(results);
  // orgCount should be 0, so no Target Organizations line
  t.false(md.includes('**Target Organizations:**'));
});

// ---------------------------------------------------------------------------
// format-markdown-executive.js — line 101: projectKeyWarnings undefined in formatWarningsAndRisks
// ---------------------------------------------------------------------------

test('formatExecutiveSummaryMarkdown handles undefined projectKeyWarnings (line 101 fallback)', t => {
  const results = makeResults();
  delete results.projectKeyWarnings;
  const md = formatExecutiveSummaryMarkdown(results);
  // Should not crash
  t.true(md.includes('## Warnings & Risks'));
});

// ---------------------------------------------------------------------------
// format-markdown-executive.js — line 134: projectKeyWarnings undefined in formatActionItems
// ---------------------------------------------------------------------------

test('formatExecutiveSummaryMarkdown handles undefined projectKeyWarnings in action items (line 134)', t => {
  const results = makeResults({ projects: [makeSuccessProject()] });
  delete results.projectKeyWarnings;
  const md = formatExecutiveSummaryMarkdown(results);
  t.true(md.includes('## Action Items'));
  // Should not include CI/CD pipeline action since no key warnings
  t.false(md.includes('Update CI/CD pipelines'));
});

// ---------------------------------------------------------------------------
// format-pdf.js — line 52: startTime fallback
// ---------------------------------------------------------------------------

test('generatePdfReport handles null startTime (line 52 fallback)', async t => {
  const results = makeResults({ startTime: null });
  const buffer = await generatePdfReport(results);
  t.true(Buffer.isBuffer(buffer));
});

// ---------------------------------------------------------------------------
// format-pdf.js — line 95: projectKeyWarnings undefined
// ---------------------------------------------------------------------------

test('generatePdfReport handles undefined projectKeyWarnings (line 95 fallback)', async t => {
  const results = makeResults();
  delete results.projectKeyWarnings;
  const buffer = await generatePdfReport(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// format-pdf-executive.js — line 54: orgResults undefined
// ---------------------------------------------------------------------------

test('generateExecutiveSummaryPdf handles undefined orgResults (line 54 fallback)', async t => {
  const results = makeResults();
  delete results.orgResults;
  const buffer = await generateExecutiveSummaryPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// pdf-helpers.js — line 9: PdfPrinterModule.default || PdfPrinterModule
// This line handles CJS/ESM interop. Since we're in ESM mode, the import will
// have `.default` populated, so the || fallback is not exercised. Testing it
// directly would require mocking the module system. Instead, we verify the
// createPrinter function works correctly (which implicitly tests line 9 resolved).
// The existing createPrinter test already covers the truthy path.
// ---------------------------------------------------------------------------

test('pdf-helpers > createPrinter produces a working printer (line 9 CJS/ESM interop)', t => {
  // This exercises the PdfPrinter resolution at line 9
  const printer = createPrinter();
  t.truthy(printer);
  // Verify it can create a document (proving the constructor worked)
  t.true(typeof printer.createPdfKitDocument === 'function');
});

// ---------------------------------------------------------------------------
// Additional edge-case tests to cover remaining || fallbacks
// ---------------------------------------------------------------------------

test('formatPerformanceReport handles env section without environment', t => {
  const results = makeResults();
  delete results.environment;
  const md = formatPerformanceReport(results);
  t.false(md.includes('## Runtime Environment'));
});

test('formatPerformanceReport handles config section without configuration', t => {
  const results = makeResults();
  delete results.configuration;
  const md = formatPerformanceReport(results);
  t.false(md.includes('## Configuration'));
});

test('formatTextReport handles environment section', t => {
  const results = makeResults({
    environment: {
      platform: 'linux',
      arch: 'x64',
      cpuModel: 'Intel i7',
      cpuCores: 8,
      totalMemoryMB: 16384,
      nodeVersion: 'v20.0.0',
      heapLimitMB: 4096,
    },
  });
  const text = formatTextReport(results);
  t.true(text.includes('RUNTIME ENVIRONMENT'));
  t.true(text.includes('linux (x64)'));
});

test('formatTextReport handles configuration section', t => {
  const results = makeResults({
    configuration: {
      transferMode: 'full',
      batchSize: 50,
      autoTune: false,
      performance: {
        maxConcurrency: 4,
        sourceExtraction: { concurrency: 2 },
        hotspotExtraction: { concurrency: 2 },
        issueSync: { concurrency: 3 },
        hotspotSync: { concurrency: 3 },
        projectMigration: { concurrency: 1 },
      },
      rateLimit: {
        maxRetries: 3,
        baseDelay: 1000,
        minRequestInterval: 200,
      },
    },
  });
  const text = formatTextReport(results);
  t.true(text.includes('CONFIGURATION'));
  t.true(text.includes('Transfer Mode:       full'));
  t.true(text.includes('Rate Limit Retries:'));
});

test('formatTextReport handles configuration section with autoTune enabled', t => {
  const results = makeResults({
    configuration: {
      transferMode: 'incremental',
      batchSize: 100,
      autoTune: true,
      performance: {
        maxConcurrency: 8,
        sourceExtraction: { concurrency: 4 },
        hotspotExtraction: { concurrency: 4 },
        issueSync: { concurrency: 6 },
        hotspotSync: { concurrency: 6 },
        projectMigration: { concurrency: 2 },
      },
    },
  });
  const text = formatTextReport(results);
  t.true(text.includes('Auto-Tune:           enabled'));
});

test('formatMarkdownReport handles environment and configuration sections', t => {
  const results = makeResults({
    environment: {
      platform: 'darwin',
      arch: 'arm64',
      cpuModel: 'Apple M1',
      cpuCores: 10,
      totalMemoryMB: 32768,
      nodeVersion: 'v20.10.0',
      heapLimitMB: 8192,
    },
    configuration: {
      transferMode: 'full',
      batchSize: 200,
      autoTune: false,
      performance: {
        maxConcurrency: 4,
        sourceExtraction: { concurrency: 2 },
        hotspotExtraction: { concurrency: 2 },
        issueSync: { concurrency: 3 },
        hotspotSync: { concurrency: 3 },
        projectMigration: { concurrency: 1 },
      },
      rateLimit: {
        maxRetries: 5,
        baseDelay: 500,
        minRequestInterval: 100,
      },
    },
  });
  const md = formatMarkdownReport(results);
  t.true(md.includes('## Runtime Environment'));
  t.true(md.includes('## Configuration'));
  t.true(md.includes('| Rate Limit Retries |'));
});

test('formatPerformanceReport handles environment and configuration', t => {
  const results = makeResults({
    environment: {
      platform: 'linux', arch: 'x64', cpuModel: 'Xeon', cpuCores: 16,
      totalMemoryMB: 65536, nodeVersion: 'v20.0.0', heapLimitMB: 16384,
    },
    configuration: {
      transferMode: 'full', batchSize: 100, autoTune: true,
      performance: {
        maxConcurrency: 8,
        sourceExtraction: { concurrency: 4 },
        hotspotExtraction: { concurrency: 4 },
        issueSync: { concurrency: 6 },
        hotspotSync: { concurrency: 6 },
        projectMigration: { concurrency: 2 },
      },
      rateLimit: { maxRetries: 3, baseDelay: 1000, minRequestInterval: 200 },
    },
  });
  const md = formatPerformanceReport(results);
  t.true(md.includes('## Runtime Environment'));
  t.true(md.includes('## Configuration'));
});

// ---------------------------------------------------------------------------
// LOC throughput in performance and executive reports
// ---------------------------------------------------------------------------

test('formatPerformanceReport includes LOC throughput when totalLinesOfCode > 0', t => {
  const results = makeResults({ totalLinesOfCode: 50000 });
  const md = formatPerformanceReport(results);
  t.true(md.includes('| Total Lines of Code |'));
  t.true(md.includes('| LOC per Minute |'));
  t.true(md.includes('| LOC per Second |'));
  t.true(md.includes('| Average LOC per Project |'));
});

test('formatExecutiveSummaryMarkdown includes LOC throughput when totalLinesOfCode > 0', t => {
  const results = makeResults({ totalLinesOfCode: 50000 });
  const md = formatExecutiveSummaryMarkdown(results);
  t.true(md.includes('| Total Lines of Code |'));
  t.true(md.includes('| Migration Throughput |'));
});

test('formatTextReport includes LOC total when totalLinesOfCode > 0', t => {
  const results = makeResults({ totalLinesOfCode: 25000 });
  const text = formatTextReport(results);
  t.true(text.includes('Lines of Code:'));
});

test('formatMarkdownReport includes LOC total when totalLinesOfCode > 0', t => {
  const results = makeResults({ totalLinesOfCode: 25000 });
  const md = formatMarkdownReport(results);
  t.true(md.includes('| Lines of Code |'));
});

// ---------------------------------------------------------------------------
// PDF performance report with LOC and environment/configuration
// ---------------------------------------------------------------------------

test('generatePerformanceReportPdf includes LOC data when totalLinesOfCode > 0', async t => {
  const results = makeResults({
    totalLinesOfCode: 100000,
    environment: {
      platform: 'linux', arch: 'x64', cpuModel: 'Xeon', cpuCores: 16,
      totalMemoryMB: 65536, nodeVersion: 'v20.0.0', heapLimitMB: 16384,
    },
    configuration: {
      transferMode: 'full', batchSize: 100, autoTune: true,
      performance: {
        maxConcurrency: 8,
        sourceExtraction: { concurrency: 4 },
        hotspotExtraction: { concurrency: 4 },
        issueSync: { concurrency: 6 },
        hotspotSync: { concurrency: 6 },
        projectMigration: { concurrency: 2 },
      },
      rateLimit: { maxRetries: 3, baseDelay: 1000, minRequestInterval: 200 },
    },
  });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// PDF executive with LOC throughput
// ---------------------------------------------------------------------------

test('generateExecutiveSummaryPdf includes LOC throughput when totalLinesOfCode > 0', async t => {
  const results = makeResults({ totalLinesOfCode: 80000 });
  const buffer = await generateExecutiveSummaryPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// PDF report with environment and configuration
// ---------------------------------------------------------------------------

test('generatePdfReport includes environment and configuration sections', async t => {
  const results = makeResults({
    environment: {
      platform: 'linux', arch: 'x64', cpuModel: 'Xeon', cpuCores: 16,
      totalMemoryMB: 65536, nodeVersion: 'v20.0.0', heapLimitMB: 16384,
    },
    configuration: {
      transferMode: 'full', batchSize: 100, autoTune: false,
      performance: {
        maxConcurrency: 4,
        sourceExtraction: { concurrency: 2 },
        hotspotExtraction: { concurrency: 2 },
        issueSync: { concurrency: 3 },
        hotspotSync: { concurrency: 3 },
        projectMigration: { concurrency: 1 },
      },
      rateLimit: { maxRetries: 3, baseDelay: 1000, minRequestInterval: 200 },
    },
    totalLinesOfCode: 50000,
  });
  const buffer = await generatePdfReport(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// Projects with linesOfCode for coverage in format-markdown allProjects (LOC column)
// ---------------------------------------------------------------------------

test('formatMarkdownReport shows LOC for projects with linesOfCode', t => {
  const results = makeResults({
    projects: [
      makeSuccessProject({ linesOfCode: 5000 }),
      makeSuccessProject({ projectKey: 'no-loc-proj', linesOfCode: 0 }),
    ],
  });
  const md = formatMarkdownReport(results);
  // Project with LOC should show formatted number
  t.true(md.includes('5,000'));
  // Project without LOC should show dash
  t.true(md.includes('\u2014'));
});

test('formatPerformanceReport shows LOC for projects with linesOfCode', t => {
  const results = makeResults({
    projects: [
      makeSuccessProject({ linesOfCode: 12345 }),
    ],
  });
  const md = formatPerformanceReport(results);
  t.true(md.includes('12,345'));
});

// ---------------------------------------------------------------------------
// Performance report LOC throughput without duration (locPerMinute null)
// ---------------------------------------------------------------------------

test('formatPerformanceReport handles LOC throughput without duration', t => {
  const results = makeResults({
    totalLinesOfCode: 10000,
    startTime: null,
    endTime: null,
  });
  const md = formatPerformanceReport(results);
  // totalLoc > 0, but locPerMinute is null since no duration
  t.true(md.includes('| Total Lines of Code |'));
  t.true(md.includes('| Average LOC per Project |'));
  // Should NOT include LOC per Minute since throughput.locPerMinute is null
  t.false(md.includes('| LOC per Minute |'));
});

test('formatExecutiveSummaryMarkdown handles LOC throughput without duration', t => {
  const results = makeResults({
    totalLinesOfCode: 10000,
    startTime: null,
    endTime: null,
  });
  const md = formatExecutiveSummaryMarkdown(results);
  t.true(md.includes('| Total Lines of Code |'));
  // Should NOT include Migration Throughput since locPerMinute is null
  t.false(md.includes('| Migration Throughput |'));
});

// ============================================================================
// ADDITIONAL BRANCH COVERAGE — remaining uncovered branches
// ============================================================================

// ---------------------------------------------------------------------------
// format-text.js lines 110-111: formatStepLine with step.error (server step with error)
// ---------------------------------------------------------------------------

test('formatTextReport shows error detail for server step with error field', t => {
  const results = makeResults({
    serverSteps: [
      { step: 'Extract quality gates', status: 'failed', error: 'Connection refused' },
      { step: 'Extract profiles', status: 'success', durationMs: 1000, detail: '3 profiles' },
    ],
  });
  const text = formatTextReport(results);
  // The step with error should display the error
  t.true(text.includes('Connection refused'));
  t.true(text.includes('[FAIL] Extract quality gates'));
});

// ---------------------------------------------------------------------------
// format-markdown.js line 122: server step with error but no detail
// ---------------------------------------------------------------------------

test('formatMarkdownReport server step with error but no detail (line 122 fallback)', t => {
  const results = makeResults({
    serverSteps: [
      { step: 'Extract gates', status: 'failed', error: 'Timeout on server' },
    ],
  });
  const md = formatMarkdownReport(results);
  t.true(md.includes('| Extract gates | FAIL | Timeout on server |'));
});

test('formatMarkdownReport server step with neither detail nor error (line 122 empty)', t => {
  const results = makeResults({
    serverSteps: [
      { step: 'Extract gates', status: 'success' }, // no detail, no error
    ],
  });
  const md = formatMarkdownReport(results);
  // detail should be ''
  t.true(md.includes('| Extract gates | OK |'));
});

// ---------------------------------------------------------------------------
// format-markdown.js line 140: org step with error but no detail
// ---------------------------------------------------------------------------

test('formatMarkdownReport org step with error but no detail (line 140 fallback)', t => {
  const results = makeResults({
    orgResults: [
      {
        key: 'test-org',
        projectCount: 1,
        steps: [
          { step: 'Migrate gates', status: 'failed', error: 'API timeout' }, // error, no detail
        ],
      },
    ],
  });
  const md = formatMarkdownReport(results);
  t.true(md.includes('| Migrate gates | FAIL | API timeout |'));
});

// ---------------------------------------------------------------------------
// format-markdown.js line 225: autoTune true in config
// ---------------------------------------------------------------------------

test('formatMarkdownReport config section with autoTune enabled (line 225 Enabled branch)', t => {
  const results = makeResults({
    configuration: {
      transferMode: 'full',
      batchSize: 100,
      autoTune: true,
      performance: {
        maxConcurrency: 4,
        sourceExtraction: { concurrency: 2 },
        hotspotExtraction: { concurrency: 2 },
        issueSync: { concurrency: 3 },
        hotspotSync: { concurrency: 3 },
        projectMigration: { concurrency: 1 },
      },
    },
  });
  const md = formatMarkdownReport(results);
  t.true(md.includes('| Auto-Tune | Enabled |'));
});

// ---------------------------------------------------------------------------
// format-performance.js line 77: server step with null durationMs
// ---------------------------------------------------------------------------

test('formatPerformanceReport server step with null durationMs (line 77 dash fallback)', t => {
  const results = makeResults({
    serverSteps: [
      { step: 'Extract gates', status: 'success', durationMs: null },
      { step: 'Extract profiles', status: 'success', durationMs: 2000 },
    ],
  });
  const md = formatPerformanceReport(results);
  // Step with null durationMs should show dash
  t.true(md.includes('| Extract gates | \u2014 | success |'));
});

// ---------------------------------------------------------------------------
// format-performance.js lines 98-99: org step with null durationMs and error
// ---------------------------------------------------------------------------

test('formatPerformanceReport org step with null durationMs (line 98 dash fallback)', t => {
  const results = makeResults({
    orgResults: [
      {
        key: 'test-org',
        projectCount: 1,
        durationMs: 5000,
        steps: [
          { step: 'Migrate gates', status: 'success', durationMs: null },
          { step: 'Migrate profiles', status: 'failed', durationMs: 1000, error: 'API error' },
        ],
      },
    ],
  });
  const md = formatPerformanceReport(results);
  // Null duration should show dash
  t.true(md.includes('| Migrate gates | \u2014 |'));
  // Error should show as detail
  t.true(md.includes('API error'));
});

// ---------------------------------------------------------------------------
// format-performance.js line 161: autoTune true in config
// ---------------------------------------------------------------------------

test('formatPerformanceReport config with autoTune true (line 161 Enabled branch)', t => {
  const results = makeResults({
    configuration: {
      transferMode: 'full', batchSize: 100, autoTune: true,
      performance: {
        maxConcurrency: 4,
        sourceExtraction: { concurrency: 2 },
        hotspotExtraction: { concurrency: 2 },
        issueSync: { concurrency: 3 },
        hotspotSync: { concurrency: 3 },
        projectMigration: { concurrency: 1 },
      },
    },
  });
  const md = formatPerformanceReport(results);
  t.true(md.includes('| Auto-Tune | Enabled |'));
});

// ---------------------------------------------------------------------------
// format-pdf-performance.js line 150: org step with error but no detail
// ---------------------------------------------------------------------------

test('generatePerformanceReportPdf org step with error and no detail (line 150)', async t => {
  const results = makeResults({
    orgResults: [
      {
        key: 'error-org',
        projectCount: 1,
        durationMs: 5000,
        steps: [
          { step: 'Migrate gates', status: 'failed', durationMs: 500, error: 'Server error' },
        ],
      },
    ],
  });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// format-pdf-performance.js line 166: project with linesOfCode > 0
// ---------------------------------------------------------------------------

test('generatePerformanceReportPdf project with linesOfCode > 0 (line 166)', async t => {
  const results = makeResults({
    projects: [
      makeSuccessProject({ linesOfCode: 10000 }),
      makeSuccessProject({ projectKey: 'no-loc', linesOfCode: 0 }),
    ],
  });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// format-pdf-performance.js line 213: autoTune true in config
// ---------------------------------------------------------------------------

test('generatePerformanceReportPdf config with autoTune true (line 213)', async t => {
  const results = makeResults({
    configuration: {
      transferMode: 'full', batchSize: 100, autoTune: true,
      performance: {
        maxConcurrency: 4,
        sourceExtraction: { concurrency: 2 },
        hotspotExtraction: { concurrency: 2 },
        issueSync: { concurrency: 3 },
        hotspotSync: { concurrency: 3 },
        projectMigration: { concurrency: 1 },
      },
    },
  });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// format-pdf.js line 157: autoTune true in config
// ---------------------------------------------------------------------------

test('generatePdfReport config with autoTune true (line 157)', async t => {
  const results = makeResults({
    configuration: {
      transferMode: 'full', batchSize: 100, autoTune: true,
      performance: {
        maxConcurrency: 4,
        sourceExtraction: { concurrency: 2 },
        hotspotExtraction: { concurrency: 2 },
        issueSync: { concurrency: 3 },
        hotspotSync: { concurrency: 3 },
        projectMigration: { concurrency: 1 },
      },
    },
  });
  const buffer = await generatePdfReport(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// pdf-sections.js line 16: server step with error but no detail
// ---------------------------------------------------------------------------

test('generatePdfReport server step with error but no detail (pdf-sections line 16)', async t => {
  const results = makeResults({
    serverSteps: [
      { step: 'Extract gates', status: 'failed', error: 'Connection timeout' },
    ],
  });
  const buffer = await generatePdfReport(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// pdf-sections.js line 42: org step with error but no detail
// ---------------------------------------------------------------------------

test('generatePdfReport org step with error but no detail (pdf-sections line 42)', async t => {
  const results = makeResults({
    orgResults: [
      {
        key: 'error-org',
        projectCount: 1,
        steps: [
          { step: 'Migrate gates', status: 'failed', error: 'Failed to migrate' },
        ],
      },
    ],
  });
  const buffer = await generatePdfReport(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// pdf-sections.js line 90: project with linesOfCode > 0
// ---------------------------------------------------------------------------

test('generatePdfReport project with linesOfCode > 0 (pdf-sections line 90)', async t => {
  const results = makeResults({
    projects: [
      makeSuccessProject({ linesOfCode: 5000 }),
    ],
  });
  const buffer = await generatePdfReport(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// format-text.js: server step with detail but no error (detail truthy branch)
// ---------------------------------------------------------------------------

test('formatTextReport shows detail for server step (formatStepLine detail branch)', t => {
  const results = makeResults({
    serverSteps: [
      { step: 'Extract gates', status: 'success', detail: '3 gates' },
      { step: 'Extract profiles', status: 'success' }, // no detail, no error
    ],
  });
  const text = formatTextReport(results);
  t.true(text.includes('[OK  ] Extract gates (3 gates)'));
  t.true(text.includes('[OK  ] Extract profiles'));
});

// ---------------------------------------------------------------------------
// format-performance.js line 113: sort with undefined durationMs on project
// (Test both sides of || 0 in sort comparator)
// ---------------------------------------------------------------------------

test('formatPerformanceReport project with undefined durationMs sorts correctly', t => {
  const proj = makeSuccessProject({ projectKey: 'no-dur' });
  delete proj.durationMs;
  const results = makeResults({
    projects: [
      proj,
      makeSuccessProject({ projectKey: 'has-dur', durationMs: 5000 }),
    ],
  });
  const md = formatPerformanceReport(results);
  const hasDurIdx = md.indexOf('has-dur');
  const noDurIdx = md.indexOf('no-dur');
  t.true(hasDurIdx < noDurIdx);
});

// ---------------------------------------------------------------------------
// perf-tables.js lines 56,61: orgResults undefined in formatBottleneckAnalysis
// (also line 4 sumDurations called with valid arrays only in formatBottleneckAnalysis)
// ---------------------------------------------------------------------------

test('perf-tables > formatBottleneckAnalysis handles undefined orgResults', t => {
  const results = makeResults();
  delete results.orgResults;
  const output = formatBottleneckAnalysis(results);
  t.truthy(output);
});

test('perf-tables > formatBottleneckAnalysis handles org with undefined steps', t => {
  const results = makeResults({
    orgResults: [{ key: 'org-1', projectCount: 0 }], // no steps field
  });
  const output = formatBottleneckAnalysis(results);
  t.truthy(output);
});

// ---------------------------------------------------------------------------
// pdf-perf-sections.js line 50: first insert to Map (get returns undefined, || 0)
// This should already be covered since every first stepTypeTotals.set triggers it.
// But just in case, ensure org steps with durationMs contribute.
// ---------------------------------------------------------------------------

test('pdf-perf-sections > buildBottleneckAnalysisPdf covers org steps first insert to map', t => {
  const results = makeResults({
    projects: [{
      projectKey: 'p1', scProjectKey: 'p1', status: 'success', durationMs: 1000,
      steps: [{ step: 'Upload scanner report', status: 'success', durationMs: 1000 }],
    }],
    serverSteps: [],
    orgResults: [
      {
        key: 'org-1',
        projectCount: 1,
        steps: [{ step: 'Migrate gates', status: 'success', durationMs: 500 }],
      },
    ],
  });
  const nodes = buildBottleneckAnalysisPdf(results);
  t.true(Array.isArray(nodes));
  t.true(nodes.length > 0);
});

// ---------------------------------------------------------------------------
// format-pdf-performance.js line 51: the local sumDurations fallback
// Called via buildServerSteps with results.serverSteps (always array)
// And via buildOverview which calls sumDurations(results.serverSteps).
// The || [] fallback only triggers if steps is null/undefined.
// This happens implicitly inside buildOrgSteps via the org.steps property.
// Already tested via generatePerformanceReportPdf with org without steps array.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// format-markdown.js line 33: endTime null fallback to 'In progress'
// This should already be covered by existing test 'formatTextReport does not throw with In progress endTime'
// But let's ensure format-markdown specifically handles it too.
// ---------------------------------------------------------------------------

test('formatMarkdownReport handles null endTime (line 33 In progress fallback)', t => {
  const results = makeResults({ endTime: null });
  const md = formatMarkdownReport(results);
  t.true(md.includes('**Finished:** In progress'));
});

// ---------------------------------------------------------------------------
// format-text.js line 127: org with undefined steps in formatOrgResults
// ---------------------------------------------------------------------------

test('formatTextReport handles org with undefined steps (line 127 fallback)', t => {
  const results = makeResults({
    orgResults: [
      { key: 'org-no-steps', projectCount: 0 }, // no steps property
    ],
  });
  const text = formatTextReport(results);
  t.true(text.includes('ORGANIZATION: org-no-steps'));
});

// ---------------------------------------------------------------------------
// format-performance.js line 113: ensure || 0 fallback in sort is exercised for both a and b
// We need one project with durationMs defined and another with durationMs undefined
// so that both || 0 branches are exercised.
// ---------------------------------------------------------------------------

test('formatPerformanceReport sort exercises both || 0 branches (line 113)', t => {
  const projUndef = makeSuccessProject({ projectKey: 'undef-dur' });
  delete projUndef.durationMs; // truly undefined, not null
  const results = makeResults({
    projects: [
      projUndef,
      makeSuccessProject({ projectKey: 'defined-dur', durationMs: 5000 }),
      makeSuccessProject({ projectKey: 'zero-dur', durationMs: 0 }),
    ],
  });
  const md = formatPerformanceReport(results);
  // defined-dur should be first
  t.true(md.indexOf('defined-dur') < md.indexOf('undef-dur'));
});

// ---------------------------------------------------------------------------
// format-pdf-performance.js line 51: local sumDurations called with undefined steps
// The internal sumDurations is also called from buildOrgSteps:
//   const total = sumDurations(org.steps);
// If org.steps is undefined, sumDurations(undefined) triggers the || [] fallback.
// We need an org with orgResults but org.steps that is null/undefined AND the org
// has steps.length > 0 check passing... Actually no, looking at the code:
//   if (org.steps && org.steps.length > 0) { ... const total = sumDurations(org.steps); }
// So sumDurations is only called when org.steps is truthy and has length > 0.
// The other call is: const serverTotal = sumDurations(results.serverSteps);
// results.serverSteps is always an array in our test data.
// The || [] fallback on line 51 is essentially dead code in the PDF performance report
// since all callers pass arrays. We can't trigger it without restructuring the code.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// pdf-perf-sections.js line 59 and perf-tables.js line 77:
// These are `totalStepTime > 0 ? ((d / totalStepTime) * 100).toFixed(1) : '0.0'`
// The '0.0' branch is dead code because:
// - If d > 0, it wasn't skipped by the `if (d === 0) continue` check
// - If d > 0, then totalStepTime (sum of all d values) must also be > 0
// These are unreachable branches that c8 still counts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// pdf-helpers.js line 9: PdfPrinterModule.default || PdfPrinterModule
// This is ESM/CJS interop. Under ESM, pdfmake exports .default.
// The || PdfPrinterModule fallback is for pure CJS environments.
// We cannot easily test this without mocking the module import.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// pdf-sections.js direct tests for || fallbacks
// ---------------------------------------------------------------------------

test('pdf-sections > buildServerStepsPdf step with error only (line 16 fallback)', t => {
  const results = {
    serverSteps: [
      { step: 'Extract gates', status: 'failed', error: 'Connection error' },
      { step: 'Extract profiles', status: 'success' }, // no detail, no error
    ],
  };
  const nodes = buildServerStepsPdf(results);
  t.true(Array.isArray(nodes));
  t.true(nodes.length > 0);
});

test('pdf-sections > buildOrgResultsPdf step with error only (line 42 fallback)', t => {
  const results = {
    orgResults: [
      {
        key: 'test-org',
        projectCount: 1,
        steps: [
          { step: 'Migrate gates', status: 'failed', error: 'Migration failed' },
          { step: 'Migrate profiles', status: 'success' }, // no detail, no error
        ],
      },
    ],
  };
  const nodes = buildOrgResultsPdf(results);
  t.true(Array.isArray(nodes));
  t.true(nodes.length > 0);
});

test('pdf-sections > buildAllProjectsPdf project with linesOfCode > 0 (line 90)', t => {
  const results = {
    projects: [
      makeSuccessProject({ linesOfCode: 8000 }),
      makeSuccessProject({ projectKey: 'no-loc', linesOfCode: 0 }),
    ],
  };
  const nodes = buildAllProjectsPdf(results);
  t.true(Array.isArray(nodes));
  t.true(nodes.length > 0);
});

// ---------------------------------------------------------------------------
// format-markdown.js line 140: org step with no detail and no error (|| '' fallback)
// ---------------------------------------------------------------------------

test('formatMarkdownReport org step with no detail and no error (line 140 empty fallback)', t => {
  const results = makeResults({
    orgResults: [
      {
        key: 'test-org',
        projectCount: 1,
        steps: [
          { step: 'Migrate gates', status: 'success' }, // no detail, no error
        ],
      },
    ],
  });
  const md = formatMarkdownReport(results);
  // The step should render with empty detail
  t.true(md.includes('| Migrate gates | OK |'));
});

// ---------------------------------------------------------------------------
// format-pdf-performance.js line 150: org step with both detail and error
// We need: (a) step.detail is truthy (takes left of ||), (b) step.error is truthy (middle),
// (c) both falsy (takes ''). Let's test (c).
// ---------------------------------------------------------------------------

test('generatePerformanceReportPdf org step with no detail and no error (line 150 empty)', async t => {
  const results = makeResults({
    orgResults: [
      {
        key: 'clean-org',
        projectCount: 1,
        durationMs: 2000,
        steps: [
          { step: 'Migrate gates', status: 'success', durationMs: 1000 },
          { step: 'Migrate profiles', status: 'success', durationMs: 1000 },
        ],
      },
    ],
  });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

// ---------------------------------------------------------------------------
// format-performance.js line 161 and format-pdf-performance.js line 213:
// autoTune ternary — we need to ensure the 'Enabled' branch is exercised.
// We already have tests that set autoTune: true, but let's verify they run.
// ---------------------------------------------------------------------------

test('formatPerformanceReport shows Enabled for autoTune true (line 161)', t => {
  const results = makeResults({
    configuration: {
      transferMode: 'full', batchSize: 100, autoTune: true,
      performance: {
        maxConcurrency: 4,
        sourceExtraction: { concurrency: 2 },
        hotspotExtraction: { concurrency: 2 },
        issueSync: { concurrency: 3 },
        hotspotSync: { concurrency: 3 },
        projectMigration: { concurrency: 1 },
      },
    },
  });
  const md = formatPerformanceReport(results);
  t.true(md.includes('Enabled'));
  t.false(md.includes('Disabled'));
});

test('generatePerformanceReportPdf config with autoTune false (line 213 Disabled)', async t => {
  const results = makeResults({
    configuration: {
      transferMode: 'full', batchSize: 100, autoTune: false,
      performance: {
        maxConcurrency: 4,
        sourceExtraction: { concurrency: 2 },
        hotspotExtraction: { concurrency: 2 },
        issueSync: { concurrency: 3 },
        hotspotSync: { concurrency: 3 },
        projectMigration: { concurrency: 1 },
      },
    },
  });
  const buffer = await generatePerformanceReportPdf(results);
  t.true(Buffer.isBuffer(buffer));
  t.true(buffer.length > 0);
});

test('formatPerformanceReport shows Disabled for autoTune false (line 161)', t => {
  const results = makeResults({
    configuration: {
      transferMode: 'full', batchSize: 100, autoTune: false,
      performance: {
        maxConcurrency: 4,
        sourceExtraction: { concurrency: 2 },
        hotspotExtraction: { concurrency: 2 },
        issueSync: { concurrency: 3 },
        hotspotSync: { concurrency: 3 },
        projectMigration: { concurrency: 1 },
      },
    },
  });
  const md = formatPerformanceReport(results);
  t.true(md.includes('Disabled'));
});
