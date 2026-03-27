// -------- Strip External Prefix from SQ Rule Engine IDs --------

/**
 * SonarQube 2025+ prefixes external linter rule repos with "external_"
 * (e.g. "external_ruff:D200"). Strip it so the engineId sent to
 * SonarCloud is clean (e.g. "ruff"), since SC adds its own "external_"
 * prefix when storing the issue.
 */
export function stripExternalPrefix(engineId) {
  if (!engineId) return engineId;
  return engineId.startsWith('external_')
    ? engineId.slice('external_'.length)
    : engineId;
}
