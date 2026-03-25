// -------- State Storage --------
import { existsSync } from 'node:fs';
import { atomicSave } from './helpers/atomic-save.js';
import { loadWithFallbacks } from './helpers/load-with-fallbacks.js';
import { clearFiles } from './helpers/clear-files.js';

export { createStateStorage };
export { StateStorage } from './helpers/class-wrapper.js';

// -------- Factory Function --------
function createStateStorage(stateFilePath) {
  return {
    get filePath() { return stateFilePath; },
    async load() { return loadWithFallbacks(stateFilePath); },
    async save(state) { await atomicSave(stateFilePath, state); },
    async clear() { await clearFiles(stateFilePath); },
    exists() { return existsSync(stateFilePath); },
  };
}
