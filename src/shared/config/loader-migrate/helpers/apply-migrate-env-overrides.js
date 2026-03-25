// -------- Apply Migrate Env Overrides --------
export function applyMigrateEnvOverrides(config) {
  if (config.sonarqube && process.env.SONARQUBE_TOKEN) {
    config.sonarqube.token = process.env.SONARQUBE_TOKEN;
  }
  if (config.sonarqube && process.env.SONARQUBE_URL) {
    config.sonarqube.url = process.env.SONARQUBE_URL;
  }
  if (process.env.SONARCLOUD_TOKEN && config.sonarcloud?.organizations) {
    for (const org of config.sonarcloud.organizations) {
      org.token = process.env.SONARCLOUD_TOKEN;
    }
  }
}
