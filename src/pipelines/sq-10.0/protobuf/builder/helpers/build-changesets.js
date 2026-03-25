import logger from '../../../../../shared/utils/logger.js';

// -------- Changeset Builder --------

export function buildChangesets(ctx) {
  logger.info('Building changeset messages...');
  const changesetsByComponent = new Map();
  let totalChangesets = 0;
  ctx.data.changesets.forEach((changesetData, componentKey) => {
    if (!ctx.componentRefMap.has(componentKey)) return;
    const componentRef = ctx.componentRefMap.get(componentKey);
    const changeset = {
      componentRef,
      changeset: changesetData.changesets.map(cs => ({ revision: cs.revision, author: cs.author, date: cs.date })),
      changesetIndexByLine: changesetData.changesetIndexByLine || [],
    };
    changesetsByComponent.set(componentRef, changeset);
    totalChangesets++;
  });
  logger.info(`Built ${totalChangesets} changeset messages`);
  return changesetsByComponent;
}
