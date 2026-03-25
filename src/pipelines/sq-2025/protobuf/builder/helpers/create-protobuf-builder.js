import { attachBuildMethods } from './attach-build-methods.js';

// -------- Create Protobuf Builder --------

/** Factory function: create a ProtobufBuilder instance. */
export function createProtobufBuilder(extractedData, sonarCloudConfig = {}, sonarCloudProfiles = [], options = {}) {
  const inst = {
    data: extractedData,
    sonarCloudConfig,
    sonarCloudProfiles,
    componentRefMap: new Map(),
    nextRef: 1,
    sonarCloudBranchName: options.sonarCloudBranchName || null,
    referenceBranchName: options.referenceBranchName || null,
    sonarCloudRepos: options.sonarCloudRepos || new Set(),
    ruleEnrichmentMap: options.ruleEnrichmentMap || new Map(),
  };

  inst.getComponentRef = (key) => {
    if (!inst.componentRefMap.has(key)) inst.componentRefMap.set(key, inst.nextRef++);
    return inst.componentRefMap.get(key);
  };

  inst.mapSeverity = (sev) => ({ 'INFO': 1, 'MINOR': 2, 'MAJOR': 3, 'CRITICAL': 4, 'BLOCKER': 5 }[sev] || 3);

  attachBuildMethods(inst);
  return inst;
}
