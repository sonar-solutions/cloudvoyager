import { buildComponents } from '../build-components.js';
import { buildIssues } from '../build-issues.js';
import { buildExternalIssues } from '../build-external-issues.js';
import { buildMeasures, buildMeasure, parseMeasureValue } from '../build-measures.js';
import { buildDuplications } from '../build-duplications.js';
import { buildMetadata } from './helpers/build-metadata.js';
import { buildSourceFiles } from './helpers/build-source-files.js';
import { buildActiveRules } from './helpers/build-active-rules.js';
import { buildQProfiles } from './helpers/build-qprofiles.js';
import { buildChangesets } from './helpers/build-changesets.js';
import { buildFileCountsByType } from './helpers/build-file-counts.js';
import { buildAll } from './helpers/build-all.js';
import { mapSeverity } from './helpers/map-severity.js';

// -------- ProtobufBuilder — Dual Export (Factory + Class) --------

export function createProtobufBuilder(extractedData, scConfig = {}, scProfiles = [], options = {}) {
  const ctx = {
    data: extractedData, sonarCloudConfig: scConfig, sonarCloudProfiles: scProfiles,
    componentRefMap: new Map(), nextRef: 1,
    sonarCloudBranchName: options.sonarCloudBranchName || null,
    referenceBranchName: options.referenceBranchName || null,
    sonarCloudRepos: options.sonarCloudRepos || new Set(),
    ruleEnrichmentMap: options.ruleEnrichmentMap || new Map(),
    getComponentRef(key) { if (!this.componentRefMap.has(key)) this.componentRefMap.set(key, this.nextRef++); return this.componentRefMap.get(key); },
    mapSeverity, buildQProfiles() { return buildQProfiles(this); }, buildFileCountsByType() { return buildFileCountsByType(this); },
    buildMetadata() { return buildMetadata(this); }, buildComponents() { return buildComponents(this); },
    buildIssues() { return buildIssues(this); }, buildExternalIssues() { return buildExternalIssues(this); },
    buildMeasures() { return buildMeasures(this); }, buildDuplications() { return buildDuplications(this); },
    buildMeasure(m) { return buildMeasure(m); }, parseMeasureValue(v) { return parseMeasureValue(v); },
    buildSourceFiles() { return buildSourceFiles(this); }, buildActiveRules() { return buildActiveRules(this); },
    buildChangesets() { return buildChangesets(this); }, buildAll() { return buildAll(this); },
  };
  return ctx;
}

export class ProtobufBuilder {
  constructor(extractedData, scConfig, scProfiles, options) {
    Object.assign(this, createProtobufBuilder(extractedData, scConfig, scProfiles, options));
  }
}
