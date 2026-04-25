import { readConfig, getSqcUrl, getSqcToken, getSqcOrgKey } from './config-reader.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let response;
    try {
      response = await fetch(url, options);
    } catch (networkErr) {
      if (attempt < retries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.error(`  Retry ${attempt + 1}/${retries}: network error on ${url} (waiting ${delay}ms): ${networkErr.message}`);
        await sleep(delay);
        continue;
      }
      throw new Error(`Network error after ${retries} retries. URL: ${url}. Last error: ${networkErr.message}`);
    }

    if (response.status === 401) {
      throw new Error(`SQC auth failed (401). Check SONARCLOUD_TOKEN. URL: ${url}`);
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt < retries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.error(`  Retry ${attempt + 1}/${retries}: ${response.status} on ${url} (waiting ${delay}ms)`);
        await sleep(delay);
        continue;
      }
      throw new Error(`SQC API error ${response.status} after ${retries} retries. URL: ${url}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`SQC API error ${response.status}: ${body.slice(0, 500)}. URL: ${url}`);
    }

    try {
      return await response.json();
    } catch {
      return {};
    }
  }
}

export class SqcClient {
  constructor(baseUrl, token, orgKey) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.orgKey = orgKey;
    this.headers = { 'Authorization': `Bearer ${token}` };
  }

  static async fromConfig(configPath) {
    const config = await readConfig(configPath);
    const token = getSqcToken(config);
    if (!token) throw new Error('SonarCloud token not found in config. Check sonarcloud.organizations[0].token.');
    const url = getSqcUrl(config);
    if (!url) throw new Error('SonarCloud URL not found in config.');
    return new SqcClient(url, token, getSqcOrgKey(config));
  }

  async get(path, params = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return fetchWithRetry(url.toString(), { headers: this.headers });
  }

  async deleteProject(projectKey) {
    const url = `${this.baseUrl}/api/projects/delete`;
    const body = `project=${encodeURIComponent(projectKey)}`;
    try {
      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });
      return { deleted: true };
    } catch (err) {
      if (err.message.includes('404')) return { deleted: false, reason: 'not_found' };
      throw err;
    }
  }

  async getIssueCount(projectKey) {
    const data = await this.get('/api/issues/search', {
      componentKeys: projectKey,
      organization: this.orgKey,
      ps: 1
    });
    return data?.total ?? 0;
  }

  async getIssuesByCreationDate(projectKey) {
    const data = await this.get('/api/issues/search', {
      componentKeys: projectKey,
      organization: this.orgKey,
      ps: 1,
      facets: 'createdAt'
    });
    const facet = data?.facets?.find(f => f.property === 'createdAt');
    return {
      total: data?.total ?? 0,
      dateBuckets: facet?.values ?? []
    };
  }

  async getHotspotCount(projectKey) {
    const data = await this.get('/api/hotspots/search', {
      projectKey,
      ps: 1
    });
    return data?.paging?.total ?? 0;
  }

  async getProjectExists(projectKey) {
    try {
      await this.get('/api/components/show', { component: projectKey });
      return true;
    } catch (e) {
      if (e.message.includes('404')) return false;
      throw e;
    }
  }

  async getProjectSettings(projectKey) {
    const data = await this.get('/api/settings/values', { component: projectKey });
    return data?.settings ?? [];
  }

  async getQualityProfiles(projectKey) {
    const data = await this.get('/api/qualityprofiles/search', {
      project: projectKey,
      organization: this.orgKey
    });
    return data?.profiles ?? [];
  }

  async searchIssues(projectKey, params = {}) {
    return this.get('/api/issues/search', {
      componentKeys: projectKey,
      organization: this.orgKey,
      ps: 500,
      ...params
    });
  }
}
