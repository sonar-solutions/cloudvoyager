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
    this._writeLock = Promise.resolve();
  }

  /**
   * Serialize write operations to prevent concurrent read-modify-write races.
   * Needed when multiple projects or orgs are migrated in parallel.
   */
  async _withLock(fn) {
    let release;
    const acquired = new Promise(resolve => { release = resolve; });
    const prev = this._writeLock;
    this._writeLock = acquired;
    await prev;
    try { return await fn(); } finally { release(); }
  }

  /** Internal ensureOrg without lock (called from within locked methods). */
  _ensureOrgUnsafe(orgKey) {
    if (!this.journal.organizations[orgKey]) {
      this.journal.organizations[orgKey] = {
        status: 'pending',
        orgWideResources: 'pending',
        projects: {},
      };
    }
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
   * Pre-populate the journal with all organizations and their projects so that
   * the resume dialog can show accurate totals even if the run is interrupted
   * before any org migration begins.
   * Only adds entries that don't already exist (safe to call on resume).
   * @param {Array<{org: {key: string}, projects: Array<{key: string}>}>} orgAssignments
   */
  async seedOrganizations(orgAssignments) {
    return this._withLock(async () => {
      for (const { org, projects } of orgAssignments) {
        this._ensureOrgUnsafe(org.key);
        const orgEntry = this.journal.organizations[org.key];
        for (const project of projects) {
          if (!orgEntry.projects[project.key]) {
            orgEntry.projects[project.key] = { status: 'pending' };
          }
        }
      }
      await this.save();
    });
  }

  /**
   * Initialize an organization entry if it doesn't exist.
   * @param {string} orgKey
   */
  async ensureOrg(orgKey) {
    return this._withLock(async () => {
      this._ensureOrgUnsafe(orgKey);
      await this.save();
    });
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
    return this._withLock(async () => {
      this._ensureOrgUnsafe(orgKey);
      this.journal.organizations[orgKey].orgWideResources = 'completed';
      this.journal.organizations[orgKey].status = 'in_progress';
      await this.save();
    });
  }

  /**
   * Mark an organization as fully completed.
   * @param {string} orgKey
   */
  async markOrgCompleted(orgKey) {
    return this._withLock(async () => {
      if (this.journal.organizations[orgKey]) {
        this.journal.organizations[orgKey].status = 'completed';
        this.journal.organizations[orgKey].completedAt = new Date().toISOString();
        await this.save();
      }
    });
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
    const project = this.journal.organizations[orgKey]?.projects?.[projectKey];
    if (!project) return null;
    // New format: return last element of completedSteps array
    if (project.completedSteps && project.completedSteps.length > 0) {
      return project.completedSteps[project.completedSteps.length - 1];
    }
    // Backward compatibility: old format
    return project.lastCompletedStep || null;
  }

  /**
   * Start tracking a project.
   * @param {string} orgKey
   * @param {string} projectKey
   */
  async startProject(orgKey, projectKey) {
    return this._withLock(async () => {
      this._ensureOrgUnsafe(orgKey);
      this.journal.organizations[orgKey].projects[projectKey] = {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        completedSteps: [],
      };
      await this.save();
    });
  }

  /**
   * Record completion of a step within a project.
   * @param {string} orgKey
   * @param {string} projectKey
   * @param {string} stepName
   */
  async completeProjectStep(orgKey, projectKey, stepName) {
    return this._withLock(async () => {
      const project = this.journal.organizations[orgKey]?.projects?.[projectKey];
      if (project) {
        if (!project.completedSteps) project.completedSteps = [];
        if (!project.completedSteps.includes(stepName)) {
          project.completedSteps.push(stepName);
        }
        await this.save();
      }
    });
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
    const project = this.journal.organizations[orgKey]?.projects?.[projectKey];
    if (!project) return false;

    // New format: completedSteps array
    if (project.completedSteps) {
      return project.completedSteps.includes(stepName);
    }

    // Backward compatibility: old lastCompletedStep format
    const lastStep = project.lastCompletedStep;
    if (!lastStep) return false;
    const lastIdx = stepOrder.indexOf(lastStep);
    const currentIdx = stepOrder.indexOf(stepName);
    if (lastIdx === -1 || currentIdx === -1) return false;
    return currentIdx <= lastIdx;
  }

  /**
   * Mark a project as completed.
   * @param {string} orgKey
   * @param {string} projectKey
   */
  async markProjectCompleted(orgKey, projectKey) {
    return this._withLock(async () => {
      if (this.journal.organizations[orgKey]?.projects?.[projectKey]) {
        this.journal.organizations[orgKey].projects[projectKey].status = 'completed';
        this.journal.organizations[orgKey].projects[projectKey].completedAt = new Date().toISOString();
        await this.save();
      }
    });
  }

  /**
   * Mark a project as failed.
   * @param {string} orgKey
   * @param {string} projectKey
   * @param {string} error
   */
  async markProjectFailed(orgKey, projectKey, error) {
    return this._withLock(async () => {
      if (this.journal.organizations[orgKey]?.projects?.[projectKey]) {
        this.journal.organizations[orgKey].projects[projectKey].status = 'failed';
        this.journal.organizations[orgKey].projects[projectKey].error = error;
        this.journal.organizations[orgKey].projects[projectKey].failedAt = new Date().toISOString();
        await this.save();
      }
    });
  }

  // --- Session status ---

  /**
   * Mark the migration as interrupted.
   */
  async markInterrupted() {
    return this._withLock(async () => {
      if (this.journal) {
        this.journal.status = 'interrupted';
        await this.save();
      }
    });
  }

  /**
   * Mark the migration as completed.
   */
  async markCompleted() {
    return this._withLock(async () => {
      this.journal.status = 'completed';
      this.journal.completedAt = new Date().toISOString();
      await this.save();
    });
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
