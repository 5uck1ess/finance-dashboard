const { FinanceDashboard } = require('../js/app');

describe('FinanceDashboard Application Logic', () => {
  let dashboard;

  beforeEach(() => {
    jest.spyOn(FinanceDashboard.prototype, 'init').mockImplementation(() => Promise.resolve());
    dashboard = new FinanceDashboard();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Stock Categorization', () => {
    test('categorizes symbols based on type', () => {
      expect(dashboard.getCategory('AAPL')).toBe('stock');
      expect(dashboard.getCategory('BTC')).toBe('crypto');
      expect(dashboard.getCategory('SPY')).toBe('etf');
    });

    test('handles case-insensitive inputs', () => {
      expect(dashboard.getCategory('btc')).toBe('crypto');
      expect(dashboard.getCategory('spy')).toBe('etf');
      expect(dashboard.getCategory('aapl')).toBe('stock');
    });

    test('groups stocks into category buckets', () => {
      const grouped = dashboard.groupStocksByCategory(['AAPL', 'MSFT', 'BTC', 'ETH', 'SPY']);
      expect(grouped.stocks).toEqual(['AAPL', 'MSFT']);
      expect(grouped.crypto).toEqual(['BTC', 'ETH']);
      expect(grouped.etf).toEqual(['SPY']);
    });

    test('does not re-add placeholder symbols when user already has a list', () => {
      dashboard.stocks = ['CUSTOM'];
      dashboard.saveStocks = jest.fn();
      dashboard.config = {
        stocks: ['AAPL', 'MSFT'],
        cryptos: ['BTC'],
        etfs: ['SPY']
      };

      dashboard.applyConfigDefaults();

      expect(dashboard.stocks).toEqual(['CUSTOM']);
      expect(dashboard.saveStocks).not.toHaveBeenCalled();
    });
  });

  describe('Market Status Detection', () => {
    test('identifies open market hours', () => {
      const status = dashboard.isMarketOpen(new Date('2024-01-15T15:00:00Z'));
      expect(status).toEqual({ status: 'open', text: 'Market Open' });
    });

    test('identifies pre-market, after-hours, and weekend states', () => {
      expect(dashboard.isMarketOpen(new Date('2024-01-15T13:00:00Z'))).toEqual({ status: 'pre-post', text: 'Pre-Market' });
      expect(dashboard.isMarketOpen(new Date('2024-01-15T22:00:00Z'))).toEqual({ status: 'pre-post', text: 'After-Hours' });
      const weekend = dashboard.isMarketOpen(new Date('2024-01-13T15:00:00Z'));
      expect(weekend.status).toBe('closed');
      expect(weekend.text).toContain('Weekend');
    });
  });

  describe('Number Formatting', () => {
    test('formats magnitudes with suffixes', () => {
      expect(dashboard.formatNumber(1_500_000_000)).toBe('1.50B');
      expect(dashboard.formatNumber(5_000_000)).toBe('5.00M');
      expect(dashboard.formatNumber(2_500)).toBe('2.50K');
    });

    test('formats small and negative numbers', () => {
      expect(dashboard.formatNumber(100)).toBe('100.00');
      expect(dashboard.formatNumber(-1000)).toBe('-1000.00');
    });
  });

  describe('Rating Classification', () => {
    test('maps qualitative ratings to css classes', () => {
      expect(dashboard.getRatingClass('Strong Buy')).toBe('rating-buy');
      expect(dashboard.getRatingClass('sell')).toBe('rating-sell');
      expect(dashboard.getRatingClass('Neutral')).toBe('rating-hold');
      expect(dashboard.getRatingClass('N/A')).toBe('');
    });
  });

  describe('Last Updated Messaging', () => {
    const now = new Date('2024-01-01T12:00:00Z');

    test('handles missing timestamps', () => {
      expect(dashboard.getLastUpdatedText(null, now)).toBe('Last updated: Never');
    });

    test('renders relative timestamps with pluralization', () => {
      expect(dashboard.getLastUpdatedText(new Date(now - 30 * 1000), now)).toBe('Last updated: just now');
      expect(dashboard.getLastUpdatedText(new Date(now - 3 * 60 * 1000), now)).toBe('Last updated: 3 mins ago');
      expect(dashboard.getLastUpdatedText(new Date(now - 2 * 60 * 60 * 1000), now)).toBe('Last updated: 2 hours ago');
      expect(dashboard.getLastUpdatedText(new Date(now - 2 * 24 * 60 * 60 * 1000), now)).toBe('Last updated: 2 days ago');
    });
  });

  describe('Cache Snapshot Persistence', () => {
    test('preserves existing analyst recommendation when incoming payload is N/A', () => {
      dashboard.storage = {
        getCachedData: jest.fn().mockReturnValue({
          stocks: [{
            symbol: 'AAPL',
            recommendation: 'Buy',
            recommendationDetails: { counts: { buy: 10, hold: 2 }, period: '2026-01' }
          }],
          crypto: [],
          etfs: [],
          lastUpdated: '2026-02-01T00:00:00.000Z'
        }),
        saveCachedData: jest.fn()
      };

      dashboard.persistCacheSnapshot({
        stocks: [{
          symbol: 'AAPL',
          price: 201.5,
          recommendation: 'N/A',
          recommendationDetails: null
        }],
        crypto: [],
        etfs: []
      }, '2026-02-06T00:00:00.000Z');

      expect(dashboard.storage.saveCachedData).toHaveBeenCalledWith(expect.objectContaining({
        stocks: [expect.objectContaining({
          symbol: 'AAPL',
          recommendation: 'Buy',
          recommendationDetails: expect.objectContaining({ period: '2026-01' })
        })]
      }));
    });
  });
});
