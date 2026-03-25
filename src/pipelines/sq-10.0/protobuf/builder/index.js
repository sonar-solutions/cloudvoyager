import { bindBuilderMethods } from './helpers/bind-builder-methods.js';

// -------- Factory Function --------

export function createProtobufBuilder(extractedData, scConfig = {}, scProfiles = [], options = {}) {
  const ctx = {
    data: extractedData, sonarCloudConfig: scConfig, sonarCloudProfiles: scProfiles,
    componentRefMap: new Map(), nextRef: 1,
    sonarCloudBranchName: options.sonarCloudBranchName || null,
    referenceBranchName: options.referenceBranchName || null,
    sonarCloudRepos: options.sonarCloudRepos || new Set(),
    ruleEnrichmentMap: options.ruleEnrichmentMap || new Map(),
  };
  bindBuilderMethods(ctx);
  return ctx;
}

// -------- Class Wrapper (backward compat) --------

export class ProtobufBuilder {
  constructor(extractedData, scConfig = {}, scProfiles = [], options = {}) {
    Object.assign(this, createProtobufBuilder(extractedData, scConfig, scProfiles, options));
  }
}
