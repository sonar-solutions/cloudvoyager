import { isExternalIssue } from './is-external-issue.js';
import { buildOneExternalIssue } from './build-one-external-issue.js';
import { collectAdHocRule } from './collect-ad-hoc-rule.js';

// -------- Process One Issue --------

/** Process a single issue: skip if not external/invalid, otherwise build and collect. */
export function processOneIssue(issue, builder, ctx) {
  if (!isExternalIssue(issue, ctx.sonarCloudRepos)) return;

  if (!builder.validComponentKeys?.has(issue.component)) { ctx.skippedIssues++; return; }
  const componentRef = builder.componentRefMap.get(issue.component);
  if (!componentRef) { ctx.skippedIssues++; return; }

  const fullRuleKey = `${issue.rule.split(':')[0] || 'unknown'}:${issue.rule.split(':')[1] || issue.rule}`;
  const enrichment = ctx.ruleEnrichmentMap.get(fullRuleKey);
  const result = buildOneExternalIssue(issue, builder, enrichment);

  if (result.enriched) ctx.enrichedCount++;
  ctx.detectedEngines.add(result.engineId);

  if (!ctx.externalIssuesByComponent.has(componentRef)) ctx.externalIssuesByComponent.set(componentRef, []);
  ctx.externalIssuesByComponent.get(componentRef).push(result.extIssue);

  collectAdHocRule(ctx.adHocRules, fullRuleKey, result.extIssue, result.cleanCodeAttr, result.impacts);
}
