// -------- Fallback SonarCloud Rule Repositories --------

/**
 * Known built-in SonarCloud rule repository keys.
 *
 * Used as a fallback when the SonarCloud /api/rules/repositories
 * endpoint is unreachable. Issues whose rule repo is NOT in this
 * set are treated as external (third-party) issues.
 */
export const FALLBACK_SONARCLOUD_REPOS = new Set([
  // -------- Core language analyzers --------
  'javascript', 'typescript', 'python', 'java',
  'php', 'css', 'web', 'xml', 'go', 'kotlin',
  'ruby', 'scala', 'swift', 'csharp', 'vbnet',
  'cpp', 'c', 'objc', 'cobol', 'abap', 'pli',
  'rpg', 'flex', 'html', 'jsp', 'apex',

  // -------- SQL / database analyzers --------
  'plsql', 'tsql',

  // -------- SonarQube internal repos --------
  'squid', 'common-java', 'common-js', 'common-ts',
  'csharpsquid', 'jssecurity', 'phpsecurity',
  'javasecurity', 'pythonsecurity', 'pythonbugs',
  'roslyn.sonaranalyzer.security.cs', 'sonarlint',

  // -------- IaC / config analyzers --------
  'docker', 'kubernetes', 'terraform',
  'cloudformation', 'azureresourcemanager', 'githubactions',

  // -------- Misc built-in repos --------
  'secrets', 'text', 'vb',
]);
