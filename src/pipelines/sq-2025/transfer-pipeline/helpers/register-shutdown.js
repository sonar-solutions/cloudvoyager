// -------- Register Shutdown Handler --------

/** Register cleanup callbacks with the shutdown coordinator. */
export function registerShutdown(shutdownCoordinator, journal, stateTracker, lockFile) {
  if (!shutdownCoordinator) return;

  shutdownCoordinator.register(async () => {
    if (journal) await journal.markInterrupted();
    await stateTracker.save();
    await lockFile.release();
  });
}
