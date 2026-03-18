import logger from '../utils/logger.js';
import { StateStorage } from './storage.js';

const MIGRATION_JOURNAL_VERSION = 1;

/**
 * Migration journal for multi-project migrate-mode progress.
 *
 * Tracks per-organization and per-project completion status so that
 * interrupted migrations can resume without re-processing completed work.
 */
export class MigrationJournal {
  constructor(journalPath) {
    this.journalPath = journalPath;
    this.storage = new StateStorage(journalPath);
    this.journal = null;
  }

  /**
   * Initialize or load an existing migration journal.
   * @param {object} [meta] - Optional metadata to store in the journal
   * @param {string} [meta.sonarqubeUrl] - SonarQube server URL
   * @returns {Promise<boolean>} true if resuming from existing journal
   */
  async initialize(meta = {}) {
    const existing = await this.storage.load();

    if (existing && existing.status !== 'completed') {
      this.journal = existing;
      logger.info(`Resuming migration from journal (status: ${existing.status})`);

      // Reset interrupted items to pending
      this._logInterruptedProjects(this.journal.organizations || {});

      this.journal.status = 'in_progress';
      await this.save();
      return true;
    }

    // Create fresh journal
    this.journal = {
      version: MIGRATION_JOURNAL_VERSION,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      sonarqubeUrl: meta.sonarqubeUrl || null,
      organizations: {},
    };
    await this.save();
    return false;
  }

  // --- Private resume helpers ---

  _logInterruptedProjects(organizations) {
    for (const [orgKey, org] of Object.entries(organizations)) {
      if (org.status !== 'in_progress') continue;
      for (const [projKey, proj] of Object.entries(org.projects || {})) {
        if (proj.status === 'in_progress') {
          logger.info(`Project '${projKey}' in org '${orgKey}' was interrupted — will re-execute from last completed step`);
        }
      }
    }
  }

  // --- Organization tracking ---

  /**
   * Initialize an organization entry if it doesn't exist.
   * @param {string} orgKey
   */
  async ensureOrg(orgKey) {
    if (!this.journal.organizations[orgKey]) {
      this.journal.organizations[orgKey] = {
        status: 'pending',
        orgWideResources: 'pending',
        projects: {},
      };
      await this.save();
    }
  }

  /**
   * Check if org-wide resources (gates, profiles, groups, etc.) are completed.
   * @param {string} orgKey
   * @returns {boolean}
   */
  isOrgWideCompleted(orgKey) {
    return this.journal.organizations[orgKey]?.orgWideResources === 'completed';
  }

  /**
   * Mark org-wide resources as completed.
   * @param {string} orgKey
   */
  async markOrgWideCompleted(orgKey) {
    await this.ensureOrg(orgKey);
    this.journal.organizations[orgKey].orgWideResources = 'completed';
    this.journal.organizations[orgKey].status = 'in_progress';
    await this.save();
  }

  /**
   * Mark an organization as fully completed.
   * @param {string} orgKey
   */
  async markOrgCompleted(orgKey) {
    if (this.journal.organizations[orgKey]) {
      this.journal.organizations[orgKey].status = 'completed';
      this.journal.organizations[orgKey].completedAt = new Date().toISOString();
      await this.save();
    }
  }

  // --- Project tracking ---

  /**
   * Get a project's status within an organization.
   * @param {string} orgKey
   * @param {string} projectKey
   * @returns {string|undefined}
   */
  getProjectStatus(orgKey, projectKey) {
    return this.journal.organizations[orgKey]?.projects?.[projectKey]?.status;
  }

  /**
   * Get the last completed step for an in-progress project.
   * @param {string} orgKey
   * @param {string} projectKey
   * @returns {string|null}
   */
  getProjectLastStep(orgKey, projectKey) {
    return this.journal.organizations[orgKey]?.projects?.[projectKey]?.lastCompletedStep || null;
  }

  /**
   * Start tracking a project.
   * @param {string} orgKey
   * @param {string} projectKey
   */
  async startProject(orgKey, projectKey) {
    await this.ensureOrg(orgKey);
    this.journal.organizations[orgKey].projects[projectKey] = {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      lastCompletedStep: null,
    };
    await this.save();
  }

  /**
   * Record completion of a step within a project.
   * @param {string} orgKey
   * @param {string} projectKey
   * @param {string} stepName
   */
  async completeProjectStep(orgKey, projectKey, stepName) {
    if (this.journal.organizations[orgKey]?.projects?.[projectKey]) {
      this.journal.organizations[orgKey].projects[projectKey].lastCompletedStep = stepName;
      await this.save();
    }
  }

  /**
   * Check if a specific project step has already been completed.
   * @param {string} orgKey
   * @param {string} projectKey
   * @param {string} stepName
   * @param {string[]} stepOrder - Ordered list of step names
   * @returns {boolean}
   */
  isProjectStepCompleted(orgKey, projectKey, stepName, stepOrder) {
    const lastStep = this.getProjectLastStep(orgKey, projectKey);
    if (!lastStep) return false;
    const lastIdx = stepOrder.indexOf(lastStep);
    const currentIdx = stepOrder.indexOf(stepName);
    // Guard: if either step is not in the order array, don't assume completion
    if (lastIdx === -1 || currentIdx === -1) return false;
    return currentIdx <= lastIdx;
  }

  /**
   * Mark a project as completed.
   * @param {string} orgKey
   * @param {string} projectKey
   */
  async markProjectCompleted(orgKey, projectKey) {
    if (this.journal.organizations[orgKey]?.projects?.[projectKey]) {
      this.journal.organizations[orgKey].projects[projectKey].status = 'completed';
      this.journal.organizations[orgKey].projects[projectKey].completedAt = new Date().toISOString();
      await this.save();
    }
  }

  /**
   * Mark a project as failed.
   * @param {string} orgKey
   * @param {string} projectKey
   * @param {string} error
   */
  async markProjectFailed(orgKey, projectKey, error) {
    if (this.journal.organizations[orgKey]?.projects?.[projectKey]) {
      this.journal.organizations[orgKey].projects[projectKey].status = 'failed';
      this.journal.organizations[orgKey].projects[projectKey].error = error;
      this.journal.organizations[orgKey].projects[projectKey].failedAt = new Date().toISOString();
      await this.save();
    }
  }

  // --- Session status ---

  /**
   * Mark the migration as interrupted.
   */
  async markInterrupted() {
    if (this.journal) {
      this.journal.status = 'interrupted';
      await this.save();
    }
  }

  /**
   * Mark the migration as completed.
   */
  async markCompleted() {
    this.journal.status = 'completed';
    this.journal.completedAt = new Date().toISOString();
    await this.save();
  }

  /**
   * Persist journal to disk.
   */
  async save() {
    await this.storage.save(this.journal);
  }

  /**
   * Check if a journal file exists.
   * @returns {boolean}
   */
  exists() {
    return this.storage.exists();
  }

  /**
   * Load and return the raw journal data without initializing.
   * Useful for inspecting journal metadata before deciding to resume.
   * @returns {Promise<object|null>}
   */
  async peek() {
    return this.storage.load();
  }

  /**
   * Clear the journal file.
   */
  async clear() {
    await this.storage.clear();
    this.journal = null;
  }

  /**
   * Get the full journal data (for status display).
   * @returns {object}
   */
  getData() {
    return this.journal;
  }
}
