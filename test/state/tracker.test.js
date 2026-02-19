import test from 'ava';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { StateTracker } from '../../src/state/tracker.js';

function getTmpDir() {
  return join(tmpdir(), `cloudvoyager-test-${randomUUID()}`);
}

test('StateTracker constructor initializes empty state', t => {
  const tracker = new StateTracker('/tmp/test.json');
  t.truthy(tracker.storage);
  t.is(tracker.state.lastSync, null);
  t.deepEqual(tracker.state.processedIssues, []);
  t.deepEqual(tracker.state.completedBranches, []);
  t.deepEqual(tracker.state.syncHistory, []);
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
  t.is(tracker.state.lastSync, '2024-01-01');
  t.deepEqual(tracker.state.processedIssues, ['issue-1']);
  t.deepEqual(tracker.state.completedBranches, ['main']);
  await rm(dir, { recursive: true });
});

test('StateTracker.initialize starts fresh when no file', async t => {
  const tracker = new StateTracker('/nonexistent/state.json');
  await tracker.initialize();
  t.is(tracker.state.lastSync, null);
  t.deepEqual(tracker.state.processedIssues, []);
});

test('StateTracker.getLastSync returns lastSync', t => {
  const tracker = new StateTracker('/tmp/test.json');
  t.is(tracker.getLastSync(), null);
  tracker.state.lastSync = '2024-06-01';
  t.is(tracker.getLastSync(), '2024-06-01');
});

test('StateTracker.isIssueProcessed checks issue list', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.state.processedIssues = ['issue-1', 'issue-2'];
  t.true(tracker.isIssueProcessed('issue-1'));
  t.false(tracker.isIssueProcessed('issue-3'));
});

test('StateTracker.markIssueProcessed adds to list', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markIssueProcessed('issue-1');
  t.true(tracker.state.processedIssues.includes('issue-1'));
});

test('StateTracker.markIssueProcessed does not duplicate', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markIssueProcessed('issue-1');
  tracker.markIssueProcessed('issue-1');
  t.is(tracker.state.processedIssues.filter(k => k === 'issue-1').length, 1);
});

test('StateTracker.markIssuesProcessed adds multiple', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markIssuesProcessed(['issue-1', 'issue-2', 'issue-3']);
  t.is(tracker.state.processedIssues.length, 3);
});

test('StateTracker.isBranchCompleted checks branch list', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.state.completedBranches = ['main'];
  t.true(tracker.isBranchCompleted('main'));
  t.false(tracker.isBranchCompleted('develop'));
});

test('StateTracker.markBranchCompleted adds to list', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markBranchCompleted('main');
  t.true(tracker.state.completedBranches.includes('main'));
});

test('StateTracker.markBranchCompleted does not duplicate', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.markBranchCompleted('main');
  tracker.markBranchCompleted('main');
  t.is(tracker.state.completedBranches.filter(b => b === 'main').length, 1);
});

test('StateTracker.updateLastSync sets current time by default', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.updateLastSync();
  t.truthy(tracker.state.lastSync);
  t.true(new Date(tracker.state.lastSync).getTime() > 0);
});

test('StateTracker.updateLastSync sets specific timestamp', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.updateLastSync('2024-06-01T00:00:00Z');
  t.is(tracker.state.lastSync, '2024-06-01T00:00:00Z');
});

test('StateTracker.addSyncHistory adds entry with timestamp', t => {
  const tracker = new StateTracker('/tmp/test.json');
  tracker.addSyncHistory({ success: true, stats: { issues: 10 } });
  t.is(tracker.state.syncHistory.length, 1);
  t.true(tracker.state.syncHistory[0].success);
  t.truthy(tracker.state.syncHistory[0].timestamp);
});

test('StateTracker.addSyncHistory keeps only last 10', t => {
  const tracker = new StateTracker('/tmp/test.json');
  for (let i = 0; i < 15; i++) {
    tracker.addSyncHistory({ success: true, index: i });
  }
  t.is(tracker.state.syncHistory.length, 10);
  t.is(tracker.state.syncHistory[0].index, 5);
  t.is(tracker.state.syncHistory[9].index, 14);
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
  t.is(tracker.state.lastSync, '2024-01-01');

  await tracker.reset();
  t.is(tracker.state.lastSync, null);
  t.deepEqual(tracker.state.processedIssues, []);
  t.deepEqual(tracker.state.completedBranches, []);
  t.deepEqual(tracker.state.syncHistory, []);
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

  t.truthy(tracker.state.lastSync);
  t.is(tracker.state.syncHistory.length, 1);
  t.true(tracker.state.syncHistory[0].success);
  t.deepEqual(tracker.state.syncHistory[0].stats, { issuesTransferred: 5 });

  const content = await readFile(path, 'utf-8');
  t.truthy(JSON.parse(content).lastSync);
  await rm(dir, { recursive: true });
});
