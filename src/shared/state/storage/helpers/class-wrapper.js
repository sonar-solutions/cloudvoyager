// -------- Backward-Compatible Class Wrapper --------

import { createStateStorage } from '../index.js';

export class StateStorage {
  constructor(stateFilePath) {
    this._impl = createStateStorage(stateFilePath);
  }
}

// -------- Delegate Methods --------

const delegatedMethods = ['load', 'save', 'clear', 'exists'];

for (const method of delegatedMethods) {
  StateStorage.prototype[method] = function (...args) {
    return this._impl[method](...args);
  };
}

// -------- Delegate Properties --------

Object.defineProperty(StateStorage.prototype, 'filePath', {
  get() { return this._impl.filePath; },
});
