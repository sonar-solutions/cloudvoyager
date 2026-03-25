// -------- Verify Hotspots --------

import logger from '../../../utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../utils/concurrency.js';
import { createEmptyHotspotResult } from './helpers/create-empty-result.js';
import { matchHotspots } from './helpers/match-hotspots.js';
import { classifyUnmatchedSq, classifyScOnly } from './helpers/classify-unmatched.js';
import { verifyHotspotPair } from './helpers/verify-hotspot-pair.js';

/**
 * Verify hotspots between SonarQube and SonarCloud for a project.
 */
export async function verifyHotspots(sqClient, scClient, scProjectKey, options = {}) {
  const concurrency = options.concurrency || 5;
  const result = createEmptyHotspotResult();

  logger.info('Fetching hotspots from SonarQube...');
  const sqHotspots = await sqClient.getHotspots();
  result.sqCount = sqHotspots.length;

  logger.info('Fetching hotspots from SonarCloud...');
  const scHotspots = await scClient.searchHotspots(scProjectKey);
  result.scCount = scHotspots.length;
  logger.info(`SQ: ${sqHotspots.length} hotspots, SC: ${scHotspots.length} hotspots`);

  if (sqHotspots.length === 0 && scHotspots.length === 0) return result;

  const { matchedPairs, matchedSqKeys, scHotspotMap } = matchHotspots(sqHotspots, scHotspots);
  result.matched = matchedPairs.length;

  const matchedRules = new Set(matchedPairs.map(p => p.sqHotspot.ruleKey || p.sqHotspot.securityCategory || ''));
  const scRules = new Set(scHotspots.map(h => h.ruleKey || h.rule?.key || h.securityCategory || ''));
  const sqRules = new Set(sqHotspots.map(h => h.ruleKey || h.securityCategory || ''));

  classifyUnmatchedSq(sqHotspots, matchedSqKeys, matchedRules, scRules, result);
  classifyScOnly(scHotspotMap, matchedRules, sqRules, result);

  logger.info(`Matched ${matchedPairs.length}/${sqHotspots.length} hotspots, verifying details...`);
  const progressLogger = createProgressLogger('Hotspot verification', matchedPairs.length);
  await mapConcurrent(matchedPairs, async ({ sqHotspot, scHotspot }) => {
    await verifyHotspotPair(sqHotspot, scHotspot, scClient, result);
  }, { concurrency, settled: true, onProgress: progressLogger });

  if (result.unmatched > 0 || result.statusMismatches.length > 0) result.status = 'fail';
  else if (result.commentMismatches.length > 0) result.status = 'fail';

  logger.info(`Hotspot verification: ${result.matched} matched, ${result.unmatched} unmatched, ${result.statusMismatches.length} status mismatches`);
  return result;
}
