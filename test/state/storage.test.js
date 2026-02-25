import test from 'ava';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { StateStorage } from '../../src/state/storage.js';
import { StateError } from '../../src/utils/errors.js';

function getTmpDir() {
  return join(tmpdir(), `cloudvoyager-test-${randomUUID()}`);
}

test('StateStorage constructor sets filePath', t => {
  const storage = new StateStorage('/tmp/test-state.json');
  t.is(storage.filePath, '/tmp/test-state.json');
});

test('StateStorage.load returns null when file does not exist', async t => {
  const storage = new StateStorage('/nonexistent/state.json');
  const result = await storage.load();
  t.is(result, null);
});

test('StateStorage.load reads and parses JSON', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'state.json');
  const state = { lastSync: '2024-01-01', processedIssues: ['a', 'b'] };
  await writeFile(path, JSON.stringify(state), 'utf-8');

  const storage = new StateStorage(path);
  const result = await storage.load();
  t.deepEqual(result, state);
  await rm(dir, { recursive: true });
});

test('StateStorage.load throws StateError for invalid JSON', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'bad.json');
  await writeFile(path, 'not json!!!', 'utf-8');

  const storage = new StateStorage(path);
  await t.throwsAsync(() => storage.load(), { instanceOf: StateError, message: /Invalid JSON/ });
  await rm(dir, { recursive: true });
});

test('StateStorage.save writes state to file', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'state.json');

  const storage = new StateStorage(path);
  const state = { lastSync: '2024-01-01', data: [1, 2, 3] };
  await storage.save(state);

  const content = await readFile(path, 'utf-8');
  t.deepEqual(JSON.parse(content), state);
  await rm(dir, { recursive: true });
});

test('StateStorage.save throws StateError on write failure', async t => {
  const storage = new StateStorage('/nonexistent/dir/state.json');
  await t.throwsAsync(() => storage.save({ test: true }), { instanceOf: StateError, message: /Failed to save/ });
});

test('StateStorage.clear removes state file', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'state.json');
  await writeFile(path, '{}', 'utf-8');

  const storage = new StateStorage(path);
  t.true(storage.exists());
  await storage.clear();
  t.false(storage.exists());
  await rm(dir, { recursive: true });
});

test('StateStorage.clear does nothing when file does not exist', async t => {
  const storage = new StateStorage('/nonexistent/state.json');
  await t.notThrowsAsync(() => storage.clear());
});

test('StateStorage.exists returns true when file exists', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'state.json');
  await writeFile(path, '{}', 'utf-8');

  const storage = new StateStorage(path);
  t.true(storage.exists());
  await rm(dir, { recursive: true });
});

test('StateStorage.exists returns false when file does not exist', t => {
  const storage = new StateStorage('/nonexistent/state.json');
  t.false(storage.exists());
});

// --- Tests for uncovered error paths ---

test('StateStorage.load throws StateError for non-SyntaxError read failures', async t => {
  // Use a directory path instead of a file — readFile on a directory throws EISDIR, not SyntaxError
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });

  // Point at the directory itself (not a file inside it)
  const storage = new StateStorage(dir);
  await t.throwsAsync(() => storage.load(), { instanceOf: StateError, message: /Failed to load state/ });
  await rm(dir, { recursive: true });
});

// --- StateTracker tests for uncovered branches ---

import { StateTracker } from '../../src/state/tracker.js';

// Line 32: `this.state.lastSync || 'never'` — the 'never' fallback when lastSync is null
test('StateTracker.initialize logs "never" when lastSync is null in saved state', async t => {
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'state.json');
  // Write a saved state where lastSync is null
  const savedState = { lastSync: null, processedIssues: ['issue-1'], completedBranches: [], syncHistory: [] };
  await writeFile(path, JSON.stringify(savedState), 'utf-8');

  const tracker = new StateTracker(path);
  await tracker.initialize();

  // The state should have been loaded with lastSync = null
  t.is(tracker.getLastSync(), null);
  // processedIssues should have been loaded from saved state
  t.true(tracker.isIssueProcessed('issue-1'));
  await rm(dir, { recursive: true });
});

test('StateStorage.clear throws StateError when unlink fails', async t => {
  // Create a directory with a file inside it, then try to clear() the directory path
  // unlink on a directory should fail with EPERM or EISDIR
  const dir = getTmpDir();
  await mkdir(dir, { recursive: true });
  const innerDir = join(dir, 'state.json');
  // Create a directory where unlink expects a file
  await mkdir(innerDir, { recursive: true });
  // Put a file inside so the directory is not empty (unlink on dir fails)
  await writeFile(join(innerDir, 'dummy.txt'), 'x', 'utf-8');

  const storage = new StateStorage(innerDir);
  await t.throwsAsync(() => storage.clear(), { instanceOf: StateError, message: /Failed to clear state/ });
  await rm(dir, { recursive: true, force: true });
});
