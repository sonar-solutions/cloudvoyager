import { runNonFatalExtraction } from './run-non-fatal-extraction.js';

// -------- Extract DevOps Bindings --------

/** Extract ALM settings and project bindings. */
export async function extractDevOpsBindings(sqClient, allProjects, results, perfConfig, ext) {
  let almSettings = [];
  let projectBindings = new Map();

  const bindingsResult = await runNonFatalExtraction(results, 'DevOps bindings', async () => {
    const [alm, bindings] = await Promise.all([
      ext.extractAlmSettings(sqClient),
      ext.extractAllProjectBindings(sqClient, allProjects, { concurrency: perfConfig.maxConcurrency }),
    ]);
    return { alm, bindings };
  });

  if (bindingsResult) {
    almSettings = bindingsResult.alm;
    projectBindings = bindingsResult.bindings;
  }

  return { almSettings, projectBindings };
}
