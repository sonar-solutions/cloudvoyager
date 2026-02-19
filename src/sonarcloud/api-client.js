import axios from 'axios';
import { SonarCloudAPIError, AuthenticationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import * as qp from './api/quality-profiles.js';
import * as qg from './api/quality-gates.js';
import * as iss from './api/issues.js';
import * as hs from './api/hotspots.js';
import * as perms from './api/permissions.js';
import * as pc from './api/project-config.js';

export class SonarCloudClient {
  constructor(config) {
    this.baseURL = config.url.replace(/\/$/, '');
    this.token = config.token;
    this.organization = config.organization;
    this.projectKey = config.projectKey;
    const rateLimit = config.rateLimit || {};
    this._maxRetries = rateLimit.maxRetries ?? 3;
    this._baseDelay = rateLimit.baseDelay ?? 1000;
    this._minRequestInterval = rateLimit.minRequestInterval ?? 0;
    this._lastPostTime = 0;
    this.client = axios.create({
      baseURL: this.baseURL,
      auth: { username: this.token, password: '' },
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 60000
    });
    this.client.interceptors.request.use(async (reqConfig) => {
      if (reqConfig.method === 'post') {
        const now = Date.now();
        const elapsed = now - this._lastPostTime;
        if (elapsed < this._minRequestInterval) {
          await new Promise(resolve => setTimeout(resolve, this._minRequestInterval - elapsed));
        }
        this._lastPostTime = Date.now();
      }
      return reqConfig;
    });
    this.client.interceptors.response.use(
      response => response,
      async (error) => {
        const status = error.response?.status;
        const cfg = error.config;
        if ((status === 503 || status === 429) && cfg) {
          cfg._retryCount = (cfg._retryCount || 0) + 1;
          if (cfg._retryCount <= this._maxRetries) {
            const delay = this._baseDelay * Math.pow(2, cfg._retryCount - 1);
            logger.warn(`Rate limited (${status}), retry ${cfg._retryCount}/${this._maxRetries} in ${(delay / 1000).toFixed(1)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.client(cfg);
          }
          logger.error(`Rate limited (${status}), exhausted all ${this._maxRetries} retries`);
        }
        return this.handleError(error);
      }
    );
  }

  handleError(error) {
    if (error.response) {
      const { status, data, config } = error.response;
      if (status === 401 || status === 403) {
        throw new AuthenticationError(
          `Authentication failed for SonarCloud: ${data.errors?.[0]?.msg || 'Invalid credentials'}`, 'SonarCloud'
        );
      }
      const message = data.errors?.[0]?.msg || data.message || error.message;
      throw new SonarCloudAPIError(`SonarCloud API error (${status}): ${message}`, status, config.url);
    } else if (error.request) {
      const baseURL = this.baseURL || error.config?.baseURL || 'unknown';
      const errorCode = error.code || 'UNKNOWN';
      let message = `Cannot connect to SonarCloud server at ${baseURL}`;
      if (errorCode === 'ECONNREFUSED') message += ' - Connection refused. Is the server running?';
      else if (errorCode === 'ETIMEDOUT') message += ' - Connection timed out';
      else if (errorCode === 'ENOTFOUND') message += ' - Server not found. Check the URL';
      else message += ` - ${error.message} (${errorCode})`;
      throw new SonarCloudAPIError(message, 0, error.config?.url);
    } else {
      throw new SonarCloudAPIError(`Request failed: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      logger.info('Testing connection to SonarCloud...');
      const response = await this.client.get('/api/organizations/search', {
        params: { organizations: this.organization }
      });
      const orgs = response.data.organizations || [];
      if (orgs.length === 0) throw new SonarCloudAPIError(`Organization not found: ${this.organization}`);
      logger.info('Successfully connected to SonarCloud');
      return true;
    } catch (error) {
      logger.error(`Failed to connect to SonarCloud: ${error.message}`);
      throw error;
    }
  }

  async projectExists() {
    try {
      const response = await this.client.get('/api/projects/search', {
        params: { projects: this.projectKey, organization: this.organization }
      });
      return (response.data.components || []).length > 0;
    } catch (error) {
      logger.error(`Failed to check project existence: ${error.message}`);
      return false;
    }
  }

  async isProjectKeyTakenGlobally(projectKey) {
    try {
      const response = await this.client.get('/api/components/show', { params: { component: projectKey } });
      return { taken: true, owner: response.data.component?.organization || 'unknown' };
    } catch (error) {
      if (error.status === 404 || error.message?.includes('not found')) return { taken: false, owner: null };
      logger.debug(`Could not check global key availability for ${projectKey}: ${error.message}`);
      return { taken: true, owner: 'unknown' };
    }
  }

  async ensureProject(projectName = null) {
    logger.info(`Ensuring project exists: ${this.projectKey}`);
    const exists = await this.projectExists();
    if (exists) {
      logger.info('Project already exists');
    } else {
      const displayName = projectName || this.projectKey;
      logger.info(`Project does not exist, creating with name: ${displayName}`);
      await this.client.post('/api/projects/create', null, {
        params: { project: this.projectKey, name: displayName, organization: this.organization }
      });
      logger.info('Project created successfully');
    }
  }

  async getAnalysisStatus(ceTaskId) {
    try {
      const response = await this.client.get('/api/ce/task', { params: { id: ceTaskId } });
      return response.data.task;
    } catch (error) {
      logger.error(`Failed to get analysis status: ${error.message}`);
      throw error;
    }
  }

  async waitForAnalysis(ceTaskId, maxWaitSeconds = 300) {
    logger.info(`Waiting for analysis to complete (task: ${ceTaskId})...`);
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const task = await this.getAnalysisStatus(ceTaskId);
      logger.debug(`Analysis status: ${task.status}`);
      if (task.status === 'SUCCESS') { logger.info('Analysis completed successfully'); return task; }
      if (task.status === 'FAILED' || task.status === 'CANCELED') {
        throw new SonarCloudAPIError(`Analysis ${task.status.toLowerCase()}: ${task.errorMessage || 'Unknown error'}`);
      }
      if (Date.now() - startTime > maxWaitMs) throw new SonarCloudAPIError(`Analysis timeout after ${maxWaitSeconds} seconds`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async getQualityProfiles() { return qp.getQualityProfiles(this.client, this.organization, this.projectKey); }
  async getMainBranchName() { return qp.getMainBranchName(this.client, this.projectKey); }
  async restoreQualityProfile(bk) { return qp.restoreQualityProfile(this.client, this.organization, bk); }
  async setDefaultQualityProfile(l, q) { return qp.setDefaultQualityProfile(this.client, this.organization, l, q); }
  async addQualityProfileGroupPermission(q, l, g) { return qp.addQualityProfileGroupPermission(this.client, this.organization, q, l, g); }
  async addQualityProfileUserPermission(q, l, u) { return qp.addQualityProfileUserPermission(this.client, this.organization, q, l, u); }
  async searchQualityProfiles(l = null) { return qp.searchQualityProfiles(this.client, this.organization, l); }
  async getActiveRules(pk) { return qp.getActiveRules(this.client, this.organization, pk); }
  async addQualityProfileToProject(l, q, pk) { return qp.addQualityProfileToProject(this.client, this.organization, l, q, pk); }
  async createQualityGate(n) { return qg.createQualityGate(this.client, this.organization, n); }
  async createQualityGateCondition(g, m, o, e) { return qg.createQualityGateCondition(this.client, this.organization, g, m, o, e); }
  async setDefaultQualityGate(id) { return qg.setDefaultQualityGate(this.client, this.organization, id); }
  async assignQualityGateToProject(g, pk) { return qg.assignQualityGateToProject(this.client, this.organization, g, pk); }
  async transitionIssue(i, t) { return iss.transitionIssue(this.client, i, t); }
  async assignIssue(i, a) { return iss.assignIssue(this.client, i, a); }
  async addIssueComment(i, t) { return iss.addIssueComment(this.client, i, t); }
  async setIssueTags(i, t) { return iss.setIssueTags(this.client, i, t); }
  async searchIssues(pk, f = {}) { return iss.searchIssues(this.client, this.organization, pk, f); }
  async changeHotspotStatus(h, s, r = null) { return hs.changeHotspotStatus(this.client, h, s, r); }
  async searchHotspots(pk, f = {}) { return hs.searchHotspots(this.client, pk, f); }
  async addHotspotComment(h, t) { return hs.addHotspotComment(this.client, h, t); }
  async createGroup(n, d = '') { return perms.createGroup(this.client, this.organization, n, d); }
  async addGroupPermission(g, p) { return perms.addGroupPermission(this.client, this.organization, g, p); }
  async addProjectGroupPermission(g, pk, p) { return perms.addProjectGroupPermission(this.client, this.organization, g, pk, p); }
  async createPermissionTemplate(n, d = '', p = '') { return perms.createPermissionTemplate(this.client, this.organization, n, d, p); }
  async addGroupToTemplate(t, g, p) { return perms.addGroupToTemplate(this.client, this.organization, t, g, p); }
  async setDefaultTemplate(t, q = 'TRK') { return perms.setDefaultTemplate(this.client, this.organization, t, q); }
  async setProjectSetting(k, v, c = null) { return pc.setProjectSetting(this.client, k, v, c || this.projectKey); }
  async setProjectTags(pk, t) { return pc.setProjectTags(this.client, pk, t); }
  async createProjectLink(pk, n, u) { return pc.createProjectLink(this.client, pk, n, u); }
  async setGithubBinding(pk, a, r, m = false) { return pc.setGithubBinding(this.client, pk, a, r, m); }
  async setGitlabBinding(pk, a, r) { return pc.setGitlabBinding(this.client, pk, a, r); }
  async setAzureBinding(pk, a, p, r) { return pc.setAzureBinding(this.client, pk, a, p, r); }
  async setBitbucketBinding(pk, a, r, s) { return pc.setBitbucketBinding(this.client, pk, a, r, s); }
  async createPortfolio(n, d = '', v = 'public', k = null) { return pc.createPortfolio(this.client, this.organization, n, d, v, k); }
  async addProjectToPortfolio(pk, prj) { return pc.addProjectToPortfolio(this.client, pk, prj); }
}
