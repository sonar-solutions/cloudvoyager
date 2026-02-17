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

    // Retry configuration
    this._maxRetries = 5;
    this._baseDelay = 1000; // 1 second, doubles each retry: 1s, 2s, 4s, 8s, 16s

    // Throttle configuration for write requests
    this._minRequestInterval = 150; // ms between POST requests
    this._lastPostTime = 0;

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

    // Add request interceptor to throttle POST requests
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

    // Add response interceptor with retry on rate limit
    this.client.interceptors.response.use(
      response => response,
      async (error) => {
        const status = error.response?.status;
        const config = error.config;

        // Retry on 503 (rate limit) or 429 (too many requests)
        if ((status === 503 || status === 429) && config) {
          config._retryCount = (config._retryCount || 0) + 1;

          if (config._retryCount <= this._maxRetries) {
            const delay = this._baseDelay * Math.pow(2, config._retryCount - 1);
            logger.warn(`Rate limited (${status}), retry ${config._retryCount}/${this._maxRetries} in ${(delay / 1000).toFixed(1)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.client(config);
          }

          logger.error(`Rate limited (${status}), exhausted all ${this._maxRetries} retries`);
        }

        return this.handleError(error);
      }
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

  // ==========================================
  // Quality Gate Management
  // ==========================================

  /**
   * Create a quality gate
   * @param {string} name - Gate name
   * @returns {Promise<object>} Created gate
   */
  async createQualityGate(name) {
    logger.info(`Creating quality gate: ${name}`);

    const response = await this.client.post('/api/qualitygates/create', null, {
      params: { name, organization: this.organization }
    });

    return response.data;
  }

  /**
   * Create a condition on a quality gate
   * @param {string} gateId - Quality gate ID
   * @param {string} metric - Metric key
   * @param {string} op - Operator (LT or GT)
   * @param {string} error - Error threshold value
   */
  async createQualityGateCondition(gateId, metric, op, error) {
    logger.debug(`Creating gate condition: ${metric} ${op} ${error}`);

    const response = await this.client.post('/api/qualitygates/create_condition', null, {
      params: { gateId, metric, op, error, organization: this.organization }
    });

    return response.data;
  }

  /**
   * Set a quality gate as default
   * @param {string} id - Quality gate ID
   */
  async setDefaultQualityGate(id) {
    logger.info(`Setting default quality gate: ${id}`);

    await this.client.post('/api/qualitygates/set_as_default', null, {
      params: { id, organization: this.organization }
    });
  }

  /**
   * Assign a quality gate to a project
   * @param {string} gateId - Quality gate ID
   * @param {string} projectKey - Project key
   */
  async assignQualityGateToProject(gateId, projectKey) {
    logger.debug(`Assigning gate ${gateId} to project ${projectKey}`);

    await this.client.post('/api/qualitygates/select', null, {
      params: { gateId, projectKey, organization: this.organization }
    });
  }

  // ==========================================
  // Quality Profile Management
  // ==========================================

  /**
   * Restore a quality profile from backup XML
   * @param {string} backupXml - Profile backup XML content
   * @returns {Promise<object>} Restored profile info
   */
  async restoreQualityProfile(backupXml) {
    logger.info('Restoring quality profile from backup...');

    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('backup', Buffer.from(backupXml, 'utf-8'), {
      filename: 'profile-backup.xml',
      contentType: 'application/xml'
    });
    form.append('organization', this.organization);

    const response = await this.client.post('/api/qualityprofiles/restore', form, {
      headers: form.getHeaders()
    });

    return response.data;
  }

  /**
   * Set a quality profile as default for a language
   * @param {string} language - Language key
   * @param {string} qualityProfile - Profile name
   */
  async setDefaultQualityProfile(language, qualityProfile) {
    logger.info(`Setting default profile for ${language}: ${qualityProfile}`);

    await this.client.post('/api/qualityprofiles/set_default', null, {
      params: { language, qualityProfile, organization: this.organization }
    });
  }

  /**
   * Add group permission to a quality profile
   * @param {string} qualityProfile - Profile name
   * @param {string} language - Language key
   * @param {string} group - Group name
   */
  async addQualityProfileGroupPermission(qualityProfile, language, group) {
    logger.debug(`Adding group ${group} permission to profile ${qualityProfile}`);

    await this.client.post('/api/qualityprofiles/add_group', null, {
      params: { qualityProfile, language, group, organization: this.organization }
    });
  }

  /**
   * Add user permission to a quality profile
   * @param {string} qualityProfile - Profile name
   * @param {string} language - Language key
   * @param {string} login - User login
   */
  async addQualityProfileUserPermission(qualityProfile, language, login) {
    logger.debug(`Adding user ${login} permission to profile ${qualityProfile}`);

    await this.client.post('/api/qualityprofiles/add_user', null, {
      params: { qualityProfile, language, login, organization: this.organization }
    });
  }

  // ==========================================
  // Group Management
  // ==========================================

  /**
   * Create a user group
   * @param {string} name - Group name
   * @param {string} description - Group description
   * @returns {Promise<object>} Created group
   */
  async createGroup(name, description = '') {
    logger.info(`Creating group: ${name}`);

    const response = await this.client.post('/api/user_groups/create', null, {
      params: { name, description, organization: this.organization }
    });

    return response.data.group;
  }

  // ==========================================
  // Permission Management
  // ==========================================

  /**
   * Add organization-level permission to a group
   * @param {string} groupName - Group name
   * @param {string} permission - Permission key (admin, scan, etc.)
   */
  async addGroupPermission(groupName, permission) {
    logger.debug(`Adding ${permission} permission to group ${groupName}`);

    await this.client.post('/api/permissions/add_group', null, {
      params: { groupName, permission, organization: this.organization }
    });
  }

  /**
   * Add project-level permission to a group
   * @param {string} groupName - Group name
   * @param {string} projectKey - Project key
   * @param {string} permission - Permission key
   */
  async addProjectGroupPermission(groupName, projectKey, permission) {
    logger.debug(`Adding ${permission} to group ${groupName} on project ${projectKey}`);

    await this.client.post('/api/permissions/add_group', null, {
      params: { groupName, projectKey, permission, organization: this.organization }
    });
  }

  /**
   * Create a permission template
   * @param {string} name - Template name
   * @param {string} description - Template description
   * @param {string} projectKeyPattern - Project key pattern
   * @returns {Promise<object>} Created template
   */
  async createPermissionTemplate(name, description = '', projectKeyPattern = '') {
    logger.info(`Creating permission template: ${name}`);

    const params = { name, description, organization: this.organization };
    if (projectKeyPattern) {
      params.projectKeyPattern = projectKeyPattern;
    }

    const response = await this.client.post('/api/permissions/create_template', null, { params });
    return response.data.permissionTemplate;
  }

  /**
   * Add a group to a permission template
   * @param {string} templateId - Template ID
   * @param {string} groupName - Group name
   * @param {string} permission - Permission key
   */
  async addGroupToTemplate(templateId, groupName, permission) {
    logger.debug(`Adding group ${groupName} with ${permission} to template ${templateId}`);

    await this.client.post('/api/permissions/add_group_to_template', null, {
      params: { templateId, groupName, permission, organization: this.organization }
    });
  }

  /**
   * Set a permission template as default
   * @param {string} templateId - Template ID
   * @param {string} qualifier - Qualifier (TRK for projects)
   */
  async setDefaultTemplate(templateId, qualifier = 'TRK') {
    logger.info(`Setting default permission template: ${templateId}`);

    await this.client.post('/api/permissions/set_default_template', null, {
      params: { templateId, qualifier, organization: this.organization }
    });
  }

  // ==========================================
  // Issue Management
  // ==========================================

  /**
   * Transition an issue to a new status
   * @param {string} issue - Issue key
   * @param {string} transition - Transition name (confirm, resolve, reopen, wontfix, falsepositive, accept)
   */
  async transitionIssue(issue, transition) {
    logger.debug(`Transitioning issue ${issue}: ${transition}`);

    await this.client.post('/api/issues/do_transition', null, {
      params: { issue, transition }
    });
  }

  /**
   * Assign an issue to a user
   * @param {string} issue - Issue key
   * @param {string} assignee - User login (empty string to unassign)
   */
  async assignIssue(issue, assignee) {
    logger.debug(`Assigning issue ${issue} to ${assignee || '(unassign)'}`);

    await this.client.post('/api/issues/assign', null, {
      params: { issue, assignee }
    });
  }

  /**
   * Add a comment to an issue
   * @param {string} issue - Issue key
   * @param {string} text - Comment text
   */
  async addIssueComment(issue, text) {
    logger.debug(`Adding comment to issue ${issue}`);

    await this.client.post('/api/issues/add_comment', null, {
      params: { issue, text }
    });
  }

  /**
   * Set tags on an issue
   * @param {string} issue - Issue key
   * @param {Array<string>} tags - Tags to set
   */
  async setIssueTags(issue, tags) {
    logger.debug(`Setting tags on issue ${issue}: ${tags.join(', ')}`);

    await this.client.post('/api/issues/set_tags', null, {
      params: { issue, tags: tags.join(',') }
    });
  }

  /**
   * Search issues in SonarCloud project
   * @param {string} projectKey - Project key
   * @param {object} filters - Additional filters
   * @returns {Promise<Array>} Issues
   */
  async searchIssues(projectKey, filters = {}) {
    logger.debug(`Searching issues in project: ${projectKey}`);

    let allResults = [];
    let page = 1;
    const pageSize = 500;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await this.client.get('/api/issues/search', {
        params: {
          componentKeys: projectKey,
          organization: this.organization,
          ps: pageSize,
          p: page,
          ...filters
        }
      });

      const issues = response.data.issues || [];
      allResults = allResults.concat(issues);

      const total = response.data.paging?.total || 0;
      if (page * pageSize >= total || issues.length < pageSize) break;
      page++;
    }

    return allResults;
  }

  // ==========================================
  // Hotspot Management
  // ==========================================

  /**
   * Change hotspot status
   * @param {string} hotspot - Hotspot key
   * @param {string} status - New status (SAFE, ACKNOWLEDGED, FIXED)
   * @param {string} [resolution] - Resolution (SAFE, ACKNOWLEDGED, FIXED)
   */
  async changeHotspotStatus(hotspot, status, resolution = null) {
    logger.debug(`Changing hotspot ${hotspot} status to ${status}`);

    const params = { hotspot, status };
    if (resolution) {
      params.resolution = resolution;
    }

    await this.client.post('/api/hotspots/change_status', null, { params });
  }

  /**
   * Search hotspots in SonarCloud project
   * @param {string} projectKey - Project key
   * @param {object} filters - Additional filters
   * @returns {Promise<Array>} Hotspots
   */
  async searchHotspots(projectKey, filters = {}) {
    logger.debug(`Searching hotspots in project: ${projectKey}`);

    let allResults = [];
    let page = 1;
    const pageSize = 500;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await this.client.get('/api/hotspots/search', {
        params: {
          projectKey,
          ps: pageSize,
          p: page,
          ...filters
        }
      });

      const hotspots = response.data.hotspots || [];
      allResults = allResults.concat(hotspots);

      const total = response.data.paging?.total || 0;
      if (page * pageSize >= total || hotspots.length < pageSize) break;
      page++;
    }

    return allResults;
  }

  /**
   * Add a comment to a hotspot
   * @param {string} hotspot - Hotspot key
   * @param {string} text - Comment text
   */
  async addHotspotComment(hotspot, text) {
    logger.debug(`Adding comment to hotspot ${hotspot}`);

    await this.client.post('/api/hotspots/add_comment', null, {
      params: { hotspot, text }
    });
  }

  // ==========================================
  // Project Configuration
  // ==========================================

  /**
   * Set a project setting
   * @param {string} key - Setting key
   * @param {string} value - Setting value
   * @param {string} [component] - Project key (defaults to this.projectKey)
   */
  async setProjectSetting(key, value, component = null) {
    logger.debug(`Setting ${key} on project ${component || this.projectKey}`);

    await this.client.post('/api/settings/set', null, {
      params: { key, value, component: component || this.projectKey }
    });
  }

  /**
   * Set project tags
   * @param {string} projectKey - Project key
   * @param {Array<string>} tags - Tags to set
   */
  async setProjectTags(projectKey, tags) {
    logger.debug(`Setting tags on project ${projectKey}: ${tags.join(', ')}`);

    await this.client.post('/api/project_tags/set', null, {
      params: { project: projectKey, tags: tags.join(',') }
    });
  }

  /**
   * Create a project link
   * @param {string} projectKey - Project key
   * @param {string} name - Link name
   * @param {string} url - Link URL
   */
  async createProjectLink(projectKey, name, url) {
    logger.debug(`Creating project link: ${name} -> ${url}`);

    const response = await this.client.post('/api/project_links/create', null, {
      params: { projectKey, name, url }
    });

    return response.data.link;
  }

  /**
   * Set new code period definition
   * @param {string} projectKey - Project key
   * @param {string} type - Type (days, previous_version, reference_branch, specific_analysis)
   * @param {string} [value] - Value (number of days, branch name, etc.)
   * @param {string} [branch] - Branch name (for branch-level definitions)
   */
  async setNewCodePeriod(projectKey, type, value = null, branch = null) {
    logger.debug(`Setting new code period for ${projectKey}: ${type}${value ? `=${value}` : ''}`);

    const params = { project: projectKey, type };
    if (value) params.value = value;
    if (branch) params.branch = branch;

    await this.client.post('/api/new_code_periods/set', null, { params });
  }

  /**
   * Set project DevOps binding (GitHub)
   * @param {string} projectKey - Project key
   * @param {string} almSetting - ALM setting key
   * @param {string} repository - Repository identifier
   * @param {boolean} monorepo - Whether this is a monorepo
   */
  async setGithubBinding(projectKey, almSetting, repository, monorepo = false) {
    logger.debug(`Setting GitHub binding for ${projectKey}: ${repository}`);

    await this.client.post('/api/alm_settings/set_github_binding', null, {
      params: { project: projectKey, almSetting, repository, monorepo }
    });
  }

  /**
   * Set project DevOps binding (GitLab)
   * @param {string} projectKey - Project key
   * @param {string} almSetting - ALM setting key
   * @param {string} repository - Repository ID
   */
  async setGitlabBinding(projectKey, almSetting, repository) {
    logger.debug(`Setting GitLab binding for ${projectKey}: ${repository}`);

    await this.client.post('/api/alm_settings/set_gitlab_binding', null, {
      params: { project: projectKey, almSetting, repository }
    });
  }

  /**
   * Set project DevOps binding (Azure DevOps)
   * @param {string} projectKey - Project key
   * @param {string} almSetting - ALM setting key
   * @param {string} projectName - Azure DevOps project name
   * @param {string} repositoryName - Repository name
   */
  async setAzureBinding(projectKey, almSetting, projectName, repositoryName) {
    logger.debug(`Setting Azure DevOps binding for ${projectKey}: ${projectName}/${repositoryName}`);

    await this.client.post('/api/alm_settings/set_azure_binding', null, {
      params: { project: projectKey, almSetting, projectName, repositoryName }
    });
  }

  /**
   * Set project DevOps binding (Bitbucket)
   * @param {string} projectKey - Project key
   * @param {string} almSetting - ALM setting key
   * @param {string} repository - Repository slug
   * @param {string} slug - Project slug
   */
  async setBitbucketBinding(projectKey, almSetting, repository, slug) {
    logger.debug(`Setting Bitbucket binding for ${projectKey}: ${slug}/${repository}`);

    await this.client.post('/api/alm_settings/set_bitbucket_binding', null, {
      params: { project: projectKey, almSetting, repository, slug }
    });
  }

  // ==========================================
  // Portfolio Management
  // ==========================================

  /**
   * Create a portfolio
   * @param {string} name - Portfolio name
   * @param {string} description - Portfolio description
   * @param {string} visibility - Visibility (public or private)
   * @param {string} key - Portfolio key
   * @returns {Promise<object>} Created portfolio
   */
  async createPortfolio(name, description = '', visibility = 'public', key = null) {
    logger.info(`Creating portfolio: ${name}`);

    const params = { name, description, visibility, organization: this.organization };
    if (key) params.key = key;

    const response = await this.client.post('/api/views/create', null, { params });
    return response.data;
  }

  /**
   * Add a project to a portfolio
   * @param {string} portfolioKey - Portfolio key
   * @param {string} projectKey - Project key
   */
  async addProjectToPortfolio(portfolioKey, projectKey) {
    logger.debug(`Adding project ${projectKey} to portfolio ${portfolioKey}`);

    await this.client.post('/api/views/add_project', null, {
      params: { key: portfolioKey, project: projectKey }
    });
  }
}
