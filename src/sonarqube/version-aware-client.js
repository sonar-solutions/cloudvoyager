/**
 * Version-aware SonarQube client that adapts API calls based on the
 * detected server version.  Extends the base SonarQubeClient without
 * modifying it — all backward-compatibility logic lives here.
 *
 * Supports: SonarQube 9.9 LTS, 10.x, and 2025.1+
 */

import { SonarQubeClient } from './api-client.js';
import { parseSonarQubeVersion, isAtLeast } from '../utils/version.js';
import logger from '../utils/logger.js';

// Pre-10.4 lifecycle + 10.4+ lifecycle combined.
// SonarQube ignores unknown status values, so this is safe for 9.9 and ≤10.3.
const LEGACY_STATUSES = 'OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED,FALSE_POSITIVE,ACCEPTED,FIXED';

// 10.4+ uses the `issueStatuses` parameter with a reduced set
// (REOPENED, RESOLVED, CLOSED no longer exist in the new lifecycle).
const MODERN_ISSUE_STATUSES = 'OPEN,CONFIRMED,FALSE_POSITIVE,ACCEPTED,FIXED';

export class VersionAwareSonarQubeClient extends SonarQubeClient {
  constructor(config) {
    super(config);
    this._parsedVersion = null;
  }

  /**
   * Detect, parse, and cache the SonarQube server version.
   * Safe to call multiple times — returns the cached result after the first call.
   * @returns {Promise<{ major: number, minor: number, patch: number, raw: string }>}
   */
  async detectVersion() {
    if (this._parsedVersion) return this._parsedVersion;
    const versionStr = await this.getServerVersion();
    this._parsedVersion = parseSonarQubeVersion(versionStr);
    logger.info(`SonarQube server version: ${this._parsedVersion.raw} (${this._compatModeLabel()})`);
    return this._parsedVersion;
  }

  get parsedVersion() {
    return this._parsedVersion;
  }

  // ── Overrides: version-aware issue fetching ──────────────────────

  /**
   * Fetch issues using the correct status parameter for the detected version.
   * - SQ < 10.4  → uses `statuses` (legacy)
   * - SQ ≥ 10.4  → uses `issueStatuses` (modern, avoids deprecation warnings)
   * Falls back to legacy when version has not been detected yet.
   */
  async getIssues(filters = {}) {
    const params = { componentKeys: this.projectKey, ...this._buildStatusParams(), ...filters };
    logger.info(`Fetching issues for project: ${this.projectKey}`);
    return await this.getPaginated('/api/issues/search', params, 'issues');
  }

  async getIssuesWithComments(filters = {}) {
    const params = {
      componentKeys: this.projectKey,
      additionalFields: 'comments',
      ...this._buildStatusParams(),
      ...filters
    };
    logger.info(`Fetching issues with comments for project: ${this.projectKey}`);
    return await this.getPaginated('/api/issues/search', params, 'issues');
  }

  // ── Overrides: defensive wrappers ────────────────────────────────

  /**
   * Fetch user groups with a try/catch guard.
   * The /api/user_groups/search endpoint is being migrated to Web API V2
   * and may be removed in future SonarQube versions.
   */
  async getGroups() {
    try {
      return await super.getGroups();
    } catch (error) {
      logger.warn(`Failed to fetch user groups (endpoint may be unavailable in this SQ version): ${error.message}`);
      return [];
    }
  }

  /**
   * Test connection and also detect + log the server version.
   */
  async testConnection() {
    const result = await super.testConnection();
    await this.detectVersion();
    return result;
  }

  // ── Internal helpers ─────────────────────────────────────────────

  _buildStatusParams() {
    if (this._parsedVersion && isAtLeast(this._parsedVersion, 10, 4)) {
      return { issueStatuses: MODERN_ISSUE_STATUSES };
    }
    return { statuses: LEGACY_STATUSES };
  }

  _compatModeLabel() {
    const v = this._parsedVersion;
    if (!v || v.major === 0) return 'unknown version';
    if (v.major < 10) return 'legacy 9.x — pre-Clean Code taxonomy';
    if (!isAtLeast(v, 10, 4)) return '10.0-10.3 — Clean Code taxonomy, legacy issue statuses';
    return 'modern 10.4+ issue statuses';
  }
}
