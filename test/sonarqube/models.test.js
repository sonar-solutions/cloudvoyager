import test from 'ava';
import {
  ProjectData,
  createIssueData,
  createMetricData,
  createMeasureData,
  createComponentData,
  SourceFileData
} from '../../src/sonarqube/models.js';

// ProjectData
test('ProjectData has default properties', t => {
  const pd = new ProjectData();
  t.is(pd.project, null);
  t.deepEqual(pd.branches, []);
  t.is(pd.qualityGate, null);
});

test('ProjectData properties can be set', t => {
  const pd = new ProjectData();
  pd.project = { key: 'my-project' };
  pd.branches = [{ name: 'main' }];
  pd.qualityGate = { name: 'Sonar way' };
  t.deepEqual(pd.project, { key: 'my-project' });
  t.is(pd.branches.length, 1);
  t.is(pd.qualityGate.name, 'Sonar way');
});

// createIssueData
test('createIssueData maps all fields', t => {
  const issue = {
    key: 'ISSUE-1',
    rule: 'js:S1234',
    severity: 'MAJOR',
    component: 'project:src/index.js',
    project: 'project',
    line: 42,
    hash: 'abc123',
    textRange: { startLine: 42, endLine: 42, startOffset: 0, endOffset: 10 },
    flows: [{ locations: [] }],
    status: 'OPEN',
    message: 'Fix this',
    effort: '15min',
    debt: '15min',
    author: 'user@example.com',
    tags: ['bug'],
    creationDate: '2024-01-01',
    updateDate: '2024-01-02',
    type: 'BUG'
  };
  const data = createIssueData(issue);
  t.is(data.key, 'ISSUE-1');
  t.is(data.rule, 'js:S1234');
  t.is(data.severity, 'MAJOR');
  t.is(data.component, 'project:src/index.js');
  t.is(data.project, 'project');
  t.is(data.line, 42);
  t.is(data.hash, 'abc123');
  t.deepEqual(data.textRange, { startLine: 42, endLine: 42, startOffset: 0, endOffset: 10 });
  t.deepEqual(data.flows, [{ locations: [] }]);
  t.is(data.status, 'OPEN');
  t.is(data.message, 'Fix this');
  t.is(data.effort, '15min');
  t.is(data.debt, '15min');
  t.is(data.author, 'user@example.com');
  t.deepEqual(data.tags, ['bug']);
  t.is(data.creationDate, '2024-01-01');
  t.is(data.updateDate, '2024-01-02');
  t.is(data.type, 'BUG');
});

test('createIssueData defaults flows and tags to empty arrays', t => {
  const data = createIssueData({ key: 'ISSUE-2' });
  t.deepEqual(data.flows, []);
  t.deepEqual(data.tags, []);
});

// createMetricData
test('createMetricData maps all fields', t => {
  const metric = {
    key: 'coverage',
    name: 'Coverage',
    description: 'Code coverage',
    domain: 'Coverage',
    type: 'PERCENT',
    direction: 1,
    qualitative: true,
    hidden: false
  };
  const data = createMetricData(metric);
  t.is(data.key, 'coverage');
  t.is(data.name, 'Coverage');
  t.is(data.description, 'Code coverage');
  t.is(data.domain, 'Coverage');
  t.is(data.type, 'PERCENT');
  t.is(data.direction, 1);
  t.true(data.qualitative);
  t.false(data.hidden);
});

// createMeasureData
test('createMeasureData maps all fields', t => {
  const measure = {
    metric: 'coverage',
    value: '85.5',
    bestValue: false,
    period: { value: '1.2' }
  };
  const data = createMeasureData(measure, 'project:src/index.js');
  t.is(data.metric, 'coverage');
  t.is(data.value, '85.5');
  t.is(data.component, 'project:src/index.js');
  t.is(data.bestValue, false);
  t.deepEqual(data.period, { value: '1.2' });
});

// createComponentData
test('createComponentData maps all fields', t => {
  const component = {
    key: 'project:src/index.js',
    name: 'index.js',
    qualifier: 'FIL',
    path: 'src/index.js',
    language: 'js',
    measures: [{ metric: 'lines', value: '100' }]
  };
  const data = createComponentData(component);
  t.is(data.key, 'project:src/index.js');
  t.is(data.name, 'index.js');
  t.is(data.qualifier, 'FIL');
  t.is(data.path, 'src/index.js');
  t.is(data.language, 'js');
  t.is(data.measures.length, 1);
});

test('createComponentData defaults measures to empty array', t => {
  const data = createComponentData({ key: 'project:src/app.js' });
  t.deepEqual(data.measures, []);
});

// SourceFileData
test('SourceFileData constructor sets properties', t => {
  const sf = new SourceFileData('project:src/index.js', 'line1\nline2\nline3', 'js');
  t.is(sf.key, 'project:src/index.js');
  t.is(sf.content, 'line1\nline2\nline3');
  t.deepEqual(sf.lines, ['line1', 'line2', 'line3']);
  t.is(sf.language, 'js');
});

test('SourceFileData lineCount returns correct count', t => {
  const sf = new SourceFileData('key', 'a\nb\nc\nd', 'js');
  t.is(sf.lineCount, 4);
});

test('SourceFileData defaults language to empty string', t => {
  const sf = new SourceFileData('key', 'content');
  t.is(sf.language, '');
});

test('SourceFileData handles single line content', t => {
  const sf = new SourceFileData('key', 'single line', 'py');
  t.is(sf.lineCount, 1);
  t.deepEqual(sf.lines, ['single line']);
});

test('SourceFileData handles empty content', t => {
  const sf = new SourceFileData('key', '', 'js');
  t.is(sf.lineCount, 1);
  t.deepEqual(sf.lines, ['']);
});
