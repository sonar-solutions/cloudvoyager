// -------- Main Logic --------

/**
 * Build journal helper functions for per-step checkpointing.
 */
export function buildJournalHelpers(ctx, org, project) {
  const migrationJournal = ctx.migrationJournal || null;

  const STEP_ORDER = [
    'upload_scanner_report',
    'project_settings', 'project_tags', 'project_links', 'new_code_definitions',
    'devops_binding', 'assign_quality_gate', 'assign_quality_profiles', 'project_permissions',
    'sync_issues', 'sync_hotspots',
  ];

  const isStepDone = (step) =>
    migrationJournal && migrationJournal.isProjectStepCompleted(org?.key, project.key, step, STEP_ORDER);

  const recordStep = async (step) => {
    if (migrationJournal) await migrationJournal.completeProjectStep(org?.key, project.key, step);
  };

  return { isStepDone, recordStep };
}
