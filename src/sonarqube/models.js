/**
 * Data models for SonarQube entities
 */

export class ProjectData {
  project = null;
  branches = [];
  qualityGate = null;
}

export function createIssueData(issue) {
  return {
    key: issue.key,
    rule: issue.rule,
    severity: issue.severity,
    component: issue.component,
    project: issue.project,
    line: issue.line,
    hash: issue.hash,
    textRange: issue.textRange,
    flows: issue.flows || [],
    status: issue.status,
    message: issue.message,
    effort: issue.effort,
    debt: issue.debt,
    author: issue.author,
    tags: issue.tags || [],
    creationDate: issue.creationDate,
    updateDate: issue.updateDate,
    type: issue.type,
  };
}

export function createMetricData(metric) {
  return {
    key: metric.key,
    name: metric.name,
    description: metric.description,
    domain: metric.domain,
    type: metric.type,
    direction: metric.direction,
    qualitative: metric.qualitative,
    hidden: metric.hidden,
  };
}

export function createMeasureData(measure, componentKey) {
  return {
    metric: measure.metric,
    value: measure.value,
    component: componentKey,
    bestValue: measure.bestValue,
    period: measure.period,
  };
}

export function createComponentData(component) {
  return {
    key: component.key,
    name: component.name,
    qualifier: component.qualifier,
    path: component.path,
    language: component.language,
    measures: component.measures || [],
  };
}

export class SourceFileData {
  constructor(fileKey, content, language = '') {
    this.key = fileKey;
    this.content = content;
    this.lines = content.split('\n');
    this.language = language;
  }

  get lineCount() {
    return this.lines.length;
  }
}
