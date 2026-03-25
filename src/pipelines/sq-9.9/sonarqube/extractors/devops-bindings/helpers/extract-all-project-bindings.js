import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../../shared/utils/concurrency.js';
import { extractProjectBinding } from './extract-project-binding.js';

// -------- Extract DevOps Bindings for All Projects --------

export async function extractAllProjectBindings(client, projects, options = {}) {
  const concurrency = options.concurrency || 10;
  logger.info(`Extracting DevOps bindings for ${projects.length} projects (concurrency=${concurrency})...`);

  const results = await mapConcurrent(
    projects,
    async (project) => {
      const binding = await extractProjectBinding(client, project.key);
      return { key: project.key, binding };
    },
    { concurrency, settled: true }
  );

  const bindings = new Map();
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.binding) {
      bindings.set(r.value.key, r.value.binding);
    }
  }

  logger.info(`Found DevOps bindings for ${bindings.size}/${projects.length} projects`);
  return bindings;
}
