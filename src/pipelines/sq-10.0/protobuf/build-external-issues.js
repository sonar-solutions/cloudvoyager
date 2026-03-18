import logger from '../../../shared/utils/logger.js';

/**
 * Parse a SonarQube effort string (e.g. "30min", "2h", "1h30min") to minutes.
 */
function parseEffortToMinutes(effort) {
  if (!effort) return 0;
  if (typeof effort === 'number') return effort;

  let minutes = 0;
  const hourMatch = effort.match(/(\d+)h/);
  const minMatch = effort.match(/(\d+)min/);
  if (hourMatch) minutes += Number.parseInt(hourMatch[1], 10) * 60;
  if (minMatch) minutes += Number.parseInt(minMatch[1], 10);
  return minutes;
}

/**
 * Map SonarQube issue type string to the IssueType protobuf enum value.
 * IssueType enum: CODE_SMELL=1, BUG=2, VULNERABILITY=3, SECURITY_HOTSPOT=4
 * SECURITY_HOTSPOT maps to 4 here because it is a distinct issue type in the scanner report.
 */
function mapIssueType(type) {
  const typeMap = { 'CODE_SMELL': 1, 'BUG': 2, 'VULNERABILITY': 3, 'SECURITY_HOTSPOT': 4 };
  return typeMap[type] || 1; // default to CODE_SMELL
}

/**
 * Map SonarQube issue type to a SoftwareQuality protobuf enum value.
 * SoftwareQuality enum: MAINTAINABILITY=1, RELIABILITY=2, SECURITY=3
 * SECURITY_HOTSPOT maps to 3 (SECURITY) here — different from IssueType above —
 * because it describes the software quality dimension, not the issue classification.
 */
function mapSoftwareQuality(type) {
  const qualityMap = {
    // New impact-based names (from SonarQube 10.x impacts API)
    'MAINTAINABILITY': 1, 'RELIABILITY': 2, 'SECURITY': 3,
    // Old type-based fallback names
    'CODE_SMELL': 1, 'BUG': 2, 'VULNERABILITY': 3, 'SECURITY_HOTSPOT': 3,
  };
  return qualityMap[type] || 1; // default to MAINTAINABILITY
}

/**
 * Map a SonarQube severity string (e.g. "MEDIUM") to the ImpactSeverity enum value.
 * SQ impact severities: LOW, MEDIUM, HIGH, BLOCKER (newer), INFO (newer)
 * Proto: LOW=1, MEDIUM=2, HIGH=3, INFO=4, BLOCKER=5
 */
function mapImpactSeverity(severity) {
  const sevMap = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'INFO': 4, 'BLOCKER': 5 };
  return sevMap[severity] || 2; // default to MEDIUM
}

/**
 * Map old-style issue severity (INFO, MINOR, MAJOR, CRITICAL, BLOCKER) to ImpactSeverity.
 */
function mapOldSeverityToImpact(severity) {
  const sevMap = { 'INFO': 1, 'MINOR': 1, 'MAJOR': 2, 'CRITICAL': 3, 'BLOCKER': 3 };
  return sevMap[severity] || 2;
}

/**
 * Map a CleanCodeAttribute string name to its protobuf enum value.
 * Enum: UNSPECIFIED=0, CONVENTIONAL=1, FORMATTED=2, IDENTIFIABLE=3, CLEAR=4,
 * COMPLETE=5, EFFICIENT=6, LOGICAL=7, DISTINCT=8, FOCUSED=9, MODULAR=10,
 * TESTED=11, LAWFUL=12, RESPECTFUL=13, TRUSTWORTHY=14
 */
function mapCleanCodeAttribute(attr) {
  const attrMap = {
    'CONVENTIONAL': 1, 'FORMATTED': 2, 'IDENTIFIABLE': 3,
    'CLEAR': 4, 'COMPLETE': 5, 'EFFICIENT': 6, 'LOGICAL': 7,
    'DISTINCT': 8, 'FOCUSED': 9, 'MODULAR': 10, 'TESTED': 11,
    'LAWFUL': 12, 'RESPECTFUL': 13, 'TRUSTWORTHY': 14,
  };
  return attrMap[attr] || 1; // default to CONVENTIONAL
}

/**
 * Derive a default cleanCodeAttribute enum value from the issue type.
 */
function defaultCleanCodeAttribute(type) {
  const attrMap = { 'CODE_SMELL': 1, 'BUG': 7, 'VULNERABILITY': 14, 'SECURITY_HOTSPOT': 14 };
  return attrMap[type] || 1; // CONVENTIONAL=1, LOGICAL=7, TRUSTWORTHY=14
}

/**
 * Build impacts array for an ExternalIssue from the SonarQube issue data.
 * Uses the issue's impacts field if available, otherwise derives from type/severity.
 */
function buildImpacts(issue) {
  if (issue.impacts && issue.impacts.length > 0) {
    return issue.impacts.map(impact => ({
      softwareQuality: mapSoftwareQuality(impact.softwareQuality) || mapSoftwareQuality(issue.type),
      severity: mapImpactSeverity(impact.severity),
    }));
  }
  // Fallback: derive from old-style type + severity
  return [{
    softwareQuality: mapSoftwareQuality(issue.type),
    severity: mapOldSeverityToImpact(issue.severity),
  }];
}

/**
 * Check if an issue belongs to an external (unsupported) engine — i.e. its rule
 * repository does NOT exist in SonarCloud.
 *
 * @param {object} issue - SonarQube issue with a `rule` field like "mulesoft:SomeRule"
 * @param {Set<string>} sonarCloudRepos - Set of rule repository keys available in SonarCloud
 * @returns {boolean} true if the issue's repository is NOT in SonarCloud
 */
export function isExternalIssue(issue, sonarCloudRepos) {
  if (!sonarCloudRepos || sonarCloudRepos.size === 0) return false;
  const repo = issue.rule.split(':')[0];
  return !sonarCloudRepos.has(repo);
}

/**
 * Build ExternalIssue protobuf messages and collect AdHocRule definitions
 * from issues whose rule repository is not available in SonarCloud.
 *
 * Auto-detects external issues by comparing each issue's rule repository
 * against the set of repositories available in SonarCloud.
 *
 * @param {object} builder - ProtobufBuilder instance (must have .sonarCloudRepos: Set<string>)
 * @returns {{ externalIssuesByComponent: Map<number, object[]>, adHocRules: object[] }}
 */
export function buildExternalIssues(builder) {
  const sonarCloudRepos = builder.sonarCloudRepos;

  if (!sonarCloudRepos || sonarCloudRepos.size === 0) {
    logger.debug('No SonarCloud repositories available — skipping external issue auto-detection');
    return { externalIssuesByComponent: new Map(), adHocRules: [] };
  }

  logger.info('Auto-detecting external issues (rule repos not in SonarCloud)...');

  const ruleEnrichmentMap = builder.ruleEnrichmentMap || new Map();
  const externalIssuesByComponent = new Map();
  const adHocRules = new Map(); // keyed by "engineId:ruleId"
  const detectedEngines = new Set();
  let skippedIssues = 0;
  let enrichedCount = 0;

  builder.data.issues.forEach(issue => {
    if (!isExternalIssue(issue, sonarCloudRepos)) return;

    if (!builder.validComponentKeys?.has(issue.component)) {
      skippedIssues++;
      return;
    }
    const componentRef = builder.componentRefMap.get(issue.component);
    if (!componentRef) {
      skippedIssues++;
      return;
    }

    const ruleParts = issue.rule.split(':');
    const engineId = ruleParts[0] || 'unknown';
    const ruleId = ruleParts[1] || issue.rule;
    detectedEngines.add(engineId);

    // Resolve cleanCodeAttribute: issue data → SC enrichment → type-based fallback
    const fullRuleKey = `${engineId}:${ruleId}`;
    const enrichment = ruleEnrichmentMap.get(fullRuleKey);
    let cleanCodeAttr;
    if (issue.cleanCodeAttribute) {
      cleanCodeAttr = mapCleanCodeAttribute(issue.cleanCodeAttribute);
    } else if (enrichment?.cleanCodeAttribute) {
      cleanCodeAttr = mapCleanCodeAttribute(enrichment.cleanCodeAttribute);
      enrichedCount++;
    } else {
      cleanCodeAttr = defaultCleanCodeAttribute(issue.type);
    }

    // Resolve impacts: issue data → SC enrichment → type-based fallback
    let impacts;
    if (issue.impacts && issue.impacts.length > 0) {
      impacts = buildImpacts(issue);
    } else if (enrichment?.impacts?.length > 0) {
      impacts = enrichment.impacts.map(impact => ({
        softwareQuality: mapSoftwareQuality(impact.softwareQuality) || mapSoftwareQuality(issue.type),
        severity: mapImpactSeverity(impact.severity),
      }));
    } else {
      impacts = buildImpacts(issue); // falls back to type-based derivation
    }

    const externalIssue = {
      engineId,
      ruleId,
      msg: issue.message || '',
      severity: builder.mapSeverity(issue.severity),
      effort: parseEffortToMinutes(issue.effort || issue.debt),
      type: mapIssueType(issue.type),
      cleanCodeAttribute: cleanCodeAttr,
      impacts,
    };

    if (issue.textRange) {
      externalIssue.textRange = {
        startLine: issue.textRange.startLine,
        endLine: issue.textRange.endLine,
        startOffset: issue.textRange.startOffset || 0,
        endOffset: issue.textRange.endOffset || 0,
      };
    }

    if (issue.flows && issue.flows.length > 0) {
      externalIssue.flow = issue.flows.map(flow => ({
        location: (flow.locations || []).map(loc => ({
          componentRef: builder.componentRefMap.get(loc.component) || componentRef,
          textRange: loc.textRange ? {
            startLine: loc.textRange.startLine,
            endLine: loc.textRange.endLine,
            startOffset: loc.textRange.startOffset || 0,
            endOffset: loc.textRange.endOffset || 0,
          } : undefined,
          msg: loc.msg || '',
        })),
      }));
    }

    if (!externalIssuesByComponent.has(componentRef)) {
      externalIssuesByComponent.set(componentRef, []);
    }
    externalIssuesByComponent.get(componentRef).push(externalIssue);

    // Collect unique ad-hoc rules
    if (!adHocRules.has(fullRuleKey)) {
      adHocRules.set(fullRuleKey, {
        engineId,
        ruleId,
        name: ruleId,
        description: '',
        severity: builder.mapSeverity(issue.severity),
        type: mapIssueType(issue.type),
        cleanCodeAttribute: cleanCodeAttr,
        defaultImpacts: impacts,
      });
    }
  });

  const totalExternal = [...externalIssuesByComponent.values()].reduce((sum, arr) => sum + arr.length, 0);
  if (skippedIssues > 0) {
    logger.warn(`Skipped ${skippedIssues} external issues (components without source code)`);
  }
  if (detectedEngines.size > 0) {
    logger.info(`Auto-detected external engines: ${[...detectedEngines].join(', ')}`);
  }
  if (enrichedCount > 0) {
    logger.info(`Enriched ${enrichedCount} external issues with SonarCloud Clean Code data`);
  }
  logger.info(`Built ${totalExternal} external issue messages across ${externalIssuesByComponent.size} components, ${adHocRules.size} ad-hoc rules`);

  return { externalIssuesByComponent, adHocRules: [...adHocRules.values()] };
}
