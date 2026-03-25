import { buildComponents } from '../../build-components.js';
import { buildIssues } from '../../build-issues.js';
import { buildExternalIssues } from '../../build-external-issues.js';
import { buildMeasures, buildMeasure, parseMeasureValue } from '../../build-measures.js';
import { buildDuplications } from '../../build-duplications.js';
import { buildMetadata } from './build-metadata.js';
import { buildSourceFiles } from './build-source-files.js';
import { buildActiveRules } from './build-active-rules.js';
import { buildQProfiles } from './build-qprofiles.js';
import { buildFileCountsByType, buildPlugins } from './build-file-counts.js';
import { buildChangesets } from './build-changesets.js';
import { buildAll } from './build-all-messages.js';

// -------- Attach Build Methods --------

/** Attach all build methods to the builder instance. */
export function attachBuildMethods(inst) {
  inst.buildMetadata = () => buildMetadata(inst);
  inst.buildComponents = () => buildComponents(inst);
  inst.buildIssues = () => buildIssues(inst);
  inst.buildExternalIssues = () => buildExternalIssues(inst);
  inst.buildMeasures = () => buildMeasures(inst);
  inst.buildDuplications = () => buildDuplications(inst);
  inst.buildMeasure = (m) => buildMeasure(m);
  inst.parseMeasureValue = (v) => parseMeasureValue(v);
  inst.buildSourceFiles = () => buildSourceFiles(inst);
  inst.buildActiveRules = () => buildActiveRules(inst);
  inst.buildQProfiles = () => buildQProfiles(inst);
  inst.buildFileCountsByType = () => buildFileCountsByType(inst);
  inst.buildPlugins = () => buildPlugins();
  inst.buildChangesets = () => buildChangesets(inst);
  inst.buildAll = () => buildAll(inst);
}
