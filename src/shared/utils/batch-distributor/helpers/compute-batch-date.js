// -------- Compute Batch Date --------

/** Compute an ISO date string for a batch, going backwards from the base date. */
export function computeBatchDate(baseDateISO, batchIndex, totalBatches) {
  if (totalBatches <= 1) return baseDateISO;

  const baseDate = new Date(baseDateISO);
  if (isNaN(baseDate.getTime())) throw new Error(`Invalid base date: ${baseDateISO}`);
  const daysBack = totalBatches - 1 - batchIndex;
  const batchDate = new Date(baseDate);

  batchDate.setDate(baseDate.getDate() - daysBack);

  return batchDate.toISOString();
}
