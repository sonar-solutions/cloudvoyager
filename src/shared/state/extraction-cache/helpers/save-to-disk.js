// -------- Save Cache to Disk --------

import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';
import logger from '../../../utils/logger.js';
import { toSerializable } from './serialize.js';

/**
 * Save extraction result to disk as gzipped JSON.
 * @param {string} filePath - Path to write
 * @param {string} phaseName
 * @param {string} branchName
 * @param {*} data - Data to serialize
 */
export async function saveToDisk(filePath, phaseName, branchName, data) {
  try {
    const serializable = toSerializable(data);
    const envelope = {
      _meta: {
        phaseName, branchName,
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
  }
}
