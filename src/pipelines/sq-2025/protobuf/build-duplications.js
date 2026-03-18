import logger from '../../../shared/utils/logger.js';

/**
 * Build Duplication protobuf messages from the extracted SonarQube duplication data.
 *
 * For each file with duplications, the SonarQube /api/duplications/show API returns
 * duplication groups with blocks and a files reference map. This function converts
 * that data into protobuf Duplication messages keyed by component ref.
 *
 * @param {ProtobufBuilder} builder - ProtobufBuilder instance (must have componentRefMap populated)
 * @returns {Map<number, object[]>} Map of componentRef → array of Duplication messages
 */
export function buildDuplications(builder) {
  logger.info('Building duplication messages...');

  const duplicationsMap = builder.data.duplications;
  if (!duplicationsMap || duplicationsMap.size === 0) {
    logger.info('No duplications to build');
    return new Map();
  }

  const duplicationsByComponent = new Map();
  let totalDuplications = 0;

  duplicationsMap.forEach((data, componentKey) => {
    const componentRef = builder.componentRefMap.get(componentKey);
    if (!componentRef) return;

    const duplications = [];
    const filesMap = data.files || {};

    // Find which _ref in the files map corresponds to the current component
    let currentFileRef = null;
    for (const [ref, fileInfo] of Object.entries(filesMap)) {
      if (fileInfo.key === componentKey) {
        currentFileRef = ref;
        break;
      }
    }

    if (!currentFileRef) {
      logger.debug(`Could not find current file ref for ${componentKey} in duplications response`);
      return;
    }

    data.duplications.forEach(dup => {
      const blocks = dup.blocks || [];
      if (blocks.length < 2) return;

      // Find the first block in the current file — this is the origin
      const originBlock = blocks.find(b => b._ref === currentFileRef);
      if (!originBlock) return;

      const originPosition = {
        startLine: originBlock.from,
        endLine: originBlock.from + originBlock.size - 1,
      };

      const duplicateEntries = [];

      blocks.forEach(block => {
        if (block === originBlock) return; // Skip the origin block itself

        const fileInfo = filesMap[block._ref];
        if (!fileInfo) return;

        let otherFileRef;
        if (block._ref === currentFileRef) {
          // Same-file duplication
          otherFileRef = 0;
        } else {
          // Cross-file duplication — look up the component ref
          const ref = builder.componentRefMap.get(fileInfo.key);
          if (ref === undefined) return; // File not in our component map, skip
          otherFileRef = ref;
        }

        duplicateEntries.push({
          otherFileRef,
          range: {
            startLine: block.from,
            endLine: block.from + block.size - 1,
          },
        });
      });

      if (duplicateEntries.length > 0) {
        duplications.push({
          originPosition,
          duplicate: duplicateEntries,
        });
      }
    });

    if (duplications.length > 0) {
      duplicationsByComponent.set(componentRef, duplications);
      totalDuplications += duplications.length;
    }
  });

  logger.info(`Built ${totalDuplications} duplication messages across ${duplicationsByComponent.size} components`);
  return duplicationsByComponent;
}
