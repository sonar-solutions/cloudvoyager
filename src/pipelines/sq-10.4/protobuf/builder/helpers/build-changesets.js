import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Build changeset messages from extracted SCM data.
export function buildChangesets(instance) {
  logger.info('Building changeset messages...');
  const changesetsByComponent = new Map();
  let totalChangesets = 0;

  instance.data.changesets.forEach((changesetData, componentKey) => {
    if (!instance.componentRefMap.has(componentKey)) return;
    const componentRef = instance.componentRefMap.get(componentKey);
    changesetsByComponent.set(componentRef, {
      componentRef,
      changeset: changesetData.changesets.map(cs => ({ revision: cs.revision, author: cs.author, date: cs.date })),
      changesetIndexByLine: changesetData.changesetIndexByLine || []
    });
    totalChangesets++;
  });

  logger.info(`Built ${totalChangesets} changeset messages`);
  return changesetsByComponent;
}
