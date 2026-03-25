// -------- Generate Portfolio Mappings CSV --------
import { toCsvRow } from './csv-utils.js';

export function generatePortfolioMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Include', 'Portfolio Key', 'Portfolio Name', 'Description', 'Visibility', 'Member Project Key', 'Member Project Name', 'Target Organization'])];
  if (resourceMappings?.portfoliosByOrg) {
    for (const [orgKey, portfolios] of resourceMappings.portfoliosByOrg) {
      for (const portfolio of portfolios) {
        rows.push(toCsvRow(['yes', portfolio.key, portfolio.name, portfolio.description || '', portfolio.visibility || 'public', '', '', orgKey]));
        if (portfolio.projects) {
          for (const project of portfolio.projects) {
            rows.push(toCsvRow(['yes', portfolio.key, portfolio.name, '', '', project.key, project.name, orgKey]));
          }
        }
      }
    }
  }
  return rows.join('\n') + '\n';
}
