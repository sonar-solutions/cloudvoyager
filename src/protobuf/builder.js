import { randomBytes } from 'node:crypto';
import logger from '../utils/logger.js';
import { ProtobufEncodingError } from '../utils/errors.js';
import { buildComponents } from './build-components.js';
import { buildIssues } from './build-issues.js';
import { buildMeasures, buildMeasure, parseMeasureValue } from './build-measures.js';

export class ProtobufBuilder {
  constructor(extractedData, sonarCloudConfig = {}, sonarCloudProfiles = [], options = {}) {
    this.data = extractedData;
    this.sonarCloudConfig = sonarCloudConfig;
    this.sonarCloudProfiles = sonarCloudProfiles;
    this.componentRefMap = new Map();
    this.nextRef = 1;
    this.sonarCloudBranchName = options.sonarCloudBranchName || null;
  }

  buildMetadata() {
    const project = this.data.project.project;
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
      branchType: 1,
      referenceBranchName: branchName,
      scmRevisionId: this.data.metadata.scmRevisionId || this.generateFakeCommitHash(),
      projectVersion: '1.0.0',
      analyzedIndexedFileCountPerType: this.buildFileCountsByType(),
    };
    logger.debug(`Metadata built: projectKey=${metadata.projectKey}, branch=${metadata.branchName}, scmRevisionId=${metadata.scmRevisionId}`);
    return metadata;
  }

  generateFakeCommitHash() {
    const hash = randomBytes(20).toString('hex');
    logger.debug(`Generated fake commit hash: ${hash}`);
    return hash;
  }

  buildComponents() { return buildComponents(this); }
  buildIssues() { return buildIssues(this); }
  buildMeasures() { return buildMeasures(this); }
  buildMeasure(measure) { return buildMeasure(measure); }
  parseMeasureValue(rawValue) { return parseMeasureValue(rawValue); }

  buildSourceFiles() {
    logger.info('Building source file messages...');
    const sourceFiles = [];
    this.data.sources.forEach(source => {
      if (!this.componentRefMap.has(source.key)) return;
      const componentRef = this.componentRefMap.get(source.key);
      const lines = source.lines.map((lineContent, index) => ({ line: index + 1, source: lineContent }));
      sourceFiles.push({ componentRef, lines });
    });
    logger.info(`Built ${sourceFiles.length} source file messages`);
    return sourceFiles;
  }

  buildActiveRules() {
    logger.info('Building active rules messages...');
    const langToSCProfileKey = new Map();
    if (this.sonarCloudProfiles?.length > 0) {
      this.sonarCloudProfiles.forEach(p => { langToSCProfileKey.set(p.language.toLowerCase(), p.key); });
    }
    const activeRules = [];
    this.data.activeRules.forEach(rule => {
      let ruleKey = rule.ruleKey;
      if (ruleKey?.includes(':')) ruleKey = ruleKey.split(':').pop();
      let qProfileKey = rule.qProfileKey;
      if (rule.language && langToSCProfileKey.has(rule.language.toLowerCase())) {
        qProfileKey = langToSCProfileKey.get(rule.language.toLowerCase());
      }
      const activeRule = {
        ruleRepository: rule.ruleRepository, ruleKey, severity: rule.severity,
        paramsByKey: rule.paramsByKey || {}, createdAt: rule.createdAt,
        updatedAt: rule.updatedAt, qProfileKey,
      };
      if (rule.impacts?.length > 0) {
        activeRule.impacts = rule.impacts.map(impact => ({ softwareQuality: impact.softwareQuality, severity: impact.severity }));
      }
      activeRules.push(activeRule);
    });
    logger.info(`Built ${activeRules.length} active rule messages`);
    return activeRules;
  }

  getComponentRef(componentKey) {
    if (!this.componentRefMap.has(componentKey)) {
      this.componentRefMap.set(componentKey, this.nextRef++);
    }
    return this.componentRefMap.get(componentKey);
  }

  buildQProfiles() {
    const qprofiles = {};
    const languages = [...new Set([
      ...this.data.activeRules.map(r => r.language).filter(Boolean),
      ...this.data.sources.map(s => s.language).filter(Boolean)
    ])];
    languages.forEach(language => {
      const languageKey = language.toLowerCase();
      const scProfile = this.sonarCloudProfiles.find(p => p.language === languageKey);
      if (scProfile) {
        qprofiles[languageKey] = {
          key: scProfile.key, name: scProfile.name, language: languageKey,
          rulesUpdatedAt: new Date(scProfile.rulesUpdatedAt).getTime()
        };
        logger.debug(`QProfile for ${languageKey}: ${scProfile.key} (${scProfile.name})`);
      } else {
        qprofiles[languageKey] = { key: `default-${languageKey}`, name: 'Sonar way', language: languageKey, rulesUpdatedAt: Date.now() };
        logger.warn(`No SonarCloud profile found for language: ${languageKey}, using fallback`);
      }
    });
    return qprofiles;
  }

  buildPlugins() {
    return { 'javascript': { key: 'javascript', updatedAt: Date.now() } };
  }

  buildFileCountsByType() {
    const counts = {};
    this.data.sources.forEach(source => {
      const lang = source.language || 'unknown';
      counts[lang] = (counts[lang] || 0) + 1;
    });
    return counts;
  }

  mapSeverity(severity) {
    const severityMap = { 'INFO': 1, 'MINOR': 2, 'MAJOR': 3, 'CRITICAL': 4, 'BLOCKER': 5 };
    return severityMap[severity] || 3;
  }

  buildChangesets() {
    logger.info('Building changeset messages...');
    const changesetsByComponent = new Map();
    let totalChangesets = 0;
    this.data.changesets.forEach((changesetData, componentKey) => {
      if (!this.componentRefMap.has(componentKey)) return;
      const componentRef = this.componentRefMap.get(componentKey);
      const changeset = {
        componentRef,
        changeset: changesetData.changesets.map(cs => ({ revision: cs.revision, author: cs.author, date: cs.date })),
        changesetIndexByLine: changesetData.changesetIndexByLine || []
      };
      changesetsByComponent.set(componentRef, changeset);
      totalChangesets++;
    });
    logger.info(`Built ${totalChangesets} changeset messages`);
    return changesetsByComponent;
  }

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
