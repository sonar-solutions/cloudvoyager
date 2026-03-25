// -------- Register Shutdown Cleanup Handler --------

export function registerShutdownCleanup(shutdownCoordinator, { journal, stateTracker, lockFile }) {
  if (!shutdownCoordinator) return;

  shutdownCoordinator.register(async () => {
    if (journal) await journal.markInterrupted();
    await stateTracker.save();
    await lockFile.release();
  });
}
