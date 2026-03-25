// -------- Update Migration Journal --------

/** Mark project as completed or failed in the migration journal. */
export async function updateMigrationJournal(ctx, org, project, projectResult) {
  const mj = ctx.migrationJournal || null;
  if (!mj) return;

  if (projectResult.status === 'success') {
    await mj.markProjectCompleted(org.key, project.key);
  } else {
    await mj.markProjectFailed(org.key, project.key, projectResult.errors?.[0] || 'Unknown error');
  }
}
