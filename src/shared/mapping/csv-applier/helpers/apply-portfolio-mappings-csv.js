// -------- Apply Portfolio Mappings CSV Filter --------
import { isIncluded } from '../../csv-reader.js';
import logger from '../../../utils/logger.js';

export function applyPortfolioMappingsCsv(csvData, portfolios) {
  if (!portfolios) return portfolios;

  const portfolioRows = new Map();
  for (const row of csvData.rows) {
    const key = row['Portfolio Key'];
    if (!portfolioRows.has(key)) portfolioRows.set(key, []);
    portfolioRows.get(key).push(row);
  }

  let excludedCount = 0;
  const result = [];

  for (const portfolio of portfolios) {
    const rows = portfolioRows.get(portfolio.key);
    if (!rows) { result.push(portfolio); continue; }
    const headerRow = rows.find(r => !r['Member Project Key']);
    if (headerRow && !isIncluded(headerRow['Include'])) { excludedCount++; continue; }
    const memberRows = rows.filter(r => r['Member Project Key']);
    const newProjects = [];
    for (const mr of memberRows) {
      if (!isIncluded(mr['Include'])) continue;
      newProjects.push({ key: mr['Member Project Key'], name: mr['Member Project Name'] });
    }
    result.push({ ...portfolio, projects: newProjects });
  }

  if (excludedCount > 0) logger.info(`CSV override: excluded ${excludedCount} portfolio(s)`);
  return result;
}
