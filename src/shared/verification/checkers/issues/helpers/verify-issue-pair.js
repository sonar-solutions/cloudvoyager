// -------- Verify Issue Pair --------
import logger from '../../../../utils/logger.js';
import { extractTransitionsFromChangelog } from '../../../../../pipelines/sq-10.4/sonarcloud/migrators/issue-sync.js';
import { normalizeStatus } from './normalize-status.js';
import { checkAssignment, checkComments, checkTags } from './check-issue-metadata.js';
import { checkUnsyncable } from './check-unsyncable.js';

/** Verify a single matched SQ ↔ SC issue pair. */
export async function verifyIssuePair(sq, sc, sqClient, scClient, result) {
  checkCreationDate(sq, sc, result);
  checkStatusMatch(sq, sc, result);
  await checkStatusHistory(sq, sc, sqClient, scClient, result);
  checkAssignment(sq, sc, result);
  checkComments(sq, sc, result);
  checkTags(sq, sc, result);
  checkUnsyncable(sq, sc, result);
}

function checkCreationDate(sq, sc, result) {
  const sqDate = sq.creationDate;
  const scDate = sc.creationDate;
  if (!sqDate || !scDate) return;
  const sqMs = new Date(sqDate).getTime();
  const scMs = new Date(scDate).getTime();
  if (isNaN(sqMs) || isNaN(scMs)) return;
  if (sqMs === scMs) return;
  result.creationDateMismatches.push({
    sqKey: sq.key, scKey: sc.key, rule: sq.rule,
    file: (sq.component || '').split(':').pop(), line: sq.line || sq.textRange?.startLine || 0,
    sqCreationDate: sqDate, scCreationDate: scDate,
  });
}

function checkStatusMatch(sq, sc, result) {
  const sqS = normalizeStatus(sq.status, sq.resolution);
  const scS = normalizeStatus(sc.status, sc.resolution);
  if (sqS === scS) return;
  result.statusMismatches.push({
    sqKey: sq.key, scKey: sc.key, rule: sq.rule,
    file: (sq.component || '').split(':').pop(), line: sq.line || sq.textRange?.startLine || 0,
    sqStatus: sq.status, sqResolution: sq.resolution || null,
    scStatus: sc.status, scResolution: sc.resolution || null,
  });
}

async function checkStatusHistory(sq, sc, sqClient, scClient, result) {
  try {
    const sqT = extractTransitionsFromChangelog(await sqClient.getIssueChangelog(sq.key));
    if (sqT.length === 0) return;
    const scT = extractTransitionsFromChangelog(await scClient.getIssueChangelog(sc.key));
    let idx = 0;
    const missing = [];
    for (const t of sqT) {
      let found = false;
      while (idx < scT.length) { if (scT[idx] === t) { found = true; idx++; break; } idx++; }
      if (!found) missing.push(t);
    }
    if (missing.length > 0) {
      result.statusHistoryMismatches.push({
        sqKey: sq.key, scKey: sc.key, rule: sq.rule,
        file: (sq.component || '').split(':').pop(), line: sq.line || sq.textRange?.startLine || 0,
        sqTransitions: sqT, scTransitions: scT, missingTransitions: missing,
      });
    }
  } catch (e) { logger.debug(`Failed to compare changelogs for ${sq.key}: ${e.message}`); }
}
