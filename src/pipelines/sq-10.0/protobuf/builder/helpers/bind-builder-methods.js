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
import { mapSeverity } from './map-severity.js';

// -------- Bind All Builder Methods to Context --------

export function bindBuilderMethods(ctx) {
  ctx.getComponentRef = (key) => {
    if (!ctx.componentRefMap.has(key)) ctx.componentRefMap.set(key, ctx.nextRef++);
    return ctx.componentRefMap.get(key);
  };
  ctx.buildMetadata = () => buildMetadata(ctx);
  ctx.buildComponents = () => buildComponents(ctx);
  ctx.buildIssues = () => buildIssues(ctx);
  ctx.buildExternalIssues = () => buildExternalIssues(ctx);
  ctx.buildMeasures = () => buildMeasures(ctx);
  ctx.buildDuplications = () => buildDuplications(ctx);
  ctx.buildMeasure = (m) => buildMeasure(m);
  ctx.parseMeasureValue = (v) => parseMeasureValue(v);
  ctx.buildSourceFiles = () => buildSourceFiles(ctx);
  ctx.buildActiveRules = () => buildActiveRules(ctx);
  ctx.buildQProfiles = () => buildQProfiles(ctx);
  ctx.buildChangesets = () => buildChangesets(ctx);
  ctx.buildFileCountsByType = () => buildFileCountsByType(ctx);
  ctx.buildAll = () => buildAll(ctx);
  ctx.mapSeverity = (s) => mapSeverity(s);
  ctx.buildPlugins = () => ({ 'javascript': { key: 'javascript', updatedAt: Date.now() } });
}
