import { buildComponents } from '../../build-components.js';
import { buildIssues } from '../../build-issues.js';
import { buildExternalIssues } from '../../build-external-issues.js';
import { buildMeasures, buildMeasure, parseMeasureValue } from '../../build-measures.js';
import { buildDuplications } from '../../build-duplications.js';
import { buildMetadata } from './build-metadata.js';
import { buildSourceFiles } from './build-source-files.js';
import { buildActiveRules } from './build-active-rules.js';
import { buildQProfiles } from './build-qprofiles.js';
import { buildChangesets } from './build-changesets.js';
import { buildFileCountsByType } from './build-file-counts.js';
import { buildAll } from './build-all.js';
import { attachUtilityMethods } from './utility-methods.js';

// -------- Main Logic --------

// Factory function to create a ProtobufBuilder instance.
export function createProtobufBuilder(extractedData, sonarCloudConfig = {}, sonarCloudProfiles = [], options = {}) {
  const instance = {
    data: extractedData, sonarCloudConfig, sonarCloudProfiles,
    componentRefMap: new Map(), nextRef: 1,
    sonarCloudBranchName: options.sonarCloudBranchName || null,
    referenceBranchName: options.referenceBranchName || null,
    sonarCloudRepos: options.sonarCloudRepos || new Set(),
    ruleEnrichmentMap: options.ruleEnrichmentMap || new Map(),
  };

  attachUtilityMethods(instance);
  instance.buildMetadata = () => buildMetadata(instance);
  instance.buildComponents = () => buildComponents(instance);
  instance.buildIssues = () => buildIssues(instance);
  instance.buildExternalIssues = () => buildExternalIssues(instance);
  instance.buildMeasures = () => buildMeasures(instance);
  instance.buildDuplications = () => buildDuplications(instance);
  instance.buildMeasure = (m) => buildMeasure(m);
  instance.parseMeasureValue = (v) => parseMeasureValue(v);
  instance.buildSourceFiles = () => buildSourceFiles(instance);
  instance.buildActiveRules = () => buildActiveRules(instance);
  instance.buildQProfiles = () => buildQProfiles(instance);
  instance.buildChangesets = () => buildChangesets(instance);
  instance.buildFileCountsByType = () => buildFileCountsByType(instance);
  instance.buildAll = () => buildAll(instance);
  return instance;
}
