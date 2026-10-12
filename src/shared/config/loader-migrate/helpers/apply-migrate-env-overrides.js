// -------- Apply Migrate Env Overrides --------

/** Parse a multi-token env var (JSON array or comma-separated). */
function parseMultiToken(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); }
    catch { return trimmed.split(',').map(t => t.trim()).filter(Boolean); }
  }
  return trimmed.split(',').map(t => t.trim()).filter(Boolean);
}

export function applyMigrateEnvOverrides(config) {
  if (config.sonarqube && process.env.SONARQUBE_TOKEN) {
    config.sonarqube.token = process.env.SONARQUBE_TOKEN;
  }
  if (config.sonarqube && process.env.SONARQUBE_URL) {
    config.sonarqube.url = process.env.SONARQUBE_URL;
  }
  if (config.sonarcloud?.organizations) {
    if (process.env.SONARCLOUD_TOKENS) {
      const tokens = parseMultiToken(process.env.SONARCLOUD_TOKENS);
      if (tokens.length > 0) {
        for (const org of config.sonarcloud.organizations) { org.tokens = tokens; }
      }
    } else if (process.env.SONARCLOUD_TOKEN) {
      for (const org of config.sonarcloud.organizations) { org.token = process.env.SONARCLOUD_TOKEN; }
    }
  }
}
