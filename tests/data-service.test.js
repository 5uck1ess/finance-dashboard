const { DataService } = require('../server/services/data-service');

describe('DataService', () => {
  test('preserves cached analyst fields on force refresh when recommendations are skipped', async () => {
    const service = new DataService({
      settings: { cacheExpiry: { stocks: 1000 } }
    }, {});

    service.cache.set('equity-AAPL', {
      symbol: 'AAPL',
      price: 150,
      recommendation: 'Buy',
      recommendationDetails: { counts: { buy: 8 }, period: '2026-03-01' }
    }, 1000);

    jest.spyOn(service, 'fetchStockQuote').mockResolvedValue({
      symbol: 'AAPL',
      price: 155,
      provider: 'yahooFinance'
    });

    const results = await service.getEquityQuotes(['AAPL'], {
      forceRefresh: true,
      includeRecommendation: false
    });

    expect(results).toEqual([{
      success: true,
      data: expect.objectContaining({
        symbol: 'AAPL',
        price: 155,
        recommendation: 'Buy',
        recommendationDetails: expect.objectContaining({ period: '2026-03-01' })
      })
    }]);
  });
});
