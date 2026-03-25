import logger from '../../../../../shared/utils/logger.js';

// -------- Build Changeset Messages --------

export function buildChangesets(ctx) {
  logger.info('Building changeset messages...');
  const changesetsByComponent = new Map();
  let total = 0;

  ctx.data.changesets.forEach((changesetData, componentKey) => {
    if (!ctx.componentRefMap.has(componentKey)) return;
    const componentRef = ctx.componentRefMap.get(componentKey);
    changesetsByComponent.set(componentRef, {
      componentRef,
      changeset: changesetData.changesets.map(cs => ({ revision: cs.revision, author: cs.author, date: cs.date })),
      changesetIndexByLine: changesetData.changesetIndexByLine || [],
    });
    total++;
  });

  logger.info(`Built ${total} changeset messages`);
  return changesetsByComponent;
}
