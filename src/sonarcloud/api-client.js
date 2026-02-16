import axios from 'axios';
import { SonarCloudAPIError, AuthenticationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * SonarCloud API Client
 */
export class SonarCloudClient {
  constructor(config) {
    this.baseURL = config.url.replace(/\/$/, ''); // Remove trailing slash
    this.token = config.token;
    this.organization = config.organization;
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
      timeout: 60000 // 60 second timeout for uploads
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
          `Authentication failed for SonarCloud: ${data.errors?.[0]?.msg || 'Invalid credentials'}`,
          'SonarCloud'
        );
      }

      const message = data.errors?.[0]?.msg || data.message || error.message;
      throw new SonarCloudAPIError(
        `SonarCloud API error (${status}): ${message}`,
        status,
        endpoint
      );
    } else if (error.request) {
      // More descriptive error for connection failures
      const baseURL = this.baseURL || error.config?.baseURL || 'unknown';
      const errorCode = error.code || 'UNKNOWN';
      let message = `Cannot connect to SonarCloud server at ${baseURL}`;

      if (errorCode === 'ECONNREFUSED') {
        message += ' - Connection refused. Is the server running?';
      } else if (errorCode === 'ETIMEDOUT') {
        message += ' - Connection timed out';
      } else if (errorCode === 'ENOTFOUND') {
        message += ' - Server not found. Check the URL';
      } else {
        message += ` - ${error.message} (${errorCode})`;
      }

      throw new SonarCloudAPIError(message, 0, error.config?.url);
    } else {
      throw new SonarCloudAPIError(`Request failed: ${error.message}`);
    }
  }

  /**
   * Test connection to SonarCloud
   */
  async testConnection() {
    try {
      logger.info('Testing connection to SonarCloud...');

      // Verify organization exists
      const response = await this.client.get('/api/organizations/search', {
        params: {
          organizations: this.organization
        }
      });

      const orgs = response.data.organizations || [];
      if (orgs.length === 0) {
        throw new SonarCloudAPIError(`Organization not found: ${this.organization}`);
      }

      logger.info('Successfully connected to SonarCloud');
      return true;
    } catch (error) {
      logger.error(`Failed to connect to SonarCloud: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if project exists
   */
  async projectExists() {
    try {
      const response = await this.client.get('/api/projects/search', {
        params: {
          projects: this.projectKey,
          organization: this.organization
        }
      });

      const projects = response.data.components || [];
      return projects.length > 0;
    } catch (error) {
      logger.error(`Failed to check project existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Create project if it doesn't exist
   */
  async ensureProject() {
    logger.info(`Ensuring project exists: ${this.projectKey}`);

    const exists = await this.projectExists();

    if (exists) {
      logger.info('Project already exists');
    } else {
      logger.info('Project does not exist, creating...');

      await this.client.post('/api/projects/create', null, {
        params: {
          project: this.projectKey,
          name: this.projectKey,
          organization: this.organization
        }
      });

      logger.info('Project created successfully');
    }
  }

  /**
   * Get quality profiles for the project from SonarCloud
   * @returns {Promise<Array>} Quality profiles
   */
  async getQualityProfiles() {
    logger.info('Fetching quality profiles from SonarCloud...');

    try {
      const response = await this.client.get('/api/qualityprofiles/search', {
        params: {
          project: this.projectKey,
          organization: this.organization
        }
      });

      const profiles = response.data.profiles || [];
      logger.info(`Found ${profiles.length} quality profiles in SonarCloud`);
      return profiles;
    } catch (error) {
      logger.warn(`Failed to fetch quality profiles: ${error.message}`);
      return [];
    }
  }

  /**
   * Get the main branch name for the project from SonarCloud
   * @returns {Promise<string>} Main branch name (e.g. 'master', 'main')
   */
  async getMainBranchName() {
    try {
      logger.info('Fetching main branch name from SonarCloud...');
      const response = await this.client.get('/api/project_branches/list', {
        params: { project: this.projectKey }
      });

      const branches = response.data.branches || [];
      const mainBranch = branches.find(b => b.isMain);
      const branchName = mainBranch?.name || 'master';
      logger.info(`SonarCloud main branch: ${branchName}`);
      return branchName;
    } catch (error) {
      logger.warn(`Failed to fetch branch name from SonarCloud: ${error.message}, defaulting to 'master'`);
      return 'master';
    }
  }

  /**
   * Get analysis status
   */
  async getAnalysisStatus(ceTaskId) {
    try {
      const response = await this.client.get('/api/ce/task', {
        params: {
          id: ceTaskId
        }
      });

      return response.data.task;
    } catch (error) {
      logger.error(`Failed to get analysis status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wait for analysis to complete
   */
  async waitForAnalysis(ceTaskId, maxWaitSeconds = 300) {
    logger.info(`Waiting for analysis to complete (task: ${ceTaskId})...`);

    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const task = await this.getAnalysisStatus(ceTaskId);

      logger.debug(`Analysis status: ${task.status}`);

      if (task.status === 'SUCCESS') {
        logger.info('Analysis completed successfully');
        return task;
      } else if (task.status === 'FAILED' || task.status === 'CANCELED') {
        throw new SonarCloudAPIError(`Analysis ${task.status.toLowerCase()}: ${task.errorMessage || 'Unknown error'}`);
      }

      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > maxWaitMs) {
        throw new SonarCloudAPIError(`Analysis timeout after ${maxWaitSeconds} seconds`);
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
