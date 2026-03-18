import { mkdir, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable, Writable } from 'node:stream';
import { createWriteStream, createReadStream } from 'node:fs';
import logger from '../utils/logger.js';

const DEFAULT_MAX_AGE_DAYS = 7;

/**
 * Disk-based extraction cache for pause/resume support.
 *
 * Caches serialized extraction results per phase per branch so that
 * resumed runs can skip already-completed extraction steps.
 */
export class ExtractionCache {
  /**
   * @param {string} cacheDir - Root cache directory for this project
   * @param {object} [options]
   * @param {number} [options.maxAgeDays=7] - Auto-purge files older than this
   */
  constructor(cacheDir, options = {}) {
    this.cacheDir = cacheDir;
    this.maxAgeDays = options.maxAgeDays || DEFAULT_MAX_AGE_DAYS;
  }

  /**
   * Ensure cache directory exists.
   */
  async _ensureDir(subDir = '') {
    const dir = subDir ? join(this.cacheDir, subDir) : this.cacheDir;
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Get the cache file path for a given phase and branch.
   * @param {string} phaseName
   * @param {string} branchName
   * @returns {string}
   */
  _filePath(phaseName, branchName) {
    const safeBranch = branchName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safePhase = phaseName.replace(/[^a-zA-Z0-9_:-]/g, '_');
    return join(this.cacheDir, `${safePhase}__${safeBranch}.json.gz`);
  }

  /**
   * Save extraction result to disk (gzipped JSON).
   * @param {string} phaseName
   * @param {string} branchName
   * @param {*} data - Data to serialize
   */
  async save(phaseName, branchName, data) {
    await this._ensureDir();
    const filePath = this._filePath(phaseName, branchName);

    try {
      const serializable = this._toSerializable(data);
      const envelope = {
        _meta: {
          phaseName,
          branchName,
          cachedAt: new Date().toISOString(),
          version: 1,
        },
        data: serializable,
      };

      const json = JSON.stringify(envelope);
      const inputStream = Readable.from([json]);
      const gzip = createGzip({ level: 6 });
      const output = createWriteStream(filePath);

      await pipeline(inputStream, gzip, output);
      logger.debug(`Cached ${phaseName} for branch '${branchName}' (${(json.length / 1024).toFixed(0)}KB)`);
    } catch (error) {
      logger.debug(`Failed to cache ${phaseName}: ${error.message}`);
      // Cache failures are non-fatal
    }
  }

  /**
   * Load extraction result from disk.
   * @param {string} phaseName
   * @param {string} branchName
   * @returns {Promise<*|null>} Deserialized data or null if not found/corrupt
   */
  async load(phaseName, branchName) {
    const filePath = this._filePath(phaseName, branchName);

    if (!existsSync(filePath)) return null;

    try {
      const chunks = [];
      const gunzip = createGunzip();
      const input = createReadStream(filePath);
      const collector = new Writable({
        write(chunk, _encoding, cb) {
          chunks.push(chunk);
          cb();
        },
      });

      await pipeline(input, gunzip, collector);
      const json = Buffer.concat(chunks).toString('utf-8');
      const envelope = JSON.parse(json);

      if (!envelope._meta || !envelope.data) {
        logger.warn(`Cache file corrupt (missing envelope): ${filePath}`);
        return null;
      }

      const data = this._fromSerializable(envelope.data);
      logger.debug(`Loaded cached ${phaseName} for branch '${branchName}'`);
      return data;
    } catch (error) {
      logger.warn(`Failed to load cache for ${phaseName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if a cache file exists for a given phase and branch.
   * @param {string} phaseName
   * @param {string} branchName
   * @returns {boolean}
   */
  exists(phaseName, branchName) {
    return existsSync(this._filePath(phaseName, branchName));
  }

  /**
   * Clear the entire cache directory.
   */
  async clear() {
    if (existsSync(this.cacheDir)) {
      await rm(this.cacheDir, { recursive: true, force: true });
      logger.info('Extraction cache cleared');
    }
  }

  /**
   * Clear cache files for a specific branch.
   * @param {string} branchName
   */
  async clearBranch(branchName) {
    if (!existsSync(this.cacheDir)) return;

    const safeBranch = branchName.replace(/[^a-zA-Z0-9_-]/g, '_');
    try {
      const files = await readdir(this.cacheDir);
      for (const file of files) {
        if (file.includes(`__${safeBranch}.json.gz`)) {
          const filePath = join(this.cacheDir, file);
          await rm(filePath, { force: true });
          logger.debug(`Cleared cache: ${file}`);
        }
      }
    } catch (error) {
      logger.debug(`Failed to clear branch cache: ${error.message}`);
    }
  }

  /**
   * Purge cache files older than maxAgeDays.
   */
  async purgeStale() {
    if (!existsSync(this.cacheDir)) return;

    const maxAgeMs = this.maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let purgedCount = 0;

    try {
      const files = await readdir(this.cacheDir);
      for (const file of files) {
        const filePath = join(this.cacheDir, file);
        const fileStat = await stat(filePath);
        if (now - fileStat.mtimeMs > maxAgeMs) {
          await rm(filePath, { force: true });
          purgedCount++;
        }
      }
      if (purgedCount > 0) {
        logger.info(`Purged ${purgedCount} stale cache file(s) older than ${this.maxAgeDays} days`);
      }
    } catch (error) {
      logger.debug(`Failed to purge stale cache: ${error.message}`);
    }
  }

  /**
   * Convert data to a JSON-serializable form.
   * Handles Map objects by converting to arrays of entries.
   * @param {*} data
   * @returns {*}
   */
  _toSerializable(data) {
    if (data instanceof Map) {
      return { __type: 'Map', entries: [...data.entries()].map(([k, v]) => [k, this._toSerializable(v)]) };
    }
    if (Array.isArray(data)) {
      return data.map(item => this._toSerializable(item));
    }
    if (data && typeof data === 'object' && data.constructor === Object) {
      const result = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this._toSerializable(value);
      }
      return result;
    }
    return data;
  }

  /**
   * Convert serialized data back to its original form.
   * Reconstructs Map objects from entries arrays.
   * @param {*} data
   * @returns {*}
   */
  _fromSerializable(data) {
    if (data && typeof data === 'object' && data.__type === 'Map') {
      return new Map(data.entries.map(([k, v]) => [k, this._fromSerializable(v)]));
    }
    if (Array.isArray(data)) {
      return data.map(item => this._fromSerializable(item));
    }
    if (data && typeof data === 'object' && data.constructor === Object) {
      const result = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this._fromSerializable(value);
      }
      return result;
    }
    return data;
  }
}
