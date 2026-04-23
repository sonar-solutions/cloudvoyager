// -------- Compute Batch Date --------

const DAYS_BETWEEN_BATCHES = 30;

/** Compute an ISO date string for a batch, going backwards from the base date. */
export function computeBatchDate(baseDateISO, batchIndex, totalBatches) {
  if (totalBatches <= 1) return baseDateISO;

  const baseDate = new Date(baseDateISO);
  if (isNaN(baseDate.getTime())) throw new Error(`Invalid base date: ${baseDateISO}`);
  const daysBack = (totalBatches - 1 - batchIndex) * DAYS_BETWEEN_BATCHES;
  const batchDate = new Date(baseDate);

  batchDate.setDate(baseDate.getDate() - daysBack);

  return batchDate.toISOString();
}
