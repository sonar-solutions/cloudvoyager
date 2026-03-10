import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import logger from './logger.js';
import { StateStorage } from '../state/storage.js';

/**
 * Progress display for checkpoint journal and migration journal.
 *
 * Reads journal files from disk and renders a human-readable status table.
 */
export class ProgressTracker {
  /**
   * @param {string} stateFilePath - Path to the state file (used to derive journal paths)
   */
  constructor(stateFilePath) {
    this.stateDir = dirname(stateFilePath);
    this.journalPath = `${stateFilePath}.journal`;
  }

  /**
   * Display checkpoint journal status for the transfer command.
   */
  async displayStatus() {
    if (!existsSync(this.journalPath)) {
      logger.info('No checkpoint journal found. No transfer in progress.');
      return;
    }

    const storage = new StateStorage(this.journalPath);
    const journal = await storage.load();
    if (!journal) {
      logger.info('Checkpoint journal is empty or corrupt.');
      return;
    }

    logger.info('=== Transfer Checkpoint Status ===');
    logger.info(`Status: ${journal.status || 'unknown'}`);

    if (journal.sessionFingerprint) {
      const fp = journal.sessionFingerprint;
      logger.info(`Project: ${fp.projectKey || 'unknown'}`);
      logger.info(`SonarQube: ${fp.sonarQubeUrl || 'unknown'} (v${fp.sonarQubeVersion || '?'})`);
      logger.info(`Started: ${fp.startedAt || 'unknown'}`);
    }

    // Phase progress
    if (journal.phases) {
      const phases = Object.entries(journal.phases);
      const completed = phases.filter(([, p]) => p.status === 'completed').length;
      const total = phases.length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

      logger.info('');
      logger.info(`Phases: ${completed}/${total} completed (${pct}%)`);
      logger.info('');

      for (const [name, phase] of phases) {
        const icon = phase.status === 'completed' ? '[done]'
          : phase.status === 'in_progress' ? '[>>  ]'
            : phase.status === 'failed' ? '[FAIL]'
              : '[    ]';
        logger.info(`  ${icon} ${name}`);
      }
    }

    // Branch progress
    if (journal.branches && Object.keys(journal.branches).length > 0) {
      const branches = Object.entries(journal.branches);
      const completedBranches = branches.filter(([, b]) => b.status === 'completed').length;

      logger.info('');
      logger.info(`Branches: ${completedBranches}/${branches.length} completed`);
      logger.info('');

      for (const [name, branch] of branches) {
        const icon = branch.status === 'completed' ? '[done]'
          : branch.status === 'in_progress' ? '[>>  ]'
            : branch.status === 'failed' ? '[FAIL]'
              : '[    ]';
        const detail = branch.currentPhase ? ` (at: ${branch.currentPhase})` : '';
        logger.info(`  ${icon} ${name}${detail}`);
      }
    }

    // Upload dedup info
    if (journal.uploadedCeTasks && Object.keys(journal.uploadedCeTasks).length > 0) {
      logger.info('');
      logger.info('Uploaded CE tasks:');
      for (const [branch, task] of Object.entries(journal.uploadedCeTasks)) {
        logger.info(`  ${branch}: ${task.taskId} (${task.status})`);
      }
    }

    // Estimated time remaining
    const estimate = this.getEstimatedTimeRemaining(journal);
    if (estimate) {
      logger.info('');
      logger.info(`Estimated time remaining: ${estimate}`);
    }
  }

  /**
   * Display migration journal status (multi-org migration).
   * @param {string} migrationJournalPath - Path to migration.journal file
   */
  async displayMigrationStatus(migrationJournalPath) {
    if (!existsSync(migrationJournalPath)) {
      logger.info('No migration journal found.');
      return;
    }

    const storage = new StateStorage(migrationJournalPath);
    const journal = await storage.load();
    if (!journal) {
      logger.info('Migration journal is empty or corrupt.');
      return;
    }

    logger.info('=== Migration Journal Status ===');
    logger.info(`Status: ${journal.status || 'unknown'}`);
    logger.info(`Started: ${journal.startedAt || 'unknown'}`);
    if (journal.completedAt) {
      logger.info(`Completed: ${journal.completedAt}`);
    }

    if (journal.organizations) {
      const orgs = Object.entries(journal.organizations);
      logger.info('');
      logger.info(`Organizations: ${orgs.length}`);

      for (const [orgKey, org] of orgs) {
        const projects = Object.entries(org.projects || {});
        const completedProjects = projects.filter(([, p]) => p.status === 'completed').length;
        const failedProjects = projects.filter(([, p]) => p.status === 'failed').length;

        const orgIcon = org.status === 'completed' ? '[done]'
          : org.status === 'in_progress' ? '[>>  ]'
            : '[    ]';

        logger.info('');
        logger.info(`  ${orgIcon} ${orgKey} (org-wide: ${org.orgWideResources || 'pending'})`);
        logger.info(`       Projects: ${completedProjects}/${projects.length} completed` +
          (failedProjects > 0 ? `, ${failedProjects} failed` : ''));

        for (const [projKey, proj] of projects) {
          const projIcon = proj.status === 'completed' ? '[done]'
            : proj.status === 'in_progress' ? '[>>  ]'
              : proj.status === 'failed' ? '[FAIL]'
                : '[    ]';
          const detail = proj.lastCompletedStep ? ` (last step: ${proj.lastCompletedStep})` : '';
          const error = proj.error ? ` — ${proj.error}` : '';
          logger.info(`         ${projIcon} ${projKey}${detail}${error}`);
        }
      }
    }
  }

  /**
   * Get overall completion percentage from a checkpoint journal.
   * @param {object} journal
   * @returns {number} 0-100
   */
  getCompletionPercentage(journal) {
    if (!journal || !journal.phases) return 0;
    const phases = Object.values(journal.phases);
    if (phases.length === 0) return 0;
    const completed = phases.filter(p => p.status === 'completed').length;
    return Math.round((completed / phases.length) * 100);
  }

  /**
   * Estimate time remaining based on completed phase durations.
   * @param {object} journal
   * @returns {string|null}
   */
  getEstimatedTimeRemaining(journal) {
    if (!journal || !journal.phases) return null;

    const phases = Object.values(journal.phases);
    const completed = phases.filter(p => p.status === 'completed' && p.startedAt && p.completedAt);
    const remaining = phases.filter(p => p.status !== 'completed');

    if (completed.length === 0 || remaining.length === 0) return null;

    // Average duration of completed phases
    let totalMs = 0;
    for (const phase of completed) {
      totalMs += new Date(phase.completedAt).getTime() - new Date(phase.startedAt).getTime();
    }
    const avgMs = totalMs / completed.length;
    const estimatedMs = avgMs * remaining.length;

    if (estimatedMs < 60_000) {
      return `~${Math.round(estimatedMs / 1000)}s`;
    } else if (estimatedMs < 3_600_000) {
      return `~${Math.round(estimatedMs / 60_000)}m`;
    } else {
      const hours = Math.floor(estimatedMs / 3_600_000);
      const mins = Math.round((estimatedMs % 3_600_000) / 60_000);
      return `~${hours}h ${mins}m`;
    }
  }
}
