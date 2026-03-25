// -------- Backward-Compatible Class Wrapper --------

import { createLockFile } from '../index.js';

export class LockFile {
  constructor(lockPath) {
    this._impl = createLockFile(lockPath);
  }
}

// -------- Delegate Methods --------

const delegatedMethods = ['acquire', 'release', 'forceRelease'];

for (const method of delegatedMethods) {
  LockFile.prototype[method] = function (...args) {
    return this._impl[method](...args);
  };
}

// -------- Delegate Properties --------

Object.defineProperty(LockFile.prototype, 'lockPath', {
  get() { return this._impl.lockPath; },
});

Object.defineProperty(LockFile.prototype, 'acquired', {
  get() { return this._impl.acquired; },
});
