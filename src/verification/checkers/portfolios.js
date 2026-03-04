import logger from '../../utils/logger.js';

/**
 * Verify portfolios between SonarQube and SonarCloud.
 * Note: SC portfolio APIs may differ (Enterprise V2 API).
 * This performs a best-effort check.
 *
 * @param {object} sqClient - SonarQube client
 * @returns {Promise<object>} Check result with SQ portfolio data for reference
 */
export async function verifyPortfolios(sqClient) {
  const result = {
    status: 'skipped',
    sqCount: 0,
    details: 'Portfolio verification requires Enterprise API access. SQ portfolios listed for reference.',
    sqPortfolios: []
  };

  try {
    const portfolios = await sqClient.getPortfolios();
    result.sqCount = portfolios.length;
    result.sqPortfolios = portfolios.map(p => ({
      key: p.key,
      name: p.name,
      qualifier: p.qualifier
    }));
  } catch (error) {
    logger.debug(`Failed to get SQ portfolios: ${error.message}`);
  }

  logger.info(`Portfolio verification: ${result.sqCount} SQ portfolios found (SC verification skipped — requires Enterprise API)`);
  return result;
}
