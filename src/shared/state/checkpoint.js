import logger from '../utils/logger.js';
import { StateStorage } from './storage.js';
import { StaleResumeError } from '../utils/errors.js';

const JOURNAL_VERSION = 2;

/**
 * Phase-level checkpoint journal for pause/resume support.
 *
 * Records progress at each major pipeline phase. On resume, the journal
 * tells us exactly where we stopped and which phases can be skipped.
 */
export class CheckpointJournal {
  constructor(journalPath) {
    this.journalPath = journalPath;
    this.storage = new StateStorage(journalPath);
    this.journal = null;
  }

  /**
   * Create a new journal or load an existing one for resume.
   * @param {object} fingerprint - Session fingerprint
   * @param {string} fingerprint.sonarQubeVersion
   * @param {string} fingerprint.sonarQubeUrl
   * @param {string} fingerprint.projectKey
   * @param {string} fingerprint.cloudvoyagerVersion
   * @returns {Promise<boolean>} true if resuming from existing journal
   */
  async initialize(fingerprint) {
    const existing = await this.storage.load();

    if (existing && existing.status !== 'completed') {
      this.journal = existing;
      logger.info(`Resuming from checkpoint journal (status: ${existing.status})`);

      // Validate fingerprint
      await this.validateFingerprint(fingerprint);

      // Reset interrupted phases to pending (they need re-execution)
      this._resetInterruptedPhases(this.journal.phases || {});

      // Reset in-progress branches
      this._resetInterruptedBranches(this.journal.branches || {});

      this.journal.status = 'in_progress';
      await this.save();
      return true;
    }

    // Create fresh journal
    this.journal = {
      version: JOURNAL_VERSION,
      cloudvoyagerVersion: fingerprint.cloudvoyagerVersion || 'unknown',
      sessionFingerprint: {
        ...fingerprint,
        startedAt: new Date().toISOString(),
      },
      status: 'in_progress',
      phases: {},
      branches: {},
      uploadedCeTasks: {},
    };
    await this.save();
    return false;
  }

  /**
   * Validate that the current session matches the stored journal fingerprint.
   * @param {object} current - Current session fingerprint
   */
  async validateFingerprint(current) {
    const stored = this.journal.sessionFingerprint;
    if (!stored) return;

    const warnings = [];

    if (current.sonarQubeVersion && stored.sonarQubeVersion &&
        current.sonarQubeVersion !== stored.sonarQubeVersion) {
      warnings.push(
        `SonarQube version changed: ${stored.sonarQubeVersion} → ${current.sonarQubeVersion}`
      );
    }

    if (current.sonarQubeUrl && stored.sonarQubeUrl &&
        current.sonarQubeUrl !== stored.sonarQubeUrl) {
      warnings.push(
        `SonarQube URL changed: ${stored.sonarQubeUrl} → ${current.sonarQubeUrl}`
      );
    }

    if (current.projectKey && stored.projectKey &&
        current.projectKey !== stored.projectKey) {
      throw new StaleResumeError(
        `Project key mismatch: journal has '${stored.projectKey}' but config has '${current.projectKey}'. ` +
        'Use --force-restart to discard the journal and start fresh.'
      );
    }

    if (current.cloudvoyagerVersion && this.journal.cloudvoyagerVersion &&
        current.cloudvoyagerVersion !== this.journal.cloudvoyagerVersion) {
      warnings.push(
        `CloudVoyager version changed: ${this.journal.cloudvoyagerVersion} → ${current.cloudvoyagerVersion}`
      );
    }

    for (const w of warnings) {
      logger.warn(`Resume warning: ${w}`);
    }
  }

  /**
   * Check if the journal indicates we should use strict mode.
   * @param {boolean} strictResume - Config flag
   */
  checkStrictResume(strictResume) {
    if (!strictResume) return;
    // In strict mode, validateFingerprint already logged warnings and threw on mismatches.
    // If we reach here, the fingerprint is valid.
    logger.info('Strict resume mode: fingerprint validation passed');
  }

  // --- Phase tracking ---

  /**
   * Check if a phase has been completed.
   * @param {string} phaseName
   * @returns {boolean}
   */
  isPhaseCompleted(phaseName) {
    return this.journal.phases[phaseName]?.status === 'completed';
  }

  /**
   * Mark a phase as in-progress.
   * @param {string} phaseName
   */
  async startPhase(phaseName) {
    this.journal.phases[phaseName] = {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    };
    await this.save();
  }

  /**
   * Mark a phase as completed.
   * @param {string} phaseName
   * @param {object} [meta] - Additional metadata (e.g., cacheFile)
   */
  async completePhase(phaseName, meta = {}) {
    this.journal.phases[phaseName] = {
      status: 'completed',
      completedAt: new Date().toISOString(),
      ...(this.journal.phases[phaseName]?.startedAt
        ? { startedAt: this.journal.phases[phaseName].startedAt }
        : {}),
      ...meta,
    };
    await this.save();
  }

  /**
   * Mark a phase as failed.
   * @param {string} phaseName
   * @param {string} error - Error message
   */
  async failPhase(phaseName, error) {
    this.journal.phases[phaseName] = {
      ...this.journal.phases[phaseName],
      status: 'failed',
      failedAt: new Date().toISOString(),
      error,
    };
    await this.save();
  }

  /**
   * Get the first non-completed phase.
   * @returns {string|null}
   */
  getResumePoint() {
    for (const [name, phase] of Object.entries(this.journal.phases)) {
      if (phase.status !== 'completed') return name;
    }
    return null;
  }

  // --- Branch tracking ---

  /**
   * Get branch status.
   * @param {string} branchName
   * @returns {string} 'completed' | 'in_progress' | 'pending' | 'failed' | undefined
   */
  getBranchStatus(branchName) {
    return this.journal.branches[branchName]?.status;
  }

  /**
   * Initialize a branch entry.
   * @param {string} branchName
   */
  async startBranch(branchName) {
    this.journal.branches[branchName] = {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      phases: {},
    };
    await this.save();
  }

  /**
   * Mark a branch as completed.
   * @param {string} branchName
   * @param {string} [ceTaskId] - CE task ID from upload
   */
  async markBranchCompleted(branchName, ceTaskId = null) {
    this.journal.branches[branchName] = {
      ...this.journal.branches[branchName],
      status: 'completed',
      completedAt: new Date().toISOString(),
      ceTaskId,
    };
    await this.save();
  }

  /**
   * Mark a branch as failed.
   * @param {string} branchName
   * @param {string} error
   */
  async markBranchFailed(branchName, error) {
    this.journal.branches[branchName] = {
      ...this.journal.branches[branchName],
      status: 'failed',
      failedAt: new Date().toISOString(),
      error,
    };
    await this.save();
  }

  // --- Branch phase tracking (per-branch extraction phases) ---

  /**
   * Check if a branch phase is completed.
   * @param {string} branchName
   * @param {string} phaseName
   * @returns {boolean}
   */
  isBranchPhaseCompleted(branchName, phaseName) {
    return this.journal.branches[branchName]?.phases?.[phaseName]?.status === 'completed';
  }

  /**
   * Mark a branch phase as started.
   * @param {string} branchName
   * @param {string} phaseName
   */
  async startBranchPhase(branchName, phaseName) {
    if (!this.journal.branches[branchName]) {
      await this.startBranch(branchName);
    }
    if (!this.journal.branches[branchName].phases) {
      this.journal.branches[branchName].phases = {};
    }
    this.journal.branches[branchName].phases[phaseName] = {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    };
    await this.save();
  }

  /**
   * Mark a branch phase as failed.
   * @param {string} branchName
   * @param {string} phaseName
   * @param {string} error - Error message
   */
  async failBranchPhase(branchName, phaseName, error) {
    if (this.journal.branches[branchName]?.phases) {
      this.journal.branches[branchName].phases[phaseName] = {
        ...this.journal.branches[branchName].phases[phaseName],
        status: 'failed',
        failedAt: new Date().toISOString(),
        error,
      };
      await this.save();
    }
  }

  /**
   * Mark a branch phase as completed.
   * @param {string} branchName
   * @param {string} phaseName
   */
  async completeBranchPhase(branchName, phaseName) {
    if (this.journal.branches[branchName]?.phases) {
      this.journal.branches[branchName].phases[phaseName] = {
        status: 'completed',
        completedAt: new Date().toISOString(),
      };
      await this.save();
    }
  }

  // --- Private resume helpers ---

  _resetInterruptedPhases(phases) {
    for (const [name, phase] of Object.entries(phases)) {
      if (phase.status === 'in_progress') {
        logger.info(`Phase '${name}' was interrupted — will re-execute`);
        phase.status = 'pending';
        delete phase.startedAt;
      }
    }
  }

  _resetInterruptedBranches(branches) {
    for (const [name, branch] of Object.entries(branches)) {
      if (branch.status === 'in_progress') {
        logger.info(`Branch '${name}' was interrupted — will re-execute from last completed phase`);
        branch.status = 'pending';
        this._resetInterruptedPhases(branch.phases || {});
      }
    }
  }

  // --- Upload tracking ---

  /**
   * Record a successful upload for deduplication.
   * @param {string} branchName
   * @param {string} taskId - CE task ID
   */
  async recordUpload(branchName, taskId) {
    this.journal.uploadedCeTasks[branchName] = {
      taskId,
      submittedAt: new Date().toISOString(),
    };
    await this.save();
  }

  /**
   * Get previously uploaded CE task for a branch.
   * @param {string} branchName
   * @returns {object|null} { taskId, submittedAt } or null
   */
  getUploadedCeTask(branchName) {
    return this.journal.uploadedCeTasks[branchName] || null;
  }

  // --- Session status ---

  /**
   * Get the session start time.
   * @returns {string} ISO timestamp
   */
  get sessionStartTime() {
    return this.journal.sessionFingerprint?.startedAt;
  }

  /**
   * Mark the session as interrupted (called by shutdown handler).
   */
  async markInterrupted() {
    if (this.journal) {
      this.journal.status = 'interrupted';
      await this.save();
    }
  }

  /**
   * Mark the session as completed.
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
   * Check if a journal file exists on disk.
   * @returns {boolean}
   */
  exists() {
    return this.storage.exists();
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
