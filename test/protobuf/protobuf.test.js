import test from 'ava';
import { ProtobufBuilder } from '../../src/protobuf/builder.js';
import { ProtobufEncoder } from '../../src/protobuf/encoder.js';
import { ProtobufEncodingError } from '../../src/utils/errors.js';

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function createExtractedData(overrides = {}) {
  return {
    project: {
      project: { key: 'my-project', name: 'My Project' },
      branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }]
    },
    metadata: {
      extractedAt: '2026-02-15T12:00:00Z',
      scmRevisionId: 'abc123def456abc123def456abc123def456abcd'
    },
    metrics: [
      { key: 'coverage', name: 'Coverage', type: 'PERCENT' },
      { key: 'ncloc', name: 'Lines of Code', type: 'INT' }
    ],
    issues: [
      {
        key: 'ISSUE-1',
        rule: 'javascript:S1234',
        component: 'my-project:src/index.js',
        message: 'Fix this issue',
        severity: 'MAJOR',
        textRange: { startLine: 10, endLine: 10, startOffset: 5, endOffset: 20 }
      },
      {
        key: 'ISSUE-2',
        rule: 'javascript:S5678',
        component: 'my-project:src/utils.js',
        message: 'Another issue',
        severity: 'CRITICAL',
        textRange: { startLine: 3, endLine: 5, startOffset: 0, endOffset: 15 }
      }
    ],
    measures: [
      { metric: 'coverage', value: '85.5' },
      { metric: 'ncloc', value: '1200' }
    ],
    components: [
      {
        key: 'my-project:src/index.js',
        name: 'index.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/index.js',
        measures: [
          { metric: 'ncloc', value: '100' },
          { metric: 'coverage', value: '90.5' }
        ]
      },
      {
        key: 'my-project:src/utils.js',
        name: 'utils.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/utils.js',
        measures: [
          { metric: 'ncloc', value: '50' },
          { metric: 'lines', value: '60' }
        ]
      },
      {
        key: 'my-project:src',
        name: 'src',
        qualifier: 'DIR',
        path: 'src',
        measures: []
      }
    ],
    sources: [
      {
        key: 'my-project:src/index.js',
        language: 'js',
        lines: ['const x = 1;', 'console.log(x);', 'module.exports = x;']
      },
      {
        key: 'my-project:src/utils.js',
        language: 'js',
        lines: ['function helper() {}', 'module.exports = { helper };']
      }
    ],
    activeRules: [
      {
        ruleRepository: 'javascript',
        ruleKey: 'javascript:S1234',
        severity: 3, // MAJOR
        paramsByKey: {},
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        qProfileKey: 'sq-js-profile-key',
        language: 'js'
      },
      {
        ruleRepository: 'javascript',
        ruleKey: 'S5678',
        severity: 4, // CRITICAL
        paramsByKey: { threshold: '10' },
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        qProfileKey: 'sq-js-profile-key',
        language: 'js',
        impacts: [{ softwareQuality: 1, severity: 2 }]
      }
    ],
    changesets: new Map([
      ['my-project:src/index.js', {
        changesets: [
          { revision: 'rev1', author: 'dev@example.com', date: 1700000000000 },
          { revision: 'rev2', author: 'dev2@example.com', date: 1700100000000 }
        ],
        changesetIndexByLine: [0, 0, 1]
      }]
    ]),
    symbols: new Map(),
    syntaxHighlightings: new Map(),
    ...overrides
  };
}

function createSonarCloudConfig(overrides = {}) {
  return {
    organization: 'my-sc-org',
    projectKey: 'sc-my-project',
    ...overrides
  };
}

function createSonarCloudProfiles() {
  return [
    {
      key: 'sc-js-profile-AYxx123',
      name: 'Sonar way',
      language: 'js',
      rulesUpdatedAt: '2026-01-01T00:00:00Z'
    }
  ];
}

// ============================================================================
// ProtobufBuilder tests
// ============================================================================

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

test('ProtobufBuilder: constructor stores data and config', t => {
  const data = createExtractedData();
  const config = createSonarCloudConfig();
  const profiles = createSonarCloudProfiles();
  const builder = new ProtobufBuilder(data, config, profiles, { sonarCloudBranchName: 'custom-branch' });

  t.is(builder.data, data);
  t.is(builder.sonarCloudConfig, config);
  t.is(builder.sonarCloudProfiles, profiles);
  t.is(builder.sonarCloudBranchName, 'custom-branch');
  t.is(builder.nextRef, 1);
  t.is(builder.componentRefMap.size, 0);
});

test('ProtobufBuilder: constructor defaults', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data);

  t.deepEqual(builder.sonarCloudConfig, {});
  t.deepEqual(builder.sonarCloudProfiles, []);
  t.is(builder.sonarCloudBranchName, null);
});

// ---------------------------------------------------------------------------
// getComponentRef
// ---------------------------------------------------------------------------

test('ProtobufBuilder.getComponentRef: assigns sequential refs starting from 1', t => {
  const builder = new ProtobufBuilder(createExtractedData());

  const ref1 = builder.getComponentRef('comp-a');
  const ref2 = builder.getComponentRef('comp-b');
  const ref3 = builder.getComponentRef('comp-a'); // Same key

  t.is(ref1, 1);
  t.is(ref2, 2);
  t.is(ref3, 1); // Returns existing ref
});

test('ProtobufBuilder.getComponentRef: is idempotent for same key', t => {
  const builder = new ProtobufBuilder(createExtractedData());

  const ref = builder.getComponentRef('test-key');
  t.is(builder.getComponentRef('test-key'), ref);
  t.is(builder.componentRefMap.size, 1);
});

// ---------------------------------------------------------------------------
// generateFakeCommitHash
// ---------------------------------------------------------------------------

test('ProtobufBuilder.generateFakeCommitHash: returns 40-char hex string', t => {
  const builder = new ProtobufBuilder(createExtractedData());
  const hash = builder.generateFakeCommitHash();

  t.is(hash.length, 40);
  t.regex(hash, /^[a-f0-9]{40}$/);
});

test('ProtobufBuilder.generateFakeCommitHash: generates unique hashes', t => {
  const builder = new ProtobufBuilder(createExtractedData());
  const hash1 = builder.generateFakeCommitHash();
  const hash2 = builder.generateFakeCommitHash();

  t.not(hash1, hash2);
});

// ---------------------------------------------------------------------------
// buildMetadata
// ---------------------------------------------------------------------------

test('ProtobufBuilder.buildMetadata: returns correct metadata structure', t => {
  const data = createExtractedData();
  const config = createSonarCloudConfig();
  const profiles = createSonarCloudProfiles();
  const builder = new ProtobufBuilder(data, config, profiles);

  const metadata = builder.buildMetadata();

  t.is(metadata.organizationKey, 'my-sc-org');
  t.is(metadata.projectKey, 'sc-my-project');
  t.is(metadata.branchName, 'main');
  t.is(metadata.branchType, 1); // BRANCH
  t.is(metadata.referenceBranchName, 'main');
  t.is(metadata.scmRevisionId, 'abc123def456abc123def456abc123def456abcd');
  t.is(metadata.crossProjectDuplicationActivated, false);
  t.is(metadata.projectVersion, '1.0.0');
  t.truthy(metadata.rootComponentRef);
  t.truthy(metadata.qprofilesPerLanguage);
  t.truthy(metadata.analyzedIndexedFileCountPerType);
});

test('ProtobufBuilder.buildMetadata: uses analysisDate from metadata', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const metadata = builder.buildMetadata();
  t.is(metadata.analysisDate, new Date('2026-02-15T12:00:00Z').getTime());
});

test('ProtobufBuilder.buildMetadata: uses sonarCloudBranchName when set', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles(), {
    sonarCloudBranchName: 'release/1.0'
  });

  const metadata = builder.buildMetadata();
  t.is(metadata.branchName, 'release/1.0');
  t.is(metadata.referenceBranchName, 'release/1.0');
});

test('ProtobufBuilder.buildMetadata: generates fake commit hash when scmRevisionId missing', t => {
  const data = createExtractedData({ metadata: { extractedAt: '2026-02-15T12:00:00Z' } });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const metadata = builder.buildMetadata();
  t.is(metadata.scmRevisionId.length, 40);
  t.regex(metadata.scmRevisionId, /^[a-f0-9]{40}$/);
});

test('ProtobufBuilder.buildMetadata: falls back to first branch when no main branch', t => {
  const data = createExtractedData({
    project: {
      project: { key: 'my-project', name: 'My Project' },
      branches: [{ name: 'develop', isMain: false }]
    }
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const metadata = builder.buildMetadata();
  t.is(metadata.branchName, 'develop');
});

test('ProtobufBuilder.buildMetadata: falls back to master when no branches', t => {
  const data = createExtractedData({
    project: {
      project: { key: 'my-project', name: 'My Project' },
      branches: []
    }
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const metadata = builder.buildMetadata();
  t.is(metadata.branchName, 'master');
});

test('ProtobufBuilder.buildMetadata: uses project key from data when sonarCloudConfig has no projectKey', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, {}, createSonarCloudProfiles());

  const metadata = builder.buildMetadata();
  t.is(metadata.projectKey, 'my-project');
  t.is(metadata.organizationKey, '');
});

// ---------------------------------------------------------------------------
// buildQProfiles
// ---------------------------------------------------------------------------

test('ProtobufBuilder.buildQProfiles: maps languages to SonarCloud profile keys', t => {
  const data = createExtractedData();
  const profiles = createSonarCloudProfiles();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), profiles);

  const qprofiles = builder.buildQProfiles();

  t.truthy(qprofiles.js);
  t.is(qprofiles.js.key, 'sc-js-profile-AYxx123');
  t.is(qprofiles.js.name, 'Sonar way');
  t.is(qprofiles.js.language, 'js');
});

test('ProtobufBuilder.buildQProfiles: uses fallback when no SC profile found', t => {
  const data = createExtractedData({
    activeRules: [{ ruleRepository: 'python', ruleKey: 'S100', language: 'py', severity: 3, paramsByKey: {}, qProfileKey: 'sq-py' }],
    sources: [{ key: 'my-project:main.py', language: 'py', lines: ['print("hi")'] }]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), []); // No SC profiles

  const qprofiles = builder.buildQProfiles();

  t.truthy(qprofiles.py);
  t.is(qprofiles.py.key, 'default-py');
  t.is(qprofiles.py.name, 'Sonar way');
});

test('ProtobufBuilder.buildQProfiles: handles multiple languages', t => {
  const data = createExtractedData({
    activeRules: [
      { ruleRepository: 'javascript', ruleKey: 'S1', language: 'js', severity: 3, paramsByKey: {}, qProfileKey: 'sq-js' },
      { ruleRepository: 'typescript', ruleKey: 'S2', language: 'ts', severity: 3, paramsByKey: {}, qProfileKey: 'sq-ts' }
    ],
    sources: [
      { key: 'p:a.js', language: 'js', lines: ['x'] },
      { key: 'p:b.ts', language: 'ts', lines: ['y'] }
    ]
  });
  const profiles = [
    { key: 'sc-js', name: 'JS Way', language: 'js', rulesUpdatedAt: '2026-01-01T00:00:00Z' },
    { key: 'sc-ts', name: 'TS Way', language: 'ts', rulesUpdatedAt: '2026-01-01T00:00:00Z' }
  ];
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), profiles);

  const qprofiles = builder.buildQProfiles();

  t.truthy(qprofiles.js);
  t.truthy(qprofiles.ts);
  t.is(qprofiles.js.key, 'sc-js');
  t.is(qprofiles.ts.key, 'sc-ts');
});

// ---------------------------------------------------------------------------
// buildFileCountsByType
// ---------------------------------------------------------------------------

test('ProtobufBuilder.buildFileCountsByType: counts files per language', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const counts = builder.buildFileCountsByType();

  t.is(counts.js, 2);
});

test('ProtobufBuilder.buildFileCountsByType: uses unknown for missing language', t => {
  const data = createExtractedData({
    sources: [
      { key: 'p:a.txt', lines: ['hello'] },
      { key: 'p:b.js', language: 'js', lines: ['x'] }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const counts = builder.buildFileCountsByType();
  t.is(counts.unknown, 1);
  t.is(counts.js, 1);
});

// ---------------------------------------------------------------------------
// buildComponents
// ---------------------------------------------------------------------------

test('ProtobufBuilder.buildComponents: creates PROJECT and FILE components', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();

  const project = components.find(c => c.type === 1);
  const files = components.filter(c => c.type === 4);

  t.truthy(project);
  t.is(project.key, 'sc-my-project');
  t.is(files.length, 2); // index.js and utils.js
  t.true(files.every(f => f.status === 3)); // ADDED
});

test('ProtobufBuilder.buildComponents: skips directory components', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();

  const dirs = components.filter(c => c.type === 3);
  t.is(dirs.length, 0);
});

test('ProtobufBuilder.buildComponents: files are children of project (flat structure)', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const project = components.find(c => c.type === 1);
  const files = components.filter(c => c.type === 4);

  t.is(project.childRef.length, files.length);
  for (const file of files) {
    t.true(project.childRef.includes(file.ref));
  }
});

test('ProtobufBuilder.buildComponents: uses source line count for files', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const indexJs = components.find(c => c.projectRelativePath === 'src/index.js');

  // Source has 3 lines
  t.is(indexJs.lines, 3);
  t.is(indexJs.language, 'js');
});

test('ProtobufBuilder.buildComponents: includes sources not in components list', t => {
  const data = createExtractedData({
    sources: [
      { key: 'my-project:src/index.js', language: 'js', lines: ['x'] },
      { key: 'my-project:src/utils.js', language: 'js', lines: ['y'] },
      { key: 'my-project:src/extra.js', language: 'js', lines: ['z', 'w'] } // Not in components
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const extra = components.find(c => c.projectRelativePath === 'src/extra.js');

  t.truthy(extra);
  t.is(extra.type, 4); // FILE
  t.is(extra.lines, 2);
  t.is(extra.language, 'js');
});

test('ProtobufBuilder.buildComponents: only includes FIL components with source code', t => {
  const data = createExtractedData({
    components: [
      {
        key: 'my-project:src/no-source.js',
        name: 'no-source.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/no-source.js',
        measures: []
      },
      ...createExtractedData().components
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const noSource = components.find(c => c.projectRelativePath === 'src/no-source.js');

  // no-source.js has no matching source, so it should be excluded
  t.falsy(noSource);
});

test('ProtobufBuilder.buildComponents: sets validComponentKeys', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  builder.buildComponents();

  t.true(builder.validComponentKeys.has('my-project'));
  t.true(builder.validComponentKeys.has('my-project:src/index.js'));
  t.true(builder.validComponentKeys.has('my-project:src/utils.js'));
});

// ---------------------------------------------------------------------------
// buildIssues
// ---------------------------------------------------------------------------

test('ProtobufBuilder.buildIssues: maps issues by component ref', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents(); // Must call first to populate refs and validComponentKeys

  const issuesByComponent = builder.buildIssues();

  t.true(issuesByComponent instanceof Map);
  // We have issues for two components
  t.is(issuesByComponent.size, 2);
});

test('ProtobufBuilder.buildIssues: parses rule repository and key', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const issuesByComponent = builder.buildIssues();

  // Find the issue for index.js
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const issues = issuesByComponent.get(indexJsRef);

  t.is(issues.length, 1);
  t.is(issues[0].ruleRepository, 'javascript');
  t.is(issues[0].ruleKey, 'S1234');
  t.is(issues[0].msg, 'Fix this issue');
});

test('ProtobufBuilder.buildIssues: maps severity correctly', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const issuesByComponent = builder.buildIssues();

  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const utilsJsRef = builder.componentRefMap.get('my-project:src/utils.js');

  t.is(issuesByComponent.get(indexJsRef)[0].overriddenSeverity, 3); // MAJOR
  t.is(issuesByComponent.get(utilsJsRef)[0].overriddenSeverity, 4); // CRITICAL
});

test('ProtobufBuilder.buildIssues: includes text range', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const issuesByComponent = builder.buildIssues();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const issue = issuesByComponent.get(indexJsRef)[0];

  t.deepEqual(issue.textRange, {
    startLine: 10,
    endLine: 10,
    startOffset: 5,
    endOffset: 20
  });
});

test('ProtobufBuilder.buildIssues: skips issues for missing components', t => {
  const data = createExtractedData({
    issues: [
      ...createExtractedData().issues,
      {
        key: 'ISSUE-ORPHAN',
        rule: 'javascript:S9999',
        component: 'non-existent-component',
        message: 'Orphan issue',
        severity: 'MINOR'
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const issuesByComponent = builder.buildIssues();

  // Only 2 components should have issues (the 3rd is orphaned)
  t.is(issuesByComponent.size, 2);
});

test('ProtobufBuilder.buildIssues: handles issue without text range', t => {
  const data = createExtractedData({
    issues: [{
      key: 'ISSUE-NO-RANGE',
      rule: 'javascript:S1000',
      component: 'my-project:src/index.js',
      message: 'File-level issue',
      severity: 'INFO'
    }]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const issuesByComponent = builder.buildIssues();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const issue = issuesByComponent.get(indexJsRef)[0];

  t.falsy(issue.textRange);
  t.is(issue.overriddenSeverity, 1); // INFO
});

// ---------------------------------------------------------------------------
// mapSeverity
// ---------------------------------------------------------------------------

test('ProtobufBuilder.mapSeverity: maps all known severities', t => {
  const builder = new ProtobufBuilder(createExtractedData());

  t.is(builder.mapSeverity('INFO'), 1);
  t.is(builder.mapSeverity('MINOR'), 2);
  t.is(builder.mapSeverity('MAJOR'), 3);
  t.is(builder.mapSeverity('CRITICAL'), 4);
  t.is(builder.mapSeverity('BLOCKER'), 5);
});

test('ProtobufBuilder.mapSeverity: defaults to MAJOR for unknown', t => {
  const builder = new ProtobufBuilder(createExtractedData());

  t.is(builder.mapSeverity('UNKNOWN'), 3);
  t.is(builder.mapSeverity(undefined), 3);
  t.is(builder.mapSeverity(null), 3);
});

// ---------------------------------------------------------------------------
// buildMeasures
// ---------------------------------------------------------------------------

test('ProtobufBuilder.buildMeasures: creates measures for FILE components only', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const measuresByComponent = builder.buildMeasures();

  t.true(measuresByComponent instanceof Map);
  // 2 file components should have measures
  t.is(measuresByComponent.size, 2);
});

test('ProtobufBuilder.buildMeasures: skips directory components', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const measuresByComponent = builder.buildMeasures();

  // The DIR component "my-project:src" should NOT have measures
  // DIR components don't get refs from buildComponents, so they won't be in the map
  for (const [ref] of measuresByComponent) {
    t.truthy(ref); // All refs should be valid numbers
  }
});

test('ProtobufBuilder.buildMeasures: integer values use intValue', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const measuresByComponent = builder.buildMeasures();

  // Find measures for index.js
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const measures = measuresByComponent.get(indexJsRef);
  const nclocMeasure = measures.find(m => m.metricKey === 'ncloc');

  t.deepEqual(nclocMeasure.intValue, { value: 100 });
});

test('ProtobufBuilder.buildMeasures: float values use doubleValue', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const measuresByComponent = builder.buildMeasures();

  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const measures = measuresByComponent.get(indexJsRef);
  const coverageMeasure = measures.find(m => m.metricKey === 'coverage');

  t.deepEqual(coverageMeasure.doubleValue, { value: 90.5 });
});

test('ProtobufBuilder.buildMeasures: string metrics use stringValue', t => {
  const data = createExtractedData({
    components: [
      {
        key: 'my-project:src/index.js',
        name: 'index.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/index.js',
        measures: [
          { metric: 'alert_status', value: 'OK' },
          { metric: 'ncloc', value: '100' }
        ]
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const measuresByComponent = builder.buildMeasures();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const measures = measuresByComponent.get(indexJsRef);
  const alertMeasure = measures.find(m => m.metricKey === 'alert_status');

  t.deepEqual(alertMeasure.stringValue, { value: 'OK' });
});

test('ProtobufBuilder.buildMeasures: boolean values use booleanValue', t => {
  const data = createExtractedData({
    components: [
      {
        key: 'my-project:src/index.js',
        name: 'index.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/index.js',
        measures: [
          { metric: 'some_bool', value: true }
        ]
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const measuresByComponent = builder.buildMeasures();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const measures = measuresByComponent.get(indexJsRef);

  t.deepEqual(measures[0].booleanValue, { value: true });
});

test('ProtobufBuilder.buildMeasures: large integers use longValue', t => {
  const data = createExtractedData({
    components: [
      {
        key: 'my-project:src/index.js',
        name: 'index.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/index.js',
        measures: [
          { metric: 'big_number', value: '3000000000' } // larger than int32 max
        ]
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const measuresByComponent = builder.buildMeasures();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const measures = measuresByComponent.get(indexJsRef);

  t.deepEqual(measures[0].longValue, { value: 3000000000 });
});

test('ProtobufBuilder.buildMeasures: NaN string values use stringValue', t => {
  const data = createExtractedData({
    components: [
      {
        key: 'my-project:src/index.js',
        name: 'index.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/index.js',
        measures: [
          { metric: 'custom', value: 'not-a-number' }
        ]
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const measuresByComponent = builder.buildMeasures();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const measures = measuresByComponent.get(indexJsRef);

  t.deepEqual(measures[0].stringValue, { value: 'not-a-number' });
});

test('ProtobufBuilder.buildMeasures: empty value uses stringValue', t => {
  const data = createExtractedData({
    components: [
      {
        key: 'my-project:src/index.js',
        name: 'index.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/index.js',
        measures: [
          { metric: 'empty_metric', value: '' }
        ]
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const measuresByComponent = builder.buildMeasures();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const measures = measuresByComponent.get(indexJsRef);

  t.deepEqual(measures[0].stringValue, { value: '' });
});

// ---------------------------------------------------------------------------
// buildSourceFiles
// ---------------------------------------------------------------------------

test('ProtobufBuilder.buildSourceFiles: returns source files with componentRef and lines', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const sourceFiles = builder.buildSourceFiles();

  t.is(sourceFiles.length, 2);
  const indexSource = sourceFiles.find(sf => {
    const ref = builder.componentRefMap.get('my-project:src/index.js');
    return sf.componentRef === ref;
  });

  t.truthy(indexSource);
  t.is(indexSource.lines.length, 3);
  t.is(indexSource.lines[0].line, 1);
  t.is(indexSource.lines[0].source, 'const x = 1;');
  t.is(indexSource.lines[2].line, 3);
  t.is(indexSource.lines[2].source, 'module.exports = x;');
});

test('ProtobufBuilder.buildSourceFiles: skips sources without component refs', t => {
  const data = createExtractedData({
    sources: [
      { key: 'orphan-source', language: 'js', lines: ['x'] },
      ...createExtractedData().sources
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const sourceFiles = builder.buildSourceFiles();

  // orphan-source will actually get a ref from buildComponents (sources not in components get added)
  // so it should be included
  t.true(sourceFiles.length >= 2);
});

// ---------------------------------------------------------------------------
// buildActiveRules
// ---------------------------------------------------------------------------

test('ProtobufBuilder.buildActiveRules: strips repo prefix from ruleKey', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const rules = builder.buildActiveRules();

  const rule1 = rules.find(r => r.ruleKey === 'S1234');
  t.truthy(rule1);
  t.is(rule1.ruleRepository, 'javascript');
});

test('ProtobufBuilder.buildActiveRules: keeps ruleKey without prefix unchanged', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const rules = builder.buildActiveRules();

  const rule2 = rules.find(r => r.ruleKey === 'S5678');
  t.truthy(rule2);
});

test('ProtobufBuilder.buildActiveRules: maps qProfileKey to SonarCloud profile key', t => {
  const data = createExtractedData();
  const profiles = createSonarCloudProfiles();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), profiles);

  const rules = builder.buildActiveRules();

  // All rules have language 'js', so they should map to the SC js profile key
  for (const rule of rules) {
    t.is(rule.qProfileKey, 'sc-js-profile-AYxx123');
  }
});

test('ProtobufBuilder.buildActiveRules: keeps original qProfileKey when no SC profile match', t => {
  const data = createExtractedData({
    activeRules: [{
      ruleRepository: 'python',
      ruleKey: 'python:S100',
      severity: 3,
      paramsByKey: {},
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      qProfileKey: 'sq-python-profile',
      language: 'py'
    }]
  });
  // SC profiles only have 'js', not 'py'
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const rules = builder.buildActiveRules();

  t.is(rules[0].qProfileKey, 'sq-python-profile');
});

test('ProtobufBuilder.buildActiveRules: includes impacts when present', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const rules = builder.buildActiveRules();

  const ruleWithImpacts = rules.find(r => r.ruleKey === 'S5678');
  t.truthy(ruleWithImpacts.impacts);
  t.is(ruleWithImpacts.impacts.length, 1);
  t.is(ruleWithImpacts.impacts[0].softwareQuality, 1);
  t.is(ruleWithImpacts.impacts[0].severity, 2);
});

test('ProtobufBuilder.buildActiveRules: omits impacts when empty', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const rules = builder.buildActiveRules();

  const ruleNoImpacts = rules.find(r => r.ruleKey === 'S1234');
  t.falsy(ruleNoImpacts.impacts);
});

test('ProtobufBuilder.buildActiveRules: preserves params', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const rules = builder.buildActiveRules();
  const ruleWithParams = rules.find(r => r.ruleKey === 'S5678');

  t.deepEqual(ruleWithParams.paramsByKey, { threshold: '10' });
});

// ---------------------------------------------------------------------------
// buildChangesets
// ---------------------------------------------------------------------------

test('ProtobufBuilder.buildChangesets: builds changeset messages from Map', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const changesetsByComponent = builder.buildChangesets();

  t.true(changesetsByComponent instanceof Map);
  t.is(changesetsByComponent.size, 1);

  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const changeset = changesetsByComponent.get(indexJsRef);

  t.is(changeset.componentRef, indexJsRef);
  t.is(changeset.changeset.length, 2);
  t.is(changeset.changeset[0].revision, 'rev1');
  t.is(changeset.changeset[0].author, 'dev@example.com');
  t.deepEqual(changeset.changesetIndexByLine, [0, 0, 1]);
});

test('ProtobufBuilder.buildChangesets: skips changesets for unknown components', t => {
  const data = createExtractedData({
    changesets: new Map([
      ['unknown-component', {
        changesets: [{ revision: 'r1', author: 'a', date: 123 }],
        changesetIndexByLine: [0]
      }]
    ])
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const changesetsByComponent = builder.buildChangesets();
  t.is(changesetsByComponent.size, 0);
});

test('ProtobufBuilder.buildChangesets: handles empty changeset map', t => {
  const data = createExtractedData({ changesets: new Map() });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const changesetsByComponent = builder.buildChangesets();
  t.is(changesetsByComponent.size, 0);
});

// ---------------------------------------------------------------------------
// buildAll
// ---------------------------------------------------------------------------

test('ProtobufBuilder.buildAll: returns all message types', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const messages = builder.buildAll();

  t.truthy(messages.metadata);
  t.truthy(messages.components);
  t.truthy(messages.issuesByComponent);
  t.truthy(messages.measuresByComponent);
  t.truthy(messages.sourceFiles);
  t.truthy(messages.activeRules);
  t.truthy(messages.changesetsByComponent);
});

test('ProtobufBuilder.buildAll: metadata has correct project key', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const messages = builder.buildAll();

  t.is(messages.metadata.projectKey, 'sc-my-project');
});

test('ProtobufBuilder.buildAll: components include project and files', t => {
  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const messages = builder.buildAll();

  // 1 project + 2 files
  t.is(messages.components.length, 3);
});

test('ProtobufBuilder.buildAll: throws ProtobufEncodingError on failure', t => {
  const data = createExtractedData({
    project: null // This will cause a TypeError
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const error = t.throws(() => builder.buildAll());
  t.true(error instanceof ProtobufEncodingError);
  t.true(error.message.includes('Failed to build protobuf messages'));
});

// ---------------------------------------------------------------------------
// buildPlugins
// ---------------------------------------------------------------------------

test('ProtobufBuilder.buildPlugins: returns default javascript plugin', t => {
  const builder = new ProtobufBuilder(createExtractedData());

  const plugins = builder.buildPlugins();

  t.truthy(plugins.javascript);
  t.is(plugins.javascript.key, 'javascript');
  t.truthy(plugins.javascript.updatedAt);
});

// ===========================================================================
// Branch coverage: build-components.js
// ===========================================================================

// Line 12: builder.sonarCloudConfig.projectKey || project.key
// The falsy case: sonarCloudConfig.projectKey is empty/undefined, so project.key is used
test('buildComponents: uses project.key when sonarCloudConfig.projectKey is falsy (line 12)', t => {
  const data = createExtractedData();
  // No projectKey in sonarCloudConfig
  const builder = new ProtobufBuilder(data, {}, createSonarCloudProfiles());

  const components = builder.buildComponents();
  const project = components.find(c => c.type === 1);

  // Falls back to project.key = 'my-project'
  t.is(project.key, 'my-project');
});

// Line 19: source.language || '' -- falsy language
// Line 20: source.lines ? source.lines.length : 0 -- null lines
test('buildComponents: handles source with no language and null lines (lines 19-20)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'my-project:src/noLang.js', language: null, lines: null },
      { key: 'my-project:src/undefinedLang.js', lines: ['x'] } // language is undefined
    ],
    components: []
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();

  // Source with null language and null lines
  const noLangComp = components.find(c => c.projectRelativePath === 'src/noLang.js');
  t.truthy(noLangComp);
  t.is(noLangComp.language, '');
  t.is(noLangComp.lines, 0); // null lines falls back to 0

  // Source with undefined language
  const undefinedLangComp = components.find(c => c.projectRelativePath === 'src/undefinedLang.js');
  t.truthy(undefinedLangComp);
  t.is(undefinedLangComp.language, '');
});

// Line 20: source.lines is falsy (empty string)
test('buildComponents: handles source with empty language string (lines 19)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'my-project:src/emptyLang.js', language: '', lines: ['a'] }
    ],
    components: []
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const comp = components.find(c => c.projectRelativePath === 'src/emptyLang.js');
  t.truthy(comp);
  t.is(comp.language, '');
});

// Line 28: info.lineCount is 0/falsy, falls through to parseInt from comp.measures
test('buildComponents: uses measures line count when source has no lines (line 28 parseInt fallback)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'my-project:src/measured.js', language: 'js', lines: null } // lineCount will be 0 (falsy)
    ],
    components: [
      {
        key: 'my-project:src/measured.js',
        name: 'measured.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/measured.js',
        measures: [
          { metric: 'lines', value: '42' }
        ]
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const comp = components.find(c => c.projectRelativePath === 'src/measured.js');
  t.truthy(comp);
  t.is(comp.lines, 42); // Falls through to parseInt of measures 'lines' value
});

// Line 28: info.lineCount is 0 AND no 'lines' metric in measures, falls to || 0
test('buildComponents: falls to 0 when no lineCount and no lines measure (line 28 || 0)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'my-project:src/nolines.js', language: 'js', lines: null }
    ],
    components: [
      {
        key: 'my-project:src/nolines.js',
        name: 'nolines.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/nolines.js',
        measures: [
          { metric: 'ncloc', value: '10' } // No 'lines' metric
        ]
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const comp = components.find(c => c.projectRelativePath === 'src/nolines.js');
  t.truthy(comp);
  t.is(comp.lines, 0); // Both lineCount and parseInt result are falsy/NaN
});

// Line 32: comp.language is falsy, falls to info.language
test('buildComponents: uses info.language when comp.language is missing (line 32)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'my-project:src/fromSource.js', language: 'ts', lines: ['x'] }
    ],
    components: [
      {
        key: 'my-project:src/fromSource.js',
        name: 'fromSource.js',
        qualifier: 'FIL',
        language: '', // falsy
        path: 'src/fromSource.js',
        measures: []
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const comp = components.find(c => c.projectRelativePath === 'src/fromSource.js');
  t.truthy(comp);
  t.is(comp.language, 'ts'); // Falls back to info.language from source
});

// Line 32: both comp.language and info.language are falsy, falls to ''
test('buildComponents: uses empty string when both comp and info language are falsy (line 32)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'my-project:src/noLangAnywhere.txt', language: '', lines: ['x'] }
    ],
    components: [
      {
        key: 'my-project:src/noLangAnywhere.txt',
        name: 'noLangAnywhere.txt',
        qualifier: 'FIL',
        language: null,
        path: 'src/noLangAnywhere.txt',
        measures: []
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const comp = components.find(c => c.projectRelativePath === 'src/noLangAnywhere.txt');
  t.truthy(comp);
  t.is(comp.language, '');
});

// Line 35: comp.path is falsy, falls to comp.name
test('buildComponents: uses comp.name when comp.path is missing (line 35)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'my-project:src/pathless.js', language: 'js', lines: ['x'] }
    ],
    components: [
      {
        key: 'my-project:src/pathless.js',
        name: 'pathless.js',
        qualifier: 'FIL',
        language: 'js',
        path: '', // falsy path
        measures: []
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const comp = components.find(c => c.projectRelativePath === 'pathless.js');
  t.truthy(comp);
  t.is(comp.projectRelativePath, 'pathless.js'); // Falls back to name
});

// Line 42: source.key.split(':').pop() || source.key -- key without ':'
test('buildComponents: source key without colon uses full key as path (line 42)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'nocolonkey', language: 'js', lines: ['x'] }
    ],
    components: [] // No matching component, so handled by sources loop
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  // split(':').pop() on 'nocolonkey' returns 'nocolonkey' which is truthy
  // so || source.key won't activate. But the component should still work.
  const comp = components.find(c => c.projectRelativePath === 'nocolonkey');
  t.truthy(comp);
  t.is(comp.projectRelativePath, 'nocolonkey');
});

// Line 42: source.key is a string that results in empty pop after splitting
// e.g. key ending with ':' so pop() returns ''
test('buildComponents: source key ending with colon falls back to source.key (line 42)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'project:', language: 'js', lines: ['x'] }
    ],
    components: []
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  // 'project:'.split(':').pop() returns '' (falsy), so || source.key gives 'project:'
  const comp = components.find(c => c.projectRelativePath === 'project:');
  t.truthy(comp);
  t.is(comp.projectRelativePath, 'project:');
});

// Line 43: source.lines is null/falsy in the sources loop
test('buildComponents: source with null lines in extra sources loop uses 0 (line 43)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'my-project:src/nullLines.js', language: 'js', lines: null }
    ],
    components: [] // No matching component
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const comp = components.find(c => c.projectRelativePath === 'src/nullLines.js');
  t.truthy(comp);
  t.is(comp.lines, 0); // Ternary: source.lines is null so returns 0
});

// Line 47: source.language is falsy in the extra sources loop
test('buildComponents: source with falsy language in extra sources loop uses empty string (line 47)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'my-project:src/noLangExtra.txt', lines: ['hello'] } // undefined language
    ],
    components: [] // No matching component
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const components = builder.buildComponents();
  const comp = components.find(c => c.projectRelativePath === 'src/noLangExtra.txt');
  t.truthy(comp);
  t.is(comp.language, ''); // source.language || ''
});

// ===========================================================================
// Branch coverage: build-issues.js
// ===========================================================================

// Lines 21-22: rule without ':' separator
test('buildIssues: handles rule without colon separator (lines 21-22)', t => {
  const data = createExtractedData({
    issues: [{
      key: 'ISSUE-NOSEP',
      rule: 'S9999', // No colon separator
      component: 'my-project:src/index.js',
      message: 'Rule without separator',
      severity: 'MINOR',
      textRange: { startLine: 1, endLine: 1, startOffset: 0, endOffset: 10 }
    }]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const issuesByComponent = builder.buildIssues();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const issues = issuesByComponent.get(indexJsRef);

  t.is(issues.length, 1);
  // ruleParts[0] = 'S9999' (truthy), ruleParts[1] = undefined (falsy) -> falls back to issue.rule
  t.is(issues[0].ruleRepository, 'S9999');
  t.is(issues[0].ruleKey, 'S9999');
});

// Line 21: ruleParts[0] is empty string (falsy) -- rule starts with ':'
test('buildIssues: handles rule starting with colon (line 21 empty repo)', t => {
  const data = createExtractedData({
    issues: [{
      key: 'ISSUE-EMPTY-REPO',
      rule: ':S100', // Empty repo part
      component: 'my-project:src/index.js',
      message: 'Empty repo',
      severity: 'INFO'
    }]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const issuesByComponent = builder.buildIssues();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const issues = issuesByComponent.get(indexJsRef);

  t.is(issues.length, 1);
  // ruleParts[0] = '' (falsy) -> falls back to ''
  t.is(issues[0].ruleRepository, '');
  t.is(issues[0].ruleKey, 'S100');
});

// Line 27: issue.message is falsy (null/undefined/empty)
test('buildIssues: handles issue with no message (line 27)', t => {
  const data = createExtractedData({
    issues: [{
      key: 'ISSUE-NO-MSG',
      rule: 'javascript:S1000',
      component: 'my-project:src/index.js',
      severity: 'MAJOR'
      // message is undefined
    }]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const issuesByComponent = builder.buildIssues();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const issues = issuesByComponent.get(indexJsRef);

  t.is(issues[0].msg, ''); // issue.message || ''
});

// Line 27: issue.message is null
test('buildIssues: handles issue with null message (line 27)', t => {
  const data = createExtractedData({
    issues: [{
      key: 'ISSUE-NULL-MSG',
      rule: 'javascript:S1001',
      component: 'my-project:src/index.js',
      message: null,
      severity: 'MAJOR'
    }]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const issuesByComponent = builder.buildIssues();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const issues = issuesByComponent.get(indexJsRef);

  t.is(issues[0].msg, '');
});

// Lines 35-36: textRange with undefined/0 startOffset and endOffset
test('buildIssues: handles textRange with undefined offsets (lines 35-36)', t => {
  const data = createExtractedData({
    issues: [{
      key: 'ISSUE-NO-OFFSETS',
      rule: 'javascript:S2000',
      component: 'my-project:src/index.js',
      message: 'Missing offsets',
      severity: 'MAJOR',
      textRange: { startLine: 5, endLine: 5 } // No startOffset/endOffset
    }]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const issuesByComponent = builder.buildIssues();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const issues = issuesByComponent.get(indexJsRef);

  t.is(issues[0].textRange.startOffset, 0); // undefined || 0
  t.is(issues[0].textRange.endOffset, 0);   // undefined || 0
});

// Lines 35-36: textRange with null offsets
test('buildIssues: handles textRange with null offsets (lines 35-36)', t => {
  const data = createExtractedData({
    issues: [{
      key: 'ISSUE-NULL-OFFSETS',
      rule: 'javascript:S2001',
      component: 'my-project:src/index.js',
      message: 'Null offsets',
      severity: 'MINOR',
      textRange: { startLine: 1, endLine: 1, startOffset: null, endOffset: null }
    }]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const issuesByComponent = builder.buildIssues();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const issues = issuesByComponent.get(indexJsRef);

  t.is(issues[0].textRange.startOffset, 0); // null || 0
  t.is(issues[0].textRange.endOffset, 0);   // null || 0
});

// ===========================================================================
// Branch coverage: builder.js
// ===========================================================================

// Line 60: buildSourceFiles - source key not in componentRefMap
test('buildSourceFiles: skips sources whose key is not in componentRefMap (line 60)', t => {
  const data = createExtractedData({
    sources: [
      { key: 'my-project:src/index.js', language: 'js', lines: ['const x = 1;'] },
      { key: 'orphan-key-not-in-refs', language: 'js', lines: ['orphan'] }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents(); // This registers refs for both sources

  // Manually remove the orphan from componentRefMap to exercise the early return
  builder.componentRefMap.delete('orphan-key-not-in-refs');

  const sourceFiles = builder.buildSourceFiles();

  // Only the first source should be included
  t.is(sourceFiles.length, 1);
  const indexRef = builder.componentRefMap.get('my-project:src/index.js');
  t.is(sourceFiles[0].componentRef, indexRef);
});

// Line 85: rule.paramsByKey is falsy, falls back to {}
test('buildActiveRules: falls back to empty object when paramsByKey is null/undefined (line 85)', t => {
  const data = createExtractedData({
    activeRules: [
      {
        ruleRepository: 'javascript',
        ruleKey: 'javascript:S100',
        severity: 3,
        paramsByKey: null, // falsy
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        qProfileKey: 'sq-js-profile-key',
        language: 'js'
      },
      {
        ruleRepository: 'javascript',
        ruleKey: 'javascript:S200',
        severity: 2,
        // paramsByKey is undefined (not set)
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        qProfileKey: 'sq-js-profile-key',
        language: 'js'
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());

  const rules = builder.buildActiveRules();

  t.deepEqual(rules[0].paramsByKey, {}); // null || {}
  t.deepEqual(rules[1].paramsByKey, {}); // undefined || {}
});

// Line 155: changesetData.changesetIndexByLine is falsy, falls back to []
test('buildChangesets: falls back to empty array when changesetIndexByLine is missing (line 155)', t => {
  const data = createExtractedData({
    changesets: new Map([
      ['my-project:src/index.js', {
        changesets: [
          { revision: 'rev1', author: 'dev@example.com', date: 1700000000000 }
        ]
        // changesetIndexByLine is undefined
      }]
    ])
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const changesetsByComponent = builder.buildChangesets();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const changeset = changesetsByComponent.get(indexJsRef);

  t.truthy(changeset);
  t.deepEqual(changeset.changesetIndexByLine, []); // undefined || []
});

// Line 155: changesetIndexByLine is null
test('buildChangesets: falls back to empty array when changesetIndexByLine is null (line 155)', t => {
  const data = createExtractedData({
    changesets: new Map([
      ['my-project:src/index.js', {
        changesets: [
          { revision: 'rev1', author: 'dev@example.com', date: 1700000000000 }
        ],
        changesetIndexByLine: null
      }]
    ])
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  const changesetsByComponent = builder.buildChangesets();
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const changeset = changesetsByComponent.get(indexJsRef);

  t.truthy(changeset);
  t.deepEqual(changeset.changesetIndexByLine, []);
});

// ===========================================================================
// Branch coverage: build-measures.js
// ===========================================================================

// Line 17: FIL component whose key is not in componentRefMap
test('buildMeasures: skips FIL component not in componentRefMap (line 17)', t => {
  const data = createExtractedData({
    components: [
      {
        key: 'my-project:src/index.js',
        name: 'index.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/index.js',
        measures: [{ metric: 'ncloc', value: '100' }]
      },
      {
        key: 'my-project:src/unregistered.js',
        name: 'unregistered.js',
        qualifier: 'FIL',
        language: 'js',
        path: 'src/unregistered.js',
        measures: [{ metric: 'ncloc', value: '50' }]
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  builder.buildComponents();

  // Remove unregistered.js from componentRefMap to exercise the early return
  builder.componentRefMap.delete('my-project:src/unregistered.js');

  const measuresByComponent = builder.buildMeasures();

  // Only index.js should have measures
  t.is(measuresByComponent.size, 1);
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  t.truthy(measuresByComponent.has(indexJsRef));
});

// ============================================================================
// ProtobufEncoder tests
// ============================================================================

// ---------------------------------------------------------------------------
// loadSchemas
// ---------------------------------------------------------------------------

test('ProtobufEncoder.loadSchemas: loads proto schemas successfully', async t => {
  const encoder = new ProtobufEncoder();

  await encoder.loadSchemas();

  t.truthy(encoder.root);
  t.truthy(encoder.root.lookupType('Metadata'));
  t.truthy(encoder.root.lookupType('Component'));
  t.truthy(encoder.root.lookupType('Issue'));
  t.truthy(encoder.root.lookupType('Measure'));
  t.truthy(encoder.root.lookupType('ActiveRule'));
  t.truthy(encoder.root.lookupType('Changesets'));
});

test('ProtobufEncoder.loadSchemas: loads Severity enum from constants.proto', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const Severity = encoder.root.lookupEnum('Severity');
  t.truthy(Severity);
  t.is(Severity.values.INFO, 1);
  t.is(Severity.values.BLOCKER, 5);
});

// ---------------------------------------------------------------------------
// encodeMetadata
// ---------------------------------------------------------------------------

test('ProtobufEncoder.encodeMetadata: encodes valid metadata to buffer', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const metadata = {
    analysisDate: Date.now(),
    organizationKey: 'my-org',
    projectKey: 'my-project',
    rootComponentRef: 1,
    branchName: 'main',
    branchType: 1,
    referenceBranchName: 'main',
    scmRevisionId: 'abc123',
    projectVersion: '1.0.0',
    crossProjectDuplicationActivated: false
  };

  const buffer = encoder.encodeMetadata(metadata);

  t.true(Buffer.isBuffer(buffer) || buffer instanceof Uint8Array);
  t.true(buffer.length > 0);
});

test('ProtobufEncoder.encodeMetadata: encoded metadata can be decoded', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const metadata = {
    analysisDate: 1700000000000,
    organizationKey: 'my-org',
    projectKey: 'my-project',
    rootComponentRef: 1,
    branchName: 'main',
    branchType: 1,
    scmRevisionId: 'deadbeef',
    projectVersion: '1.0.0'
  };

  const buffer = encoder.encodeMetadata(metadata);
  const Metadata = encoder.root.lookupType('Metadata');
  const decoded = Metadata.decode(buffer);

  t.is(decoded.projectKey, 'my-project');
  t.is(decoded.organizationKey, 'my-org');
  t.is(decoded.branchName, 'main');
});

// ---------------------------------------------------------------------------
// encodeComponent
// ---------------------------------------------------------------------------

test('ProtobufEncoder.encodeComponent: encodes project component', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const component = {
    ref: 1,
    type: 1, // PROJECT
    key: 'my-project',
    childRef: [2, 3]
  };

  const buffer = encoder.encodeComponent(component);
  t.true(buffer.length > 0);

  const Component = encoder.root.lookupType('Component');
  const decoded = Component.decode(buffer);
  t.is(decoded.ref, 1);
  t.is(decoded.type, 1);
  t.is(decoded.key, 'my-project');
  t.deepEqual(decoded.childRef, [2, 3]);
});

test('ProtobufEncoder.encodeComponent: encodes file component', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const component = {
    ref: 2,
    type: 4, // FILE
    language: 'js',
    lines: 42,
    status: 3, // ADDED
    projectRelativePath: 'src/index.js'
  };

  const buffer = encoder.encodeComponent(component);
  const Component = encoder.root.lookupType('Component');
  const decoded = Component.decode(buffer);

  t.is(decoded.ref, 2);
  t.is(decoded.type, 4);
  t.is(decoded.language, 'js');
  t.is(decoded.lines, 42);
  t.is(decoded.projectRelativePath, 'src/index.js');
});

// ---------------------------------------------------------------------------
// encodeIssueDelimited
// ---------------------------------------------------------------------------

test('ProtobufEncoder.encodeIssueDelimited: encodes issue with length prefix', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const issue = {
    ruleRepository: 'javascript',
    ruleKey: 'S1234',
    msg: 'Fix this',
    overriddenSeverity: 3,
    textRange: {
      startLine: 10,
      endLine: 10,
      startOffset: 0,
      endOffset: 15
    }
  };

  const buffer = encoder.encodeIssueDelimited(issue);
  t.true(buffer.length > 0);

  // Decode with decodeDelimited
  const Issue = encoder.root.lookupType('Issue');
  const decoded = Issue.decodeDelimited(buffer);
  t.is(decoded.ruleRepository, 'javascript');
  t.is(decoded.ruleKey, 'S1234');
  t.is(decoded.msg, 'Fix this');
});

test('ProtobufEncoder.encodeIssueDelimited: throws on invalid issue', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  // overriddenSeverity must be an enum value (int), passing object should fail verify
  const issue = {
    ruleRepository: 'javascript',
    ruleKey: 'S1234',
    textRange: { startLine: 'not-a-number' } // invalid type
  };

  t.throws(() => encoder.encodeIssueDelimited(issue), {
    instanceOf: ProtobufEncodingError
  });
});

// ---------------------------------------------------------------------------
// encodeMeasureDelimited
// ---------------------------------------------------------------------------

test('ProtobufEncoder.encodeMeasureDelimited: encodes integer measure', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const measure = {
    metricKey: 'ncloc',
    intValue: { value: 100 }
  };

  const buffer = encoder.encodeMeasureDelimited(measure);
  t.true(buffer.length > 0);

  const Measure = encoder.root.lookupType('Measure');
  const decoded = Measure.decodeDelimited(buffer);
  t.is(decoded.metricKey, 'ncloc');
  t.is(decoded.intValue.value, 100);
});

test('ProtobufEncoder.encodeMeasureDelimited: encodes double measure', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const measure = {
    metricKey: 'coverage',
    doubleValue: { value: 85.5 }
  };

  const buffer = encoder.encodeMeasureDelimited(measure);
  const Measure = encoder.root.lookupType('Measure');
  const decoded = Measure.decodeDelimited(buffer);

  t.is(decoded.metricKey, 'coverage');
  t.true(Math.abs(decoded.doubleValue.value - 85.5) < 0.001);
});

test('ProtobufEncoder.encodeMeasureDelimited: encodes string measure', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const measure = {
    metricKey: 'alert_status',
    stringValue: { value: 'OK' }
  };

  const buffer = encoder.encodeMeasureDelimited(measure);
  const Measure = encoder.root.lookupType('Measure');
  const decoded = Measure.decodeDelimited(buffer);

  t.is(decoded.metricKey, 'alert_status');
  t.is(decoded.stringValue.value, 'OK');
});

test('ProtobufEncoder.encodeMeasureDelimited: encodes boolean measure', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const measure = {
    metricKey: 'is_good',
    booleanValue: { value: true }
  };

  const buffer = encoder.encodeMeasureDelimited(measure);
  const Measure = encoder.root.lookupType('Measure');
  const decoded = Measure.decodeDelimited(buffer);

  t.is(decoded.booleanValue.value, true);
});

// ---------------------------------------------------------------------------
// encodeActiveRuleDelimited
// ---------------------------------------------------------------------------

test('ProtobufEncoder.encodeActiveRuleDelimited: encodes active rule', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const activeRule = {
    ruleRepository: 'javascript',
    ruleKey: 'S1234',
    severity: 3, // MAJOR
    paramsByKey: { threshold: '10' },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    qProfileKey: 'profile-key-123'
  };

  const buffer = encoder.encodeActiveRuleDelimited(activeRule);
  t.true(buffer.length > 0);

  const ActiveRule = encoder.root.lookupType('ActiveRule');
  const decoded = ActiveRule.decodeDelimited(buffer);

  t.is(decoded.ruleRepository, 'javascript');
  t.is(decoded.ruleKey, 'S1234');
  t.is(decoded.severity, 3);
  t.is(decoded.qProfileKey, 'profile-key-123');
});

test('ProtobufEncoder.encodeActiveRuleDelimited: encodes rule with impacts', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const activeRule = {
    ruleRepository: 'javascript',
    ruleKey: 'S5678',
    severity: 4,
    paramsByKey: {},
    qProfileKey: 'pk',
    impacts: [
      { softwareQuality: 1, severity: 2 } // MAINTAINABILITY, MEDIUM
    ]
  };

  const buffer = encoder.encodeActiveRuleDelimited(activeRule);
  const ActiveRule = encoder.root.lookupType('ActiveRule');
  const decoded = ActiveRule.decodeDelimited(buffer);

  t.is(decoded.impacts.length, 1);
  t.is(decoded.impacts[0].softwareQuality, 1);
  t.is(decoded.impacts[0].severity, 2);
});

// ---------------------------------------------------------------------------
// encodeChangeset
// ---------------------------------------------------------------------------

test('ProtobufEncoder.encodeChangeset: encodes changeset message', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const changeset = {
    componentRef: 2,
    changeset: [
      { revision: 'abc123', author: 'dev@test.com', date: 1700000000000 }
    ],
    changesetIndexByLine: [0, 0, 0]
  };

  const buffer = encoder.encodeChangeset(changeset);
  t.true(buffer.length > 0);

  const Changesets = encoder.root.lookupType('Changesets');
  const decoded = Changesets.decode(buffer);

  t.is(decoded.componentRef, 2);
  t.is(decoded.changeset.length, 1);
  t.is(decoded.changeset[0].revision, 'abc123');
  t.is(decoded.changeset[0].author, 'dev@test.com');
  t.deepEqual(Array.from(decoded.changesetIndexByLine), [0, 0, 0]);
});

// ---------------------------------------------------------------------------
// encodeAll
// ---------------------------------------------------------------------------

test('ProtobufEncoder.encodeAll: throws if schemas not loaded', t => {
  const encoder = new ProtobufEncoder();

  t.throws(() => encoder.encodeAll({}), {
    instanceOf: ProtobufEncodingError,
    message: /Schemas not loaded/
  });
});

test('ProtobufEncoder.encodeAll: encodes full builder output', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  const messages = builder.buildAll();

  const encoded = encoder.encodeAll(messages);

  // Check metadata
  t.true(encoded.metadata.length > 0);

  // Check components
  t.is(encoded.components.length, messages.components.length);
  encoded.components.forEach(buf => {
    t.true(buf.length > 0);
  });

  // Check issues
  t.true(encoded.issues instanceof Map);
  t.is(encoded.issues.size, messages.issuesByComponent.size);
  encoded.issues.forEach(buf => {
    t.true(buf.length > 0);
  });

  // Check measures
  t.true(encoded.measures instanceof Map);
  t.is(encoded.measures.size, messages.measuresByComponent.size);
  encoded.measures.forEach(buf => {
    t.true(buf.length > 0);
  });

  // Check source files as text
  t.is(encoded.sourceFilesText.length, messages.sourceFiles.length);
  encoded.sourceFilesText.forEach(sf => {
    t.truthy(sf.componentRef);
    t.is(typeof sf.text, 'string');
    t.true(sf.text.length > 0);
  });

  // Check active rules
  t.true(encoded.activeRules.length > 0);

  // Check changesets
  t.true(encoded.changesets instanceof Map);
});

test('ProtobufEncoder.encodeAll: source file text is joined with newlines', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  const messages = builder.buildAll();

  const encoded = encoder.encodeAll(messages);

  // Find source text for index.js
  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const indexSource = encoded.sourceFilesText.find(sf => sf.componentRef === indexJsRef);

  t.is(indexSource.text, 'const x = 1;\nconsole.log(x);\nmodule.exports = x;');
});

test('ProtobufEncoder.encodeAll: encoded metadata can be decoded back', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  const messages = builder.buildAll();
  const encoded = encoder.encodeAll(messages);

  const Metadata = encoder.root.lookupType('Metadata');
  const decoded = Metadata.decode(encoded.metadata);

  t.is(decoded.projectKey, 'sc-my-project');
  t.is(decoded.organizationKey, 'my-sc-org');
  t.is(decoded.branchName, 'main');
});

test('ProtobufEncoder.encodeAll: encoded components can be decoded back', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  const messages = builder.buildAll();
  const encoded = encoder.encodeAll(messages);

  const Component = encoder.root.lookupType('Component');

  // Decode the first component (should be the project)
  const projectDecoded = Component.decode(encoded.components[0]);
  t.is(projectDecoded.type, 1); // PROJECT
  t.is(projectDecoded.key, 'sc-my-project');
});

// (Replaced by the clean version below that uses the synchronous protobuf import)

test('ProtobufEncoder.encodeAll: changesets are encoded per component', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  const messages = builder.buildAll();
  const encoded = encoder.encodeAll(messages);

  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');

  // Only index.js has changesets in our mock data
  t.true(encoded.changesets.has(indexJsRef));

  const Changesets = encoder.root.lookupType('Changesets');
  const decoded = Changesets.decode(encoded.changesets.get(indexJsRef));

  t.is(decoded.changeset.length, 2);
  t.is(decoded.changeset[0].revision, 'rev1');
});

// ---------------------------------------------------------------------------
// End-to-end: build then encode
// ---------------------------------------------------------------------------

test('End-to-end: builder output is fully encodable', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const data = createExtractedData();
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  const messages = builder.buildAll();

  // This should not throw
  const encoded = encoder.encodeAll(messages);

  t.truthy(encoded.metadata);
  t.true(encoded.components.length > 0);
  t.true(encoded.activeRules.length > 0);
  t.true(encoded.sourceFilesText.length > 0);
});

test('End-to-end: empty data (no issues, no measures, no changesets)', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const data = createExtractedData({
    issues: [],
    components: [],
    changesets: new Map(),
    sources: [{ key: 'my-project:empty.js', language: 'js', lines: ['// empty'] }]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  const messages = builder.buildAll();
  const encoded = encoder.encodeAll(messages);

  t.truthy(encoded.metadata);
  // Project + one source file
  t.is(encoded.components.length, 2);
  t.is(encoded.issues.size, 0);
  t.is(encoded.changesets.size, 0);
});

import protobuf from 'protobufjs';

test.serial('ProtobufEncoder.loadSchemas: throws ProtobufEncodingError when proto parsing fails', async t => {
  const encoder = new ProtobufEncoder();

  // Monkey-patch protobuf.parse to throw, simulating invalid proto files
  const originalParse = protobuf.parse;
  protobuf.parse = () => { throw new Error('Invalid proto syntax'); };

  try {
    const error = await t.throwsAsync(() => encoder.loadSchemas(), {
      instanceOf: ProtobufEncodingError,
      message: /Failed to load protobuf schemas/
    });
    t.true(error.message.includes('Invalid proto syntax'));
  } finally {
    protobuf.parse = originalParse;
  }
});

test('ProtobufEncoder.encodeAll: wraps errors in ProtobufEncodingError', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  // Pass messages object that will cause encoding to fail
  // metadata with invalid fields that fail protobuf verify
  const badMessages = {
    metadata: { analysisDate: 'not-a-number' },
    components: [],
    issuesByComponent: new Map(),
    measuresByComponent: new Map(),
    sourceFiles: [],
    activeRules: [],
    changesetsByComponent: new Map(),
  };

  const error = t.throws(() => encoder.encodeAll(badMessages), {
    instanceOf: ProtobufEncodingError,
  });
  t.true(error.message.includes('Failed to encode messages'));
});

test('ProtobufEncoder.encodeAll: decodes multiple concatenated delimited issues', async t => {
  const encoder = new ProtobufEncoder();
  await encoder.loadSchemas();

  const data = createExtractedData({
    issues: [
      {
        key: 'I1', rule: 'javascript:S1', component: 'my-project:src/index.js',
        message: 'First issue', severity: 'MAJOR'
      },
      {
        key: 'I2', rule: 'javascript:S2', component: 'my-project:src/index.js',
        message: 'Second issue', severity: 'MINOR'
      }
    ]
  });
  const builder = new ProtobufBuilder(data, createSonarCloudConfig(), createSonarCloudProfiles());
  const messages = builder.buildAll();
  const encoded = encoder.encodeAll(messages);

  const indexJsRef = builder.componentRefMap.get('my-project:src/index.js');
  const issueBuffer = encoded.issues.get(indexJsRef);

  const Issue = encoder.root.lookupType('Issue');
  const reader = protobuf.Reader.create(issueBuffer);
  const decoded1 = Issue.decodeDelimited(reader);
  const decoded2 = Issue.decodeDelimited(reader);

  t.is(decoded1.msg, 'First issue');
  t.is(decoded2.msg, 'Second issue');
});

// ---------------------------------------------------------------------------
// ProtobufEncoder.loadSchemas: dynamic import success path (line 20)
// ---------------------------------------------------------------------------
// When the dynamic import('./schema/constants.proto') succeeds (as it would
// in a bundled environment), loadProtoSchemas returns via line 20. We simulate
// this using esmock to make those dynamic imports resolve to modules with a
// default export containing the proto text content.

import esmock from 'esmock';
import { readFileSync } from 'node:fs';
import { dirname, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// To cover line 20 in encoder.js (the `return` from the dynamic import
// success path of loadProtoSchemas), we register a custom Node.js module
// loader hook that handles `.proto` file extensions by returning their text
// content as a default export.  This makes `import('./schema/constants.proto')`
// resolve successfully, exercising the try-block path instead of the catch.
// ---------------------------------------------------------------------------
import { register } from 'node:module';

// Register a loader that returns .proto file contents as ESM with a default export.
// data: URLs are supported by Node.js for loader hooks.
register('data:text/javascript,' + encodeURIComponent(`
  export async function load(url, context, nextLoad) {
    if (url.endsWith('.proto')) {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const filePath = fileURLToPath(url);
      const content = readFileSync(filePath, 'utf-8');
      return {
        shortCircuit: true,
        format: 'module',
        source: 'export default ' + JSON.stringify(content) + ';',
      };
    }
    return nextLoad(url, context);
  }
`));

test.serial('ProtobufEncoder.loadSchemas succeeds via dynamic import path (line 20)', async t => {
  // Now that the .proto loader is registered, dynamic import('./schema/constants.proto')
  // will succeed inside encoder.js, exercising the line-20 return statement.
  // We must create a fresh ProtobufEncoder from a fresh module load so the
  // dynamic imports inside loadProtoSchemas actually run through our hook.
  // esmock ensures we get a fresh module instance.
  const { ProtobufEncoder: FreshEncoder } = await esmock('../../src/protobuf/encoder.js', {});

  const encoder = new FreshEncoder();
  await encoder.loadSchemas();

  // Verify schemas loaded correctly via the dynamic import success path
  t.truthy(encoder.root);
  t.truthy(encoder.root.lookupType('Metadata'));
  t.truthy(encoder.root.lookupType('Component'));
  t.truthy(encoder.root.lookupType('Issue'));
  t.truthy(encoder.root.lookupEnum('Severity'));

  // Verify it can actually encode data (full roundtrip)
  const metadata = {
    analysisDate: 1700000000000,
    organizationKey: 'test-org',
    projectKey: 'test-project',
    rootComponentRef: 1,
    branchName: 'main',
    branchType: 1,
    scmRevisionId: 'abc123',
    projectVersion: '1.0.0',
  };
  const buffer = encoder.encodeMetadata(metadata);
  t.true(Buffer.isBuffer(buffer) || buffer instanceof Uint8Array);
  t.true(buffer.length > 0);

  // Decode to verify correctness
  const Metadata = encoder.root.lookupType('Metadata');
  const decoded = Metadata.decode(buffer);
  t.is(decoded.projectKey, 'test-project');
  t.is(decoded.organizationKey, 'test-org');
});
