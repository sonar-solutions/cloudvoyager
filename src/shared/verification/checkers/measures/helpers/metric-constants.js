// -------- Metric Constants --------

export const KEY_METRICS = [
  'ncloc', 'lines', 'statements', 'functions', 'classes', 'files',
  'complexity', 'cognitive_complexity',
  'violations', 'bugs', 'vulnerabilities', 'code_smells',
  'coverage', 'line_coverage', 'branch_coverage',
  'duplicated_lines_density', 'duplicated_blocks', 'duplicated_lines',
];

// Issue-derived metrics — already verified by issues/hotspots checkers
export const ISSUE_DERIVED_METRICS = new Set([
  'violations', 'bugs', 'vulnerabilities', 'code_smells', 'security_hotspots',
]);

// Scanner implementation differences can cause small deltas (1% tolerance)
export const TOLERANCE_METRICS = new Set(['lines', 'ncloc']);

// Duplication metrics recalculated by SC's own engine
export const DUPLICATION_METRICS = new Set([
  'duplicated_lines_density', 'duplicated_blocks', 'duplicated_lines',
]);
