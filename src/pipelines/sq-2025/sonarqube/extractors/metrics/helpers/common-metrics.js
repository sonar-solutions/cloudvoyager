// -------- Common Metrics List --------

/** Standard metrics to extract from SonarQube. */
export const COMMON_METRICS = [
  'ncloc',                    // Lines of code
  'complexity',               // Cyclomatic complexity
  'cognitive_complexity',     // Cognitive complexity
  'coverage',                 // Code coverage
  'line_coverage',            // Line coverage
  'branch_coverage',          // Branch coverage
  'duplicated_lines_density', // Duplicated lines density
  'duplicated_blocks',        // Duplicated blocks
  'violations',               // Total issues
  'bugs',                     // Bug count
  'vulnerabilities',          // Vulnerability count
  'code_smells',              // Code smell count
  'security_hotspots',        // Security hotspot count
  'sqale_index',              // Technical debt
  'sqale_rating',             // Maintainability rating
  'reliability_rating',       // Reliability rating
  'security_rating',          // Security rating
  'alert_status'              // Quality gate status
];
