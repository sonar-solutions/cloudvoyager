import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Save server info reference files to disk.
 */
export async function saveServerInfo(outputDir, extractedData) {
  logger.info('=== Step 4: Saving server info (reference) ===');
  const dir = join(outputDir, 'server-info');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'system.json'), JSON.stringify(extractedData.serverInfo.system, null, 2));
  await writeFile(join(dir, 'plugins.json'), JSON.stringify(extractedData.serverInfo.plugins, null, 2));
  await writeFile(join(dir, 'settings.json'), JSON.stringify(extractedData.serverInfo.settings, null, 2));
  await writeFile(join(dir, 'webhooks.json'), JSON.stringify(extractedData.serverWebhooks, null, 2));
  await writeFile(join(dir, 'alm-settings.json'), JSON.stringify(extractedData.almSettings, null, 2));
}
