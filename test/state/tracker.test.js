import test from 'ava';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { StateTracker } from '../../src/shared/state/tracker.js';

function getTmpDir() {
  return join(tmpdir(), `cloudvoyager-test-${randomUUID()}`);
}

test('StateTracker constructor initializes empty state', t => {
  const tracker = new StateTracker('/tmp/test.json');
  t.truthy(tracker);
  const summary = tracker.getSummary();
  t.is(summary.lastSync, null);
  t.is(summary.processedIssuesCount, 0);
  t.is(summary.completedBranchesCount, 0);
  t.is(summary.syncHistoryCount, 0);
});

test('StateTracker.initialize loads existing state', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'state.json');
  const existing = {
    lastSync: '2024-01-01',
    processedIssues: ['issue-1'],
    completedBranches: ['main'],
    syncHistory: [{ success: true }]
  };
  await writeFile(path, JSON.stringify(existing), 'utf-8');

  const tracker = new StateTracker(path);
  await tracker.initialize();
  t.is(tracker.getLastSync(), '2024-01-01');
  t.true(tracker.isIssueProcessed('issue-1'));
  t.true(tracker.isBranchCompleted('main'));
  const summary = tracker.getSummary();
  t.is(summary.syncHistoryCount, 1);
  await rm(dir, { recursive: true });
});

test('StateTracker.initialize starts fresh when no file', async t => {
  const tracker = new StateTracker('/nonexistent/state.json');
  await tracker.initialize();
  t.is(tracker.getLastSync(), null);
  const summary = tracker.getSummary();
  t.is(summary.processedIssuesCount, 0);
});

test('StateTracker.getLastSync returns lastSync', t => {
  const tracker = new StateTracker('/tmp/test.json');
  t.is(tracker.getLastSync(), null);
  tracker.updateLastSync('2024-06-01');
  t.is(tracker.getLastSync(), '2024-06-01');
});

test('StateTracker.isIssueProcessed checks issue list', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markIssueProcessed('issue-1');
  tracker.markIssueProcessed('issue-2');
  t.true(tracker.isIssueProcessed('issue-1'));
  t.false(tracker.isIssueProcessed('issue-3'));
});

test('StateTracker.markIssueProcessed adds to list', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markIssueProcessed('issue-1');
  t.true(tracker.isIssueProcessed('issue-1'));
});

test('StateTracker.markIssueProcessed does not duplicate', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markIssueProcessed('issue-1');
  tracker.markIssueProcessed('issue-1');
  const summary = tracker.getSummary();
  // processedIssuesCount counts unique issues in the set
  t.true(tracker.isIssueProcessed('issue-1'));
  t.is(summary.processedIssuesCount, 1);
});

test('StateTracker.markIssuesProcessed adds multiple', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markIssuesProcessed(['issue-1', 'issue-2', 'issue-3']);
  t.is(tracker.getSummary().processedIssuesCount, 3);
});

test('StateTracker.isBranchCompleted checks branch list', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markBranchCompleted('main');
  t.true(tracker.isBranchCompleted('main'));
  t.false(tracker.isBranchCompleted('develop'));
});

test('StateTracker.markBranchCompleted adds to list', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markBranchCompleted('main');
  t.true(tracker.isBranchCompleted('main'));
});

test('StateTracker.markBranchCompleted does not duplicate', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markBranchCompleted('main');
  tracker.markBranchCompleted('main');
  const summary = tracker.getSummary();
  t.is(summary.completedBranchesCount, 1);
});

test('StateTracker.updateLastSync sets current time by default', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.updateLastSync();
  t.truthy(tracker.getLastSync());
  t.true(new Date(tracker.getLastSync()).getTime() > 0);
});

test('StateTracker.updateLastSync sets specific timestamp', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.updateLastSync('2024-06-01T00:00:00Z');
  t.is(tracker.getLastSync(), '2024-06-01T00:00:00Z');
});

test('StateTracker.addSyncHistory adds entry with timestamp', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.addSyncHistory({ success: true, stats: { issues: 10 } });
  const summary = tracker.getSummary();
  t.is(summary.syncHistoryCount, 1);
});

test('StateTracker.addSyncHistory keeps only last 10', t => {
  const tracker = new StateTracker('/tmp/test.json');
  for (let i = 0; i < 15; i++) {
    tracker.addSyncHistory({ success: true, index: i });
  }
  const summary = tracker.getSummary();
  t.is(summary.syncHistoryCount, 10);
});

test('StateTracker.save persists state', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'state.json');

  const tracker = new StateTracker(path);
  tracker.markIssueProcessed('issue-1');
  tracker.markBranchCompleted('main');
  await tracker.save();

  const content = await readFile(path, 'utf-8');
  const saved = JSON.parse(content);
  t.deepEqual(saved.processedIssues, ['issue-1']);
  t.deepEqual(saved.completedBranches, ['main']);
  await rm(dir, { recursive: true });
});

test('StateTracker.reset clears state and file', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'state.json');
  await writeFile(path, '{"lastSync":"2024-01-01"}', 'utf-8');

  const tracker = new StateTracker(path);
  await tracker.initialize();
  t.is(tracker.getLastSync(), '2024-01-01');

  await tracker.reset();
  t.is(tracker.getLastSync(), null);
  const summary = tracker.getSummary();
  t.is(summary.processedIssuesCount, 0);
  t.is(summary.completedBranchesCount, 0);
  t.is(summary.syncHistoryCount, 0);
  await rm(dir, { recursive: true });
});

test('StateTracker.getSummary returns summary', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markIssueProcessed('issue-1');
  tracker.markIssueProcessed('issue-2');
  tracker.markBranchCompleted('main');
  tracker.addSyncHistory({ success: true });

  const summary = tracker.getSummary();
  t.is(summary.lastSync, null);
  t.is(summary.processedIssuesCount, 2);
  t.is(summary.completedBranchesCount, 1);
  t.is(summary.syncHistoryCount, 1);
  t.deepEqual(summary.completedBranches, ['main']);
});

test('StateTracker.recordTransfer updates sync and saves', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'state.json');

  const tracker = new StateTracker(path);
  await tracker.recordTransfer({ issuesTransferred: 5 });

  t.truthy(tracker.getLastSync());
  const summary = tracker.getSummary();
  t.is(summary.syncHistoryCount, 1);

  const content = await readFile(path, 'utf-8');
  t.truthy(JSON.parse(content).lastSync);
  await rm(dir, { recursive: true });
});
