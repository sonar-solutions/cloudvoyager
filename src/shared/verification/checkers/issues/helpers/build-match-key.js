// -------- Build Issue Match Key --------

import { normalizeRule } from './normalize-rule.js';

/**
 * Build a match key from rule + file component + line number.
 * Rule keys are normalized so SQ "mulesoft:X" matches SC "external_mulesoft:X".
 */
export function buildMatchKey(issue) {
  const rule = normalizeRule(issue.rule);
  const component = issue.component || '';
  const filePath = component.includes(':') ? component.split(':').pop() : component;
  const line = issue.line || issue.textRange?.startLine || 0;
  if (!rule || !filePath) return null;
  const msgHint = (issue.message || '').slice(0, 50);
  return `${rule}|${filePath}|${line}|${msgHint}`;
}
