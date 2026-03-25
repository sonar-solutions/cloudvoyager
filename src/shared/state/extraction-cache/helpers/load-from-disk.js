// -------- Load Cache from Disk --------

import { existsSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import { createReadStream } from 'node:fs';
import logger from '../../../utils/logger.js';
import { fromSerializable } from './serialize.js';

/**
 * Load extraction result from disk.
 * @param {string} filePath - Path to read
 * @param {string} phaseName
 * @param {string} branchName
 * @returns {Promise<*|null>} Deserialized data or null
 */
export async function loadFromDisk(filePath, phaseName, branchName) {
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

    const data = fromSerializable(envelope.data);
    logger.debug(`Loaded cached ${phaseName} for branch '${branchName}'`);
    return data;
  } catch (error) {
    logger.warn(`Failed to load cache for ${phaseName}: ${error.message}`);
    return null;
  }
}
