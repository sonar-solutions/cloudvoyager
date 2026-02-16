import axios from 'axios';
import { SonarQubeAPIError, AuthenticationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * SonarQube API Client
 */
export class SonarQubeClient {
  constructor(config) {
    this.baseURL = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.token = config.token;
    this.projectKey = config.projectKey;

    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      auth: {
        username: this.token,
        password: '' // Token-based auth uses token as username, empty password
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => this.handleError(error)
    );
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    if (error.response) {
      const { status, data, config } = error.response;
      const endpoint = config.url;

      if (status === 401 || status === 403) {
        throw new AuthenticationError(
          `Authentication failed for SonarQube: ${data.errors?.[0]?.msg || 'Invalid credentials'}`,
          'SonarQube'
        );
      }

      const message = data.errors?.[0]?.msg || data.message || error.message;
      throw new SonarQubeAPIError(
        `SonarQube API error (${status}): ${message}`,
        status,
        endpoint
      );
    } else if (error.request) {
      // More descriptive error for connection failures
      const baseURL = this.baseURL || error.config?.baseURL || 'unknown';
      const errorCode = error.code || 'UNKNOWN';
      let message = `Cannot connect to SonarQube server at ${baseURL}`;

      if (errorCode === 'ECONNREFUSED') {
        message += ' - Connection refused. Is the server running?';
      } else if (errorCode === 'ETIMEDOUT') {
        message += ' - Connection timed out';
      } else if (errorCode === 'ENOTFOUND') {
        message += ' - Server not found. Check the URL';
      } else {
        message += ` - ${error.message} (${errorCode})`;
      }

      throw new SonarQubeAPIError(message, 0, error.config?.url);
    } else {
      throw new SonarQubeAPIError(`Request failed: ${error.message}`);
    }
  }

  /**
   * Make a paginated API request
   * @param {string} endpoint - API endpoint
   * @param {object} params - Query parameters
   * @param {string} dataKey - Key in response containing the data array
   * @returns {Promise<Array>} All results from paginated response
   */
  async getPaginated(endpoint, params = {}, dataKey = 'components') {
    let allResults = [];
    let page = 1;
    const pageSize = params.ps || 500;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      logger.debug(`Fetching ${endpoint} - page ${page}`);

      const response = await this.client.get(endpoint, {
        params: {
          ...params,
          p: page,
          ps: pageSize
        }
      });

      const data = response.data;
      const results = data[dataKey] || [];
      allResults = allResults.concat(results);

      // Check if there are more pages
      const total = data.paging?.total || data.total || 0;
      const fetched = page * pageSize;

      logger.debug(`Fetched ${allResults.length}/${total} items from ${endpoint}`);

      if (fetched >= total || results.length < pageSize) {
        break;
      }

      page++;
    }

    logger.info(`Retrieved ${allResults.length} items from ${endpoint}`);
    return allResults;
  }

  /**
   * Get project information
   */
  async getProject() {
    logger.info(`Fetching project: ${this.projectKey}`);

    const response = await this.client.get('/api/projects/search', {
      params: {
        projects: this.projectKey
      }
    });

    const projects = response.data.components || [];
    if (projects.length === 0) {
      throw new SonarQubeAPIError(`Project not found: ${this.projectKey}`);
    }

    return projects[0];
  }

  /**
   * Get project branches
   */
  async getBranches() {
    logger.info(`Fetching branches for project: ${this.projectKey}`);

    const response = await this.client.get('/api/project_branches/list', {
      params: {
        project: this.projectKey
      }
    });

    return response.data.branches || [];
  }

  /**
   * Get quality gate for project
   */
  async getQualityGate() {
    logger.info(`Fetching quality gate for project: ${this.projectKey}`);

    try {
      const response = await this.client.get('/api/qualitygates/get_by_project', {
        params: {
          project: this.projectKey
        }
      });

      return response.data.qualityGate || null;
    } catch (error) {
      if (error.statusCode === 404) {
        logger.warn('No quality gate found for project');
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all metrics definitions
   */
  async getMetrics() {
    logger.info('Fetching metrics definitions');

    return await this.getPaginated('/api/metrics/search', {}, 'metrics');
  }

  /**
   * Get issues for project
   * @param {object} filters - Additional filters (branch, createdAfter, etc.)
   */
  async getIssues(filters = {}) {
    logger.info(`Fetching issues for project: ${this.projectKey}`);

    const params = {
      componentKeys: this.projectKey,
      ...filters
    };

    return await this.getPaginated('/api/issues/search', params, 'issues');
  }

  /**
   * Get measures for project components
   * @param {string} branch - Branch name
   * @param {Array<string>} metricKeys - Metric keys to fetch
   */
  async getMeasures(branch = null, metricKeys = []) {
    logger.info(`Fetching measures for project: ${this.projectKey}`);

    const params = {
      component: this.projectKey,
      metricKeys: metricKeys.join(',')
    };

    if (branch) {
      params.branch = branch;
    }

    const response = await this.client.get('/api/measures/component', {
      params
    });

    return response.data.component || {};
  }

  /**
   * Get component tree with measures
   * @param {string} branch - Branch name
   * @param {Array<string>} metricKeys - Metric keys to fetch
   */
  async getComponentTree(branch = null, metricKeys = []) {
    logger.info(`Fetching component tree for project: ${this.projectKey}`);

    const params = {
      component: this.projectKey,
      metricKeys: metricKeys.join(','),
      qualifiers: 'DIR,FIL', // Fetch both directories and files
      strategy: 'all' // Get complete tree including directories
    };

    if (branch) {
      params.branch = branch;
    }

    return await this.getPaginated('/api/measures/component_tree', params, 'components');
  }

  /**
   * Get source code for a file
   * @param {string} fileKey - Component key of the file
   * @param {string} branch - Branch name
   */
  async getSourceCode(fileKey, branch = null) {
    logger.debug(`Fetching source code for: ${fileKey}`);

    const params = {
      key: fileKey
    };

    if (branch) {
      params.branch = branch;
    }

    const response = await this.client.get('/api/sources/raw', {
      params,
      responseType: 'text'
    });

    return response.data;
  }

  /**
   * Get all source files in project
   * @param {string} branch - Branch name
   */
  async getSourceFiles(branch = null) {
    logger.info(`Fetching source files for project: ${this.projectKey}`);

    const params = {
      component: this.projectKey,
      qualifiers: 'FIL' // Only files
    };

    if (branch) {
      params.branch = branch;
    }

    return await this.getPaginated('/api/components/tree', params, 'components');
  }

  /**
   * Get quality profiles for project
   */
  async getQualityProfiles() {
    logger.info(`Fetching quality profiles for project: ${this.projectKey}`);

    const response = await this.client.get('/api/qualityprofiles/search', {
      params: {
        project: this.projectKey
      }
    });

    return response.data.profiles || [];
  }

  /**
   * Get active rules for a quality profile
   * @param {string} profileKey - Quality profile key
   */
  async getActiveRules(profileKey) {
    logger.debug(`Fetching active rules for profile: ${profileKey}`);

    const params = {
      qprofile: profileKey,
      ps: 500 // Page size
    };

    return await this.getPaginated('/api/rules/search', params, 'rules');
  }

  /**
   * Get latest analysis revision (SCM commit hash) for project
   */
  async getLatestAnalysisRevision() {
    logger.info(`Fetching latest analysis revision for project: ${this.projectKey}`);

    try {
      const response = await this.client.get('/api/project_analyses/search', {
        params: {
          project: this.projectKey,
          ps: 1
        }
      });

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

  /**
   * Test connection to SonarQube
   */
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
}
