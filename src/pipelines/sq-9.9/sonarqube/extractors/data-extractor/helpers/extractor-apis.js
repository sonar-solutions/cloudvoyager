// -------- Barrel re-export of all extraction API functions --------

export { extractProjectData } from '../../projects.js';
export { extractIssues } from '../../issues.js';
export { extractMetrics, getCommonMetricKeys } from '../../metrics.js';
export { extractMeasures, extractComponentMeasures } from '../../measures.js';
export { extractSources } from '../../sources.js';
export { extractActiveRules } from '../../rules.js';
export { extractChangesets } from '../../changesets.js';
export { extractSymbols } from '../../symbols.js';
export { extractSyntaxHighlighting } from '../../syntax-highlighting.js';
export { extractHotspotsAsIssues } from '../../hotspots-to-issues.js';
export { extractDuplications } from '../../duplications.js';
