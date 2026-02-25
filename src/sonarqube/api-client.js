import axios from 'axios';
import { SonarQubeAPIError, AuthenticationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import * as qual from './api/quality.js';
import * as ih from './api/issues-hotspots.js';
import * as perm from './api/permissions.js';
import * as sc from './api/server-config.js';

export class SonarQubeClient {
  constructor(config) {
    this.baseURL = config.url.replace(/\/$/, '');
    this.token = config.token;
    this.projectKey = config.projectKey;
    this.client = axios.create({
      baseURL: this.baseURL,
      auth: { username: this.token, password: '' },
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 30000
    });
    this.client.interceptors.response.use(
      response => response,
      error => this.handleError(error)
    );
  }

  handleError(error) {
    if (error.response) {
      const { status, data, config } = error.response;
      if (status === 401 || status === 403) {
        throw new AuthenticationError(
          `Authentication failed for SonarQube: ${data.errors?.[0]?.msg || 'Invalid credentials'}`, 'SonarQube'
        );
      }
      const message = data.errors?.[0]?.msg || data.message || error.message;
      throw new SonarQubeAPIError(`SonarQube API error (${status}): ${message}`, status, config.url);
    } else if (error.request) {
      const baseURL = this.baseURL || error.config?.baseURL || 'unknown';
      const errorCode = error.code || 'UNKNOWN';
      let message = `Cannot connect to SonarQube server at ${baseURL}`;
      if (errorCode === 'ECONNREFUSED') message += ' - Connection refused. Is the server running?';
      else if (errorCode === 'ETIMEDOUT') message += ' - Connection timed out';
      else if (errorCode === 'ENOTFOUND') message += ' - Server not found. Check the URL';
      else message += ` - ${error.message} (${errorCode})`;
      throw new SonarQubeAPIError(message, 0, error.config?.url);
    } else {
      throw new SonarQubeAPIError(`Request failed: ${error.message}`);
    }
  }

  async getPaginated(endpoint, params = {}, dataKey = 'components') {
    let allResults = [];
    let page = 1;
    const pageSize = params.ps || 500;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      logger.debug(`Fetching ${endpoint} - page ${page}`);
      const response = await this.client.get(endpoint, { params: { ...params, p: page, ps: pageSize } });
      const data = response.data;
      const results = data[dataKey] || [];
      allResults = allResults.concat(results);
      const total = data.paging?.total || data.total || 0;
      logger.debug(`Fetched ${allResults.length}/${total} items from ${endpoint}`);
      if (page * pageSize >= total || results.length < pageSize) break;
      page++;
    }
    logger.info(`Retrieved ${allResults.length} items from ${endpoint}`);
    return allResults;
  }

  async getProject() {
    logger.info(`Fetching project: ${this.projectKey}`);
    const response = await this.client.get('/api/projects/search', { params: { projects: this.projectKey } });
    const projects = response.data.components || [];
    if (projects.length === 0) throw new SonarQubeAPIError(`Project not found: ${this.projectKey}`);
    return projects[0];
  }

  async getBranches(pk = null) {
    const projectKey = pk || this.projectKey;
    logger.debug(`Fetching branches for project: ${projectKey}`);
    const response = await this.client.get('/api/project_branches/list', { params: { project: projectKey } });
    return response.data.branches || [];
  }

  async getQualityGate() {
    logger.info(`Fetching quality gate for project: ${this.projectKey}`);
    try {
      const response = await this.client.get('/api/qualitygates/get_by_project', { params: { project: this.projectKey } });
      return response.data.qualityGate || null;
    } catch (error) {
      if (error.statusCode === 404) { logger.warn('No quality gate found for project'); return null; }
      throw error;
    }
  }

  async getMetrics() {
    logger.info('Fetching metrics definitions');
    return await this.getPaginated('/api/metrics/search', {}, 'metrics');
  }

  async getMeasures(branch = null, metricKeys = []) {
    logger.info(`Fetching measures for project: ${this.projectKey}`);
    const params = { component: this.projectKey, metricKeys: metricKeys.join(',') };
    if (branch) params.branch = branch;
    const response = await this.client.get('/api/measures/component', { params });
    return response.data.component || {};
  }

  async getComponentTree(branch = null, metricKeys = []) {
    logger.info(`Fetching component tree for project: ${this.projectKey}`);
    const params = { component: this.projectKey, metricKeys: metricKeys.join(','), qualifiers: 'DIR,FIL', strategy: 'all' };
    if (branch) params.branch = branch;
    return await this.getPaginated('/api/measures/component_tree', params, 'components');
  }

  async getSourceCode(fileKey, branch = null) {
    logger.debug(`Fetching source code for: ${fileKey}`);
    const params = { key: fileKey };
    if (branch) params.branch = branch;
    const response = await this.client.get('/api/sources/raw', { params, responseType: 'text' });
    return response.data;
  }

  async getSourceFiles(branch = null) {
    logger.info(`Fetching source files for project: ${this.projectKey}`);
    const params = { component: this.projectKey, qualifiers: 'FIL' };
    if (branch) params.branch = branch;
    return await this.getPaginated('/api/components/tree', params, 'components');
  }

  async getQualityProfiles() {
    logger.info(`Fetching quality profiles for project: ${this.projectKey}`);
    const response = await this.client.get('/api/qualityprofiles/search', { params: { project: this.projectKey } });
    return response.data.profiles || [];
  }

  async getActiveRules(profileKey) {
    logger.debug(`Fetching active rules for profile: ${profileKey}`);
    return await this.getPaginated('/api/rules/search', { qprofile: profileKey, ps: 100 }, 'rules');
  }

  async getLatestAnalysisRevision() {
    logger.info(`Fetching latest analysis revision for project: ${this.projectKey}`);
    try {
      const response = await this.client.get('/api/project_analyses/search', { params: { project: this.projectKey, ps: 1 } });
      const analyses = response.data.analyses || [];
      if (analyses.length > 0 && analyses[0].revision) {
        logger.info(`Latest SCM revision: ${analyses[0].revision}`);
        return analyses[0].revision;
      }
      logger.warn('No SCM revision found in latest analysis');
      return null;
    } catch (error) {
      logger.warn(`Failed to get analysis revision: ${error.message}`);
      return null;
    }
  }

  async listAllProjects() {
    logger.info('Fetching all projects from SonarQube...');
    return await this.getPaginated('/api/projects/search', {}, 'components');
  }

  async testConnection() {
    try {
      logger.info('Testing connection to SonarQube...');
      await this.client.get('/api/system/status');
      logger.info('Successfully connected to SonarQube');
      return true;
    } catch (error) {
      logger.error(`Failed to connect to SonarQube: ${error.message}`);
      throw error;
    }
  }

  async getIssues(f = {}) { return ih.getIssues(this.getPaginated.bind(this), this.projectKey, f); }
  async getIssuesWithComments(f = {}) { return ih.getIssuesWithComments(this.getPaginated.bind(this), this.projectKey, f); }
  async getHotspots(f = {}) { return ih.getHotspots(this.getPaginated.bind(this), this.projectKey, f); }
  async getHotspotDetails(k) { return ih.getHotspotDetails(this.client, k); }
  async getQualityGates() { return qual.getQualityGates(this.client); }
  async getQualityGateDetails(n) { return qual.getQualityGateDetails(this.client, n); }
  async getQualityGatePermissions(n) { return qual.getQualityGatePermissions(this.client, n); }
  async getAllQualityProfiles() { return qual.getAllQualityProfiles(this.client); }
  async getQualityProfileBackup(l, q) { return qual.getQualityProfileBackup(this.client, l, q); }
  async getQualityProfilePermissions(l, q) { return qual.getQualityProfilePermissions(this.client, l, q); }
  async getGroups() { return perm.getGroups(this.getPaginated.bind(this)); }
  async getGlobalPermissions() { return perm.getGlobalPermissions(this.getPaginated.bind(this)); }
  async getProjectPermissions(pk) { return perm.getProjectPermissions(this.getPaginated.bind(this), pk); }
  async getPermissionTemplates() { return perm.getPermissionTemplates(this.client); }
  async getPortfolios() { return perm.getPortfolios(this.client); }
  async getPortfolioDetails(k) { return perm.getPortfolioDetails(this.client, k); }
  async getProjectSettings(pk = null) { return sc.getProjectSettings(this.client, pk || this.projectKey); }
  async getProjectTags() { return sc.getProjectTags(this.client); }
  async getProjectLinks(pk = null) { return sc.getProjectLinks(this.client, pk || this.projectKey); }
  async getNewCodePeriods(pk = null) { return sc.getNewCodePeriods(this.client, pk || this.projectKey); }
  async getAlmSettings() { return sc.getAlmSettings(this.client); }
  async getProjectBinding(pk = null) { return sc.getProjectBinding(this.client, pk || this.projectKey); }
  async getSystemInfo() { return sc.getSystemInfo(this.client); }
  async getInstalledPlugins() { return sc.getInstalledPlugins(this.client); }
  async getWebhooks(pk = null) { return sc.getWebhooks(this.client, pk); }
}
