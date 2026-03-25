// -------- Run Fatal Step --------

/** Execute a step that throws on failure. */
export async function runFatalStep(results, stepName, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    results.serverSteps.push({ step: stepName, status: 'success', durationMs: Date.now() - start });
    return result;
  } catch (error) {
    results.serverSteps.push({ step: stepName, status: 'failed', error: error.message, durationMs: Date.now() - start });
    throw error;
  }
}
