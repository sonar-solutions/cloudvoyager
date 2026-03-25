import logger from '../../../../../shared/utils/logger.js';

// -------- Build Changesets --------

/** Build changeset messages from extracted changeset data. */
export function buildChangesets(inst) {
  logger.info('Building changeset messages...');
  const changesetsByComponent = new Map();
  let totalChangesets = 0;

  inst.data.changesets.forEach((changesetData, componentKey) => {
    if (!inst.componentRefMap.has(componentKey)) return;
    const componentRef = inst.componentRefMap.get(componentKey);
    changesetsByComponent.set(componentRef, {
      componentRef,
      changeset: changesetData.changesets.map(cs => ({ revision: cs.revision, author: cs.author, date: cs.date })),
      changesetIndexByLine: changesetData.changesetIndexByLine || [],
    });
    totalChangesets++;
  });

  logger.info(`Built ${totalChangesets} changeset messages`);
  return changesetsByComponent;
}
