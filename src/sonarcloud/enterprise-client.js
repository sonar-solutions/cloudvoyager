import axios from 'axios';
import { SonarCloudAPIError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Client for the SonarCloud V2 Enterprise API (portfolios, enterprises).
 * Uses Bearer auth and a different base URL than the V1 org-level API.
 *
 * V2 base URL: https://api.{domain}/enterprises/
 * (e.g., https://api.sonarcloud.io/enterprises/ or https://api.sc-staging.io/enterprises/)
 */
export class EnterpriseClient {
  constructor({ url, token, rateLimit = {} }) {
    // Derive V2 base URL from the org URL: https://sc-staging.io -> https://api.sc-staging.io/enterprises
    const parsed = new URL(url);
    this.baseURL = `${parsed.protocol}//api.${parsed.host}/enterprises`;
    this.token = token;

    const maxRetries = rateLimit.maxRetries ?? 3;
    const baseDelay = rateLimit.baseDelay ?? 1000;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 60000
    });

    this.client.interceptors.response.use(
      response => response,
      async (error) => {
        const status = error.response?.status;
        const cfg = error.config;
        if ((status === 503 || status === 429) && cfg) {
          cfg._retryCount = (cfg._retryCount || 0) + 1;
          if (cfg._retryCount <= maxRetries) {
            const delay = baseDelay * Math.pow(2, cfg._retryCount - 1);
            logger.warn(`Enterprise API rate limited (${status}), retry ${cfg._retryCount}/${maxRetries} in ${(delay / 1000).toFixed(1)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.client(cfg);
          }
        }
        return this._handleError(error);
      }
    );
  }

  _handleError(error) {
    if (error.response) {
      const { status, data, config } = error.response;
      const message = data?.message || data?.errors?.[0]?.msg || error.message;
      throw new SonarCloudAPIError(`Enterprise API error (${status}): ${message}`, status, config.url);
    } else if (error.request) {
      throw new SonarCloudAPIError(`Cannot connect to Enterprise API at ${this.baseURL}: ${error.message}`, 0, error.config?.url);
    }
    throw new SonarCloudAPIError(`Enterprise API request failed: ${error.message}`);
  }

  async resolveEnterpriseId(enterpriseKey) {
    logger.debug(`Resolving enterprise key: ${enterpriseKey}`);
    const response = await this.client.get('/enterprises', { params: { enterpriseKey } });
    const enterprises = response.data;
    if (!Array.isArray(enterprises) || enterprises.length === 0) {
      throw new SonarCloudAPIError(`Enterprise not found: ${enterpriseKey}`);
    }
    const id = enterprises[0].id;
    logger.info(`Resolved enterprise "${enterpriseKey}" -> ${id}`);
    return id;
  }

  async listPortfolios(enterpriseId, pageSize = 50) {
    const portfolios = [];
    let pageIndex = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await this.client.get('/portfolios', {
        params: { enterpriseId, pageSize, pageIndex }
      });
      const page = response.data;
      portfolios.push(...(page.portfolios || []));
      if (portfolios.length >= (page.page?.total || 0)) break;
      pageIndex++;
    }
    return portfolios;
  }

  async createPortfolio({ name, enterpriseId, description = '', selection = 'projects', projects = [], tags = [], organizationIds = [] }) {
    logger.info(`Creating enterprise portfolio: ${name}`);
    const response = await this.client.post('/portfolios', {
      name, enterpriseId, description, selection, projects, tags, organizationIds
    });
    return response.data;
  }

  async updatePortfolio(portfolioId, { name, description = '', selection = 'projects', projects = [], tags = [], organizationIds = [] }) {
    logger.info(`Updating enterprise portfolio: ${name} (${portfolioId})`);
    const response = await this.client.patch(`/portfolios/${portfolioId}`, {
      name, description, selection, projects, tags, organizationIds
    });
    return response.data;
  }

  async deletePortfolio(portfolioId) {
    logger.debug(`Deleting portfolio: ${portfolioId}`);
    await this.client.delete(`/portfolios/${portfolioId}`);
  }

  async getSelectableOrganizations(portfolioId, pageSize = 50) {
    const orgs = [];
    let pageIndex = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await this.client.get('/portfolio-organizations', {
        params: { portfolioId, pageSize, pageIndex }
      });
      const page = response.data;
      orgs.push(...(page.organizations || []));
      if (orgs.length >= (page.page?.total || 0)) break;
      pageIndex++;
    }
    return orgs;
  }

  async getSelectableProjects(portfolioId, organizationId, pageSize = 50) {
    const projects = [];
    let pageIndex = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await this.client.get('/portfolio-projects', {
        params: { portfolioId, organizationId, pageSize, pageIndex }
      });
      const page = response.data;
      projects.push(...(page.projects || []));
      if (projects.length >= (page.page?.total || 0)) break;
      pageIndex++;
    }
    return projects;
  }
}
