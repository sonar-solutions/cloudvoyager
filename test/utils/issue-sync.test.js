import test from 'ava';
import sinon from 'sinon';
import { hasManualChanges } from '../../src/shared/utils/issue-sync/has-manual-changes.js';
import { fetchSqChangelogs } from '../../src/shared/utils/issue-sync/fetch-sq-changelogs.js';

test.afterEach(() => sinon.restore());

// ============================================================================
// hasManualChanges - Changelog detection
// ============================================================================

test('hasManualChanges returns true when changelog has human-authored entry', t => {
  const issue = { key: 'i1' };
  const changelog = [{ user: 'alice', diffs: [{ key: 'status' }] }];
  t.true(hasManualChanges(issue, changelog));
});

test('hasManualChanges returns false when changelog has no user field', t => {
  const issue = { key: 'i1' };
  const changelog = [{ user: '', diffs: [{ key: 'status' }] }];
  t.false(hasManualChanges(issue, changelog));
});

test('hasManualChanges returns false when changelog entries have empty user', t => {
  const issue = { key: 'i1' };
  const changelog = [
    { user: '', diffs: [{ key: 'status' }] },
    { diffs: [{ key: 'severity' }] },
  ];
  t.false(hasManualChanges(issue, changelog));
});

test('hasManualChanges returns false for empty changelog', t => {
  const issue = { key: 'i1' };
  t.false(hasManualChanges(issue, []));
});

test('hasManualChanges returns false for undefined changelog', t => {
  const issue = { key: 'i1' };
  t.false(hasManualChanges(issue, undefined));
});

// ============================================================================
// hasManualChanges - Comment detection
// ============================================================================

test('hasManualChanges returns true when issue has non-migrated comment (markdown)', t => {
  const issue = {
    key: 'i1',
    comments: [{ markdown: 'This is a real user comment' }],
  };
  t.true(hasManualChanges(issue, []));
});

test('hasManualChanges returns true when issue has non-migrated comment (htmlText)', t => {
  const issue = {
    key: 'i1',
    comments: [{ htmlText: 'Real comment' }],
  };
  t.true(hasManualChanges(issue, []));
});

test('hasManualChanges returns false when all comments are migrated', t => {
  const issue = {
    key: 'i1',
    comments: [
      { markdown: '[Migrated from SonarQube] bob (2024-01-01): Fix this' },
      { markdown: '[Migrated from SonarQube] alice (2024-01-02): Done' },
    ],
  };
  t.false(hasManualChanges(issue, []));
});

test('hasManualChanges returns true when mix of migrated and manual comments', t => {
  const issue = {
    key: 'i1',
    comments: [
      { markdown: '[Migrated from SonarQube] bob (2024-01-01): Fix this' },
      { markdown: 'I added this comment manually' },
    ],
  };
  t.true(hasManualChanges(issue, []));
});

test('hasManualChanges returns false when no comments', t => {
  const issue = { key: 'i1', comments: [] };
  t.false(hasManualChanges(issue, []));
});

test('hasManualChanges returns false when comments field is missing', t => {
  const issue = { key: 'i1' };
  t.false(hasManualChanges(issue, []));
});

// ============================================================================
// hasManualChanges - Tag detection
// ============================================================================

test('hasManualChanges returns true when issue has tags', t => {
  const issue = { key: 'i1', tags: ['security', 'bug'] };
  t.true(hasManualChanges(issue, []));
});

test('hasManualChanges returns false when tags array is empty', t => {
  const issue = { key: 'i1', tags: [] };
  t.false(hasManualChanges(issue, []));
});

test('hasManualChanges returns false when tags field is missing', t => {
  const issue = { key: 'i1' };
  t.false(hasManualChanges(issue, []));
});

// ============================================================================
// hasManualChanges - Combined scenarios
// ============================================================================

test('hasManualChanges returns false for pristine issue (no changelog, no comments, no tags)', t => {
  const issue = { key: 'i1', comments: [], tags: [] };
  t.false(hasManualChanges(issue, []));
});

test('hasManualChanges detects changelog even with empty comments and tags', t => {
  const issue = { key: 'i1', comments: [], tags: [] };
  const changelog = [{ user: 'admin', diffs: [{ key: 'status' }] }];
  t.true(hasManualChanges(issue, changelog));
});

test('hasManualChanges detects tags even with empty changelog and comments', t => {
  const issue = { key: 'i1', comments: [], tags: ['custom-tag'] };
  t.true(hasManualChanges(issue, []));
});

// ============================================================================
// fetchSqChangelogs
// ============================================================================

test('fetchSqChangelogs returns empty map for empty issue list', async t => {
  const sqClient = { getIssueChangelog: sinon.stub() };
  const result = await fetchSqChangelogs([], sqClient);
  t.is(result.size, 0);
  t.is(sqClient.getIssueChangelog.callCount, 0);
});

test('fetchSqChangelogs fetches changelogs for each issue', async t => {
  const changelog1 = [{ user: 'alice', diffs: [] }];
  const changelog2 = [{ user: 'bob', diffs: [] }];
  const sqClient = {
    getIssueChangelog: sinon.stub()
      .onFirstCall().resolves(changelog1)
      .onSecondCall().resolves(changelog2),
  };
  const issues = [{ key: 'i1' }, { key: 'i2' }];

  const result = await fetchSqChangelogs(issues, sqClient);

  t.is(result.size, 2);
  t.deepEqual(result.get('i1'), changelog1);
  t.deepEqual(result.get('i2'), changelog2);
});

test('fetchSqChangelogs stores empty array on API failure', async t => {
  const sqClient = {
    getIssueChangelog: sinon.stub()
      .onFirstCall().resolves([{ user: 'alice' }])
      .onSecondCall().rejects(new Error('API error')),
  };
  const issues = [{ key: 'i1' }, { key: 'i2' }];

  const result = await fetchSqChangelogs(issues, sqClient);

  t.is(result.size, 2);
  t.deepEqual(result.get('i1'), [{ user: 'alice' }]);
  t.deepEqual(result.get('i2'), []);
});

test('fetchSqChangelogs respects concurrency parameter', async t => {
  let maxConcurrent = 0;
  let current = 0;

  const sqClient = {
    getIssueChangelog: sinon.stub().callsFake(async () => {
      current++;
      if (current > maxConcurrent) maxConcurrent = current;
      await new Promise(r => setTimeout(r, 10));
      current--;
      return [];
    }),
  };

  const issues = Array.from({ length: 20 }, (_, i) => ({ key: `i${i}` }));
  await fetchSqChangelogs(issues, sqClient, 3);

  t.true(maxConcurrent <= 3, `Max concurrent was ${maxConcurrent}, expected <= 3`);
  t.is(sqClient.getIssueChangelog.callCount, 20);
});

// ============================================================================
// Performance regression: pre-filter eliminates unnecessary work
// ============================================================================

test('pre-filter reduces issues to only those with manual changes', t => {
  const totalIssues = 10000;
  const manualChangeRate = 0.02;

  const issues = Array.from({ length: totalIssues }, (_, i) => ({
    key: `sq-${i}`,
    comments: [],
    tags: [],
  }));

  const changelogs = new Map();
  for (let i = 0; i < totalIssues; i++) {
    if (i < totalIssues * manualChangeRate) {
      changelogs.set(`sq-${i}`, [{ user: 'alice', diffs: [{ key: 'status' }] }]);
    } else {
      changelogs.set(`sq-${i}`, []);
    }
  }

  const filtered = issues.filter(issue =>
    hasManualChanges(issue, changelogs.get(issue.key) ?? []),
  );

  const reductionRatio = filtered.length / totalIssues;
  t.is(filtered.length, totalIssues * manualChangeRate);
  t.true(reductionRatio <= 0.05, `Reduction ratio ${reductionRatio} exceeds 5% tolerance`);
});

test('pre-filter handles worst case where all issues have manual changes', t => {
  const totalIssues = 1000;

  const issues = Array.from({ length: totalIssues }, (_, i) => ({
    key: `sq-${i}`,
    comments: [{ markdown: 'manual comment' }],
    tags: ['custom-tag'],
  }));

  const changelogs = new Map();
  for (let i = 0; i < totalIssues; i++) {
    changelogs.set(`sq-${i}`, [{ user: 'admin', diffs: [] }]);
  }

  const filtered = issues.filter(issue =>
    hasManualChanges(issue, changelogs.get(issue.key) ?? []),
  );

  t.is(filtered.length, totalIssues);
});

test('pre-filter with realistic mixed data stays within performance tolerance', t => {
  const totalIssues = 50000;
  const maxAcceptableRatio = 0.1;

  const issues = Array.from({ length: totalIssues }, (_, i) => {
    const bucket = i % 100;
    if (bucket === 0) return { key: `sq-${i}`, comments: [{ markdown: 'user note' }], tags: [] };
    if (bucket === 1) return { key: `sq-${i}`, comments: [], tags: ['security'] };
    if (bucket < 4) return { key: `sq-${i}`, comments: [{ markdown: '[Migrated from SonarQube] auto' }], tags: [] };
    return { key: `sq-${i}`, comments: [], tags: [] };
  });

  const changelogs = new Map();
  for (let i = 0; i < totalIssues; i++) {
    const bucket = i % 100;
    if (bucket < 2) {
      changelogs.set(`sq-${i}`, [{ user: 'human', diffs: [{ key: 'status' }] }]);
    } else {
      changelogs.set(`sq-${i}`, []);
    }
  }

  const start = performance.now();
  const filtered = issues.filter(issue =>
    hasManualChanges(issue, changelogs.get(issue.key) ?? []),
  );
  const elapsed = performance.now() - start;

  const ratio = filtered.length / totalIssues;
  t.true(
    ratio <= maxAcceptableRatio,
    `Filtered ${filtered.length}/${totalIssues} (${(ratio * 100).toFixed(1)}%) exceeds ${maxAcceptableRatio * 100}% tolerance`,
  );
  t.true(
    elapsed < 1000,
    `Filtering ${totalIssues} issues took ${elapsed.toFixed(0)}ms, expected <1000ms`,
  );
});
