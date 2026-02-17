import { randomBytes } from 'node:crypto';
import logger from '../utils/logger.js';
import { ProtobufEncodingError } from '../utils/errors.js';

/**
 * Build protobuf messages from extracted SonarQube data
 */
export class ProtobufBuilder {
  constructor(extractedData, sonarCloudConfig = {}, sonarCloudProfiles = [], options = {}) {
    this.data = extractedData;
    this.sonarCloudConfig = sonarCloudConfig;
    this.sonarCloudProfiles = sonarCloudProfiles;
    this.componentRefMap = new Map();
    this.nextRef = 1;
    this.sonarCloudBranchName = options.sonarCloudBranchName || null;
  }

  /**
   * Build metadata message
   */
  buildMetadata() {
    const project = this.data.project.project;

    // Use SonarCloud branch name if available, otherwise fall back to SonarQube branch
    const sqBranch = this.data.project.branches.find(b => b.isMain) || this.data.project.branches[0];
    const branchName = this.sonarCloudBranchName || sqBranch?.name || 'master';

    const metadata = {
      analysisDate: new Date(this.data.metadata.extractedAt).getTime(),
      organizationKey: this.sonarCloudConfig.organization || '',
      projectKey: this.sonarCloudConfig.projectKey || project.key,
      rootComponentRef: this.getComponentRef(project.key),
      crossProjectDuplicationActivated: false,
      qprofilesPerLanguage: this.buildQProfiles(),
      branchName: branchName,
      branchType: 1, // BranchType.BRANCH
      referenceBranchName: branchName,
      scmRevisionId: this.data.metadata.scmRevisionId || this.generateFakeCommitHash(),
      projectVersion: '1.0.0',
      analyzedIndexedFileCountPerType: this.buildFileCountsByType(),
    };

    logger.debug(`Metadata built: projectKey=${metadata.projectKey}, branch=${metadata.branchName}, scmRevisionId=${metadata.scmRevisionId}`);
    return metadata;
  }

  /**
   * Generate a fake but valid-looking commit hash for testing
   */
  generateFakeCommitHash() {
    const hash = randomBytes(20).toString('hex');
    logger.debug(`Generated fake commit hash: ${hash}`);
    return hash;
  }

  /**
   * Build component messages - FLAT structure matching real scanner
   * All FILE components are direct children of the PROJECT component
   */
  buildComponents() {
    logger.info('Building component messages...');

    const componentsMap = new Map();

    // Add root project component
    const project = this.data.project.project;
    componentsMap.set(project.key, {
      ref: this.getComponentRef(project.key),
      type: 1, // ComponentType.PROJECT
      childRef: [],
      key: this.sonarCloudConfig.projectKey || project.key
    });

    // Build a set of source file keys for validation
    const sourceKeys = new Set(this.data.sources.map(s => s.key));

    // Build a map from source key to language and line count
    const sourceInfo = new Map();
    this.data.sources.forEach(source => {
      sourceInfo.set(source.key, {
        language: source.language || '',
        lineCount: source.lines ? source.lines.length : 0
      });
    });

    // Add file components from extracted components (skip directories)
    // Only include files that have source code available
    this.data.components.forEach(comp => {
      if (comp.qualifier === 'FIL' && sourceKeys.has(comp.key)) {
        const ref = this.getComponentRef(comp.key);
        const info = sourceInfo.get(comp.key) || {};
        // IMPORTANT: Use actual source file line count, NOT the SonarQube measures value.
        // The measures API may report a different line count than what the source API returns.
        const lineCount = info.lineCount || Number.parseInt(comp.measures.find(m => m.metric === 'lines')?.value) || 0;
        componentsMap.set(comp.key, {
          ref: ref,
          type: 4, // ComponentType.FILE
          language: comp.language || info.language || '',
          lines: lineCount,
          status: 3, // FileStatus.ADDED
          projectRelativePath: comp.path || comp.name
        });
      }
    });

    // Also add source files that aren't in the components list
    this.data.sources.forEach(source => {
      if (source.key && !componentsMap.has(source.key)) {
        const componentName = source.key.split(':').pop() || source.key;
        const lineCount = source.lines ? source.lines.length : 0;
        componentsMap.set(source.key, {
          ref: this.getComponentRef(source.key),
          type: 4, // ComponentType.FILE
          language: source.language || '',
          lines: lineCount,
          status: 3, // FileStatus.ADDED
          projectRelativePath: componentName
        });
      }
    });

    // Store valid component keys for issue filtering
    this.validComponentKeys = new Set(componentsMap.keys());

    // FLAT structure: all files are direct children of PROJECT
    const projectComponent = Array.from(componentsMap.values()).find(c => c.type === 1);
    componentsMap.forEach((component) => {
      if (component.type === 4 && projectComponent) { // FILE
        projectComponent.childRef.push(component.ref);
      }
    });

    const components = Array.from(componentsMap.values());
    logger.info(`Built ${components.length} component messages (1 PROJECT + ${components.length - 1} FILES, flat structure)`);
    return components;
  }

  /**
   * Build issue messages - using Issue proto fields exactly
   */
  buildIssues() {
    logger.info('Building issue messages...');

    const issuesByComponent = new Map();
    let skippedIssues = 0;

    this.data.issues.forEach(issue => {
      // Skip issues for components we don't have source code for
      if (!this.validComponentKeys?.has(issue.component)) {
        skippedIssues++;
        return;
      }
      const componentRef = this.componentRefMap.get(issue.component);

      if (!issuesByComponent.has(componentRef)) {
        issuesByComponent.set(componentRef, []);
      }

      // Parse rule repository and key
      const ruleParts = issue.rule.split(':');
      const ruleRepository = ruleParts[0] || '';
      const ruleKey = ruleParts[1] || issue.rule;

      // Issue message matching the real scanner format exactly
      // NOTE: gap is NOT the same as SonarQube's effort field.
      // Gap is a scanner-computed value; since we're not running a real scan, leave it at 0.
      const issueMsg = {
        ruleRepository: ruleRepository,
        ruleKey: ruleKey,
        msg: issue.message || '',
        overriddenSeverity: this.mapSeverity(issue.severity),
      };

      // Add text range if available
      if (issue.textRange) {
        issueMsg.textRange = {
          startLine: issue.textRange.startLine,
          endLine: issue.textRange.endLine,
          startOffset: issue.textRange.startOffset || 0,
          endOffset: issue.textRange.endOffset || 0
        };
      }

      issuesByComponent.get(componentRef).push(issueMsg);
    });

    if (skippedIssues > 0) {
      logger.warn(`Skipped ${skippedIssues} issues (components without source code)`);
    }
    logger.info(`Built ${this.data.issues.length - skippedIssues} issue messages across ${issuesByComponent.size} components`);
    return issuesByComponent;
  }

  /**
   * Build measure messages - only for FILE components (no project measures)
   * Real scanner does NOT create measures-1.pb for the project component.
   */
  buildMeasures() {
    logger.info('Building measure messages...');

    const measuresByComponent = new Map();

    // NOTE: Do NOT add project measures - real scanner doesn't include measures-1.pb

    // Add component measures - ONLY for FILE components (skip directories and project)
    this.data.components.forEach(comp => {
      if (comp.qualifier !== 'FIL') return;

      // Only create measures for components that already have refs (from buildComponents)
      if (!this.componentRefMap.has(comp.key)) return;

      const componentRef = this.componentRefMap.get(comp.key);
      const measures = comp.measures.map(m => this.buildMeasure(m));

      if (measures.length > 0) {
        measuresByComponent.set(componentRef, measures);
      }
    });

    let totalMeasures = 0;
    measuresByComponent.forEach(measures => {
      totalMeasures += measures.length;
    });

    logger.info(`Built ${totalMeasures} measure messages across ${measuresByComponent.size} components`);
    return measuresByComponent;
  }

  /**
   * Build a single measure message matching real scanner format.
   * SonarQube API returns all values as strings, so we must parse them
   * into the correct protobuf types (intValue, doubleValue, stringValue).
   */
  buildMeasure(measure) {
    const msg = {
      metricKey: measure.metric
    };

    const rawValue = measure.value;

    // Metrics that are always string-valued (contain non-numeric data)
    const stringMetrics = new Set([
      'alert_status', 'quality_gate_details',
      'executable_lines_data', 'ncloc_data',
      'conditions_by_line', 'covered_conditions_by_line',
      'it_conditions_by_line', 'it_covered_conditions_by_line'
    ]);

    if (stringMetrics.has(measure.metric)) {
      msg.stringValue = { value: String(rawValue) };
    } else if (typeof rawValue === 'boolean') {
      msg.booleanValue = { value: rawValue };
    } else {
      Object.assign(msg, this.parseMeasureValue(rawValue));
    }

    return msg;
  }

  /**
   * Parse a raw measure value into the correct protobuf value wrapper.
   * SonarQube API returns all numeric values as strings, so we must detect the type.
   */
  parseMeasureValue(rawValue) {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed) || rawValue === '' || rawValue === null || rawValue === undefined) {
      return { stringValue: { value: String(rawValue) } };
    }
    if (Number.isInteger(parsed)) {
      if (parsed >= -2147483648 && parsed <= 2147483647) {
        return { intValue: { value: parsed } };
      }
      return { longValue: { value: parsed } };
    }
    return { doubleValue: { value: parsed } };
  }

  /**
   * Build source file messages
   */
  buildSourceFiles() {
    logger.info('Building source file messages...');

    const sourceFiles = [];

    this.data.sources.forEach(source => {
      // Only include sources for components that have refs from buildComponents
      if (!this.componentRefMap.has(source.key)) return;
      const componentRef = this.componentRefMap.get(source.key);

      const lines = source.lines.map((lineContent, index) => ({
        line: index + 1,
        source: lineContent
      }));

      sourceFiles.push({
        componentRef: componentRef,
        lines
      });
    });

    logger.info(`Built ${sourceFiles.length} source file messages`);
    return sourceFiles;
  }

  /**
   * Build active rules messages.
   * Fixes:
   * - ruleKey must NOT include repo prefix (e.g., "S121" not "javascript:S121")
   * - qProfileKey must use SonarCloud profile keys, not SonarQube keys
   */
  buildActiveRules() {
    logger.info('Building active rules messages...');

    // Build a map from language to SonarCloud profile key
    const langToSCProfileKey = new Map();
    if (this.sonarCloudProfiles?.length > 0) {
      this.sonarCloudProfiles.forEach(p => {
        langToSCProfileKey.set(p.language.toLowerCase(), p.key);
      });
    }

    const activeRules = [];

    this.data.activeRules.forEach(rule => {
      // Strip repo prefix from ruleKey if present (e.g., "javascript:S121" -> "S121")
      let ruleKey = rule.ruleKey;
      if (ruleKey?.includes(':')) {
        ruleKey = ruleKey.split(':').pop();
      }

      // Map qProfileKey to SonarCloud profile key using the rule's language
      let qProfileKey = rule.qProfileKey;
      if (rule.language && langToSCProfileKey.has(rule.language.toLowerCase())) {
        qProfileKey = langToSCProfileKey.get(rule.language.toLowerCase());
      }

      const activeRule = {
        ruleRepository: rule.ruleRepository,
        ruleKey: ruleKey,
        severity: rule.severity,
        paramsByKey: rule.paramsByKey || {},
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
        qProfileKey: qProfileKey,
      };

      // Only include impacts if non-empty
      if (rule.impacts?.length > 0) {
        activeRule.impacts = rule.impacts.map(impact => ({
          softwareQuality: impact.softwareQuality,
          severity: impact.severity
        }));
      }

      activeRules.push(activeRule);
    });

    logger.info(`Built ${activeRules.length} active rule messages`);
    return activeRules;
  }

  /**
   * Get or create component reference number
   */
  getComponentRef(componentKey) {
    if (!this.componentRefMap.has(componentKey)) {
      this.componentRefMap.set(componentKey, this.nextRef++);
    }
    return this.componentRefMap.get(componentKey);
  }

  /**
   * Build quality profiles map for each language using real SonarCloud profile keys
   */
  buildQProfiles() {
    const qprofiles = {};

    // Get unique languages from source files and active rules
    const languages = [...new Set([
      ...this.data.activeRules.map(r => r.language).filter(Boolean),
      ...this.data.sources.map(s => s.language).filter(Boolean)
    ])];

    languages.forEach(language => {
      const languageKey = language.toLowerCase();

      // Find matching SonarCloud profile for this language
      const scProfile = this.sonarCloudProfiles.find(p => p.language === languageKey);

      if (scProfile) {
        qprofiles[languageKey] = {
          key: scProfile.key,
          name: scProfile.name,
          language: languageKey,
          rulesUpdatedAt: new Date(scProfile.rulesUpdatedAt).getTime()
        };
        logger.debug(`QProfile for ${languageKey}: ${scProfile.key} (${scProfile.name})`);
      } else {
        // Fallback: generate a key if no SonarCloud profile found
        qprofiles[languageKey] = {
          key: `default-${languageKey}`,
          name: 'Sonar way',
          language: languageKey,
          rulesUpdatedAt: Date.now()
        };
        logger.warn(`No SonarCloud profile found for language: ${languageKey}, using fallback`);
      }
    });

    return qprofiles;
  }

  /**
   * Build plugins map
   */
  buildPlugins() {
    return {
      'javascript': {
        key: 'javascript',
        updatedAt: Date.now()
      }
    };
  }

  /**
   * Build file counts by type
   */
  buildFileCountsByType() {
    const counts = {};

    this.data.sources.forEach(source => {
      const lang = source.language || 'unknown';
      counts[lang] = (counts[lang] || 0) + 1;
    });

    return counts;
  }

  /**
   * Map SonarQube severity to protobuf enum
   * Severity enum: UNSET_SEVERITY=0, INFO=1, MINOR=2, MAJOR=3, CRITICAL=4, BLOCKER=5
   */
  mapSeverity(severity) {
    const severityMap = {
      'INFO': 1,
      'MINOR': 2,
      'MAJOR': 3,
      'CRITICAL': 4,
      'BLOCKER': 5
    };
    return severityMap[severity] || 3;
  }

  /**
   * Build changeset messages (SCM blame data)
   * Only for components that have component-{ref}.pb files
   */
  buildChangesets() {
    logger.info('Building changeset messages...');

    const changesetsByComponent = new Map();
    let totalChangesets = 0;

    this.data.changesets.forEach((changesetData, componentKey) => {
      // Only create changesets for components that already have refs
      if (!this.componentRefMap.has(componentKey)) return;
      const componentRef = this.componentRefMap.get(componentKey);

      const changeset = {
        componentRef: componentRef,
        changeset: changesetData.changesets.map(cs => ({
          revision: cs.revision,
          author: cs.author,
          date: cs.date
        })),
        changesetIndexByLine: changesetData.changesetIndexByLine || []
      };

      changesetsByComponent.set(componentRef, changeset);
      totalChangesets++;
    });

    logger.info(`Built ${totalChangesets} changeset messages`);
    return changesetsByComponent;
  }

  /**
   * Build all messages
   */
  buildAll() {
    logger.info('Building all protobuf messages...');

    try {
      const messages = {
        metadata: this.buildMetadata(),
        components: this.buildComponents(),
        issuesByComponent: this.buildIssues(),
        measuresByComponent: this.buildMeasures(),
        sourceFiles: this.buildSourceFiles(),
        activeRules: this.buildActiveRules(),
        changesetsByComponent: this.buildChangesets(),
      };

      logger.info('Successfully built all protobuf messages');
      return messages;

    } catch (error) {
      throw new ProtobufEncodingError(`Failed to build protobuf messages: ${error.message}`);
    }
  }
}
