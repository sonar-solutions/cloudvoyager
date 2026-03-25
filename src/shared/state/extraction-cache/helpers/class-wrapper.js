// -------- Backward-Compatible Class Wrapper --------

import { createExtractionCache } from '../index.js';

export class ExtractionCache {
  constructor(cacheDir, options = {}) {
    this._impl = createExtractionCache(cacheDir, options);
  }
}

// -------- Delegate Methods --------

const delegatedMethods = [
  'save', 'load', 'exists', 'clear', 'clearBranch', 'purgeStale',
];

for (const method of delegatedMethods) {
  ExtractionCache.prototype[method] = function (...args) {
    return this._impl[method](...args);
  };
}

// -------- Delegate Properties --------

Object.defineProperty(ExtractionCache.prototype, 'cacheDir', {
  get() { return this._impl.cacheDir; },
});

Object.defineProperty(ExtractionCache.prototype, 'maxAgeDays', {
  get() { return this._impl.maxAgeDays; },
});
