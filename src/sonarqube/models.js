/**
 * Data models for SonarQube entities
 */

export class ProjectData {
  constructor() {
    this.project = null;
    this.branches = [];
    this.qualityGate = null;
  }
}

export class IssueData {
  constructor(issue) {
    this.key = issue.key;
    this.rule = issue.rule;
    this.severity = issue.severity;
    this.component = issue.component;
    this.project = issue.project;
    this.line = issue.line;
    this.hash = issue.hash;
    this.textRange = issue.textRange;
    this.flows = issue.flows || [];
    this.status = issue.status;
    this.message = issue.message;
    this.effort = issue.effort;
    this.debt = issue.debt;
    this.author = issue.author;
    this.tags = issue.tags || [];
    this.creationDate = issue.creationDate;
    this.updateDate = issue.updateDate;
    this.type = issue.type;
  }
}

export class MetricData {
  constructor(metric) {
    this.key = metric.key;
    this.name = metric.name;
    this.description = metric.description;
    this.domain = metric.domain;
    this.type = metric.type;
    this.direction = metric.direction;
    this.qualitative = metric.qualitative;
    this.hidden = metric.hidden;
  }
}

export class MeasureData {
  constructor(measure, componentKey) {
    this.metric = measure.metric;
    this.value = measure.value;
    this.component = componentKey;
    this.bestValue = measure.bestValue;
    this.period = measure.period;
  }
}

export class ComponentData {
  constructor(component) {
    this.key = component.key;
    this.name = component.name;
    this.qualifier = component.qualifier;
    this.path = component.path;
    this.language = component.language;
    this.measures = component.measures || [];
  }
}

export class SourceFileData {
  constructor(fileKey, content, language = '') {
    this.key = fileKey;
    this.content = content;
    this.lines = content.split('\n');
    this.language = language;
  }
}
