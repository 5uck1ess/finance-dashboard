const { FinanceDashboard } = require('../js/app');

describe('Finance Dashboard Integration Flows', () => {
  let dashboard;

  beforeEach(() => {
    jest.spyOn(FinanceDashboard.prototype, 'init').mockImplementation(() => Promise.resolve());
    dashboard = new FinanceDashboard();
    dashboard.config = { settings: { cacheExpiry: { stocks: 300000 } }, api: {} };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (document.getElementById?.mockReset) {
      document.getElementById.mockReset();
    }
  });

  test('init automatically loads data when snapshot and cache are unavailable', async () => {
    FinanceDashboard.prototype.init.mockRestore();
    const freshDashboard = new FinanceDashboard();
    jest.spyOn(freshDashboard, 'loadConfig').mockResolvedValue();
    jest.spyOn(freshDashboard, 'initializeServices').mockImplementation();
    jest.spyOn(freshDashboard, 'setupEventListeners').mockImplementation();
    jest.spyOn(freshDashboard, 'setupLifecycleHandlers').mockImplementation();
    jest.spyOn(freshDashboard, 'updateRecommendedRefreshLabel').mockImplementation();
    jest.spyOn(freshDashboard, 'loadSavedStocks').mockImplementation();
    jest.spyOn(freshDashboard, 'applyTheme').mockImplementation();
    jest.spyOn(freshDashboard, 'hydrateFromSnapshot').mockResolvedValue(false);
    jest.spyOn(freshDashboard, 'renderCachedData').mockImplementation();
    jest.spyOn(freshDashboard, 'updateMarketStatus').mockImplementation();
    jest.spyOn(freshDashboard, 'startLastUpdatedTimer').mockImplementation();
    jest.spyOn(freshDashboard, 'initAutoRefresh').mockImplementation();
    jest.spyOn(freshDashboard, 'refreshData').mockResolvedValue(true);
    freshDashboard.storage.getCachedData = jest.fn().mockReturnValue(null);
    freshDashboard.ui.showLoadingState = jest.fn();
    freshDashboard.ui.showLoadError = jest.fn();

    await freshDashboard.init();

    expect(freshDashboard.ui.showLoadingState).toHaveBeenCalledTimes(1);
    expect(freshDashboard.refreshData).toHaveBeenCalledTimes(1);
    expect(freshDashboard.ui.showLoadError).not.toHaveBeenCalled();
  });

  test('fetchEquityData returns and reuses cached quotes', async () => {
    const cachedQuote = { symbol: 'AAPL', price: 150, category: 'stock' };
    dashboard.cache.set('equity-AAPL', cachedQuote, 300000);
    const fetchSpy = jest.spyOn(dashboard, 'fetchStockQuote');

    const results = await dashboard.fetchEquityData(['AAPL']);

    expect(results).toEqual([{ success: true, data: cachedQuote }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('fetchEquityData caches fresh provider responses', async () => {
    dashboard.config.settings.cacheExpiry.stocks = 1000;

    const providerResponse = {
      symbol: 'MSFT',
      price: 250,
      changesPercentage: 1.5,
      name: 'Microsoft',
      exchange: 'NASDAQ',
      marketCap: 1_000_000,
      dayHigh: 255,
      dayLow: 240,
      volume: 500000,
      provider: 'finnhub',
      recommendation: 'Buy',
      recommendationDetails: { score: 4 },
    };

    jest.spyOn(dashboard, 'fetchStockQuote').mockResolvedValue(providerResponse);
    const cacheSpy = jest.spyOn(dashboard.cache, 'set');

    const results = await dashboard.fetchEquityData(['MSFT']);

    expect(results[0].success).toBe(true);
    expect(results[0].data).toMatchObject({
      symbol: 'MSFT',
      price: 250,
      category: 'stock',
      recommendation: 'Buy',
    });
    expect(cacheSpy).toHaveBeenCalledWith('equity-MSFT', expect.objectContaining({ symbol: 'MSFT', price: 250 }), 1000);
  });

  test('updatePortfolioSummary aggregates cached holdings into DOM totals', () => {
    const summaryElement = {
      classList: { add: jest.fn(), remove: jest.fn() },
      style: { removeProperty: jest.fn() },
    };
    const totals = {
      'total-value': { textContent: '' },
      'total-cost': { textContent: '' },
      'total-pl': { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } },
      'best-performer': { textContent: '' },
    };

    document.getElementById.mockImplementation((id) => {
      if (id === 'portfolio-summary') {
        return summaryElement;
      }
      return totals[id] || null;
    });

    dashboard.stocks = ['AAPL', 'MSFT'];
    dashboard.portfolio = {
      AAPL: { shares: 10, costBasis: 100 },
      MSFT: { shares: 5, costBasis: 200 },
    };
    dashboard.cache.set('equity-AAPL', { symbol: 'AAPL', price: 150 });
    dashboard.cache.set('equity-MSFT', { symbol: 'MSFT', price: 250 });

    dashboard.updatePortfolioSummary();

    expect(summaryElement.classList.remove).toHaveBeenCalledWith('hidden');
    expect(summaryElement.style.removeProperty).toHaveBeenCalledWith('display');
    expect(totals['total-value'].textContent).toBe('$2750.00');
    expect(totals['total-cost'].textContent).toBe('$2000.00');
    expect(totals['total-pl'].textContent).toContain('+$750.00');
    expect(totals['total-pl'].classList.add).toHaveBeenCalledWith('text-green-600', 'dark:text-green-400');
    expect(totals['best-performer'].textContent).toContain('AAPL');
  });

  test('updatePortfolioSummary uses local crypto cache entries', () => {
    const summaryElement = {
      classList: { add: jest.fn(), remove: jest.fn() },
      style: { removeProperty: jest.fn() },
    };
    const totals = {
      'total-value': { textContent: '' },
      'total-cost': { textContent: '' },
      'total-pl': { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } },
      'best-performer': { textContent: '' },
    };

    document.getElementById.mockImplementation((id) => {
      if (id === 'portfolio-summary') {
        return summaryElement;
      }
      return totals[id] || null;
    });

    dashboard.stocks = ['BTC'];
    dashboard.portfolio = {
      BTC: { shares: 2, costBasis: 10000 },
    };
    dashboard.cache.set('coingecko-BTC', { symbol: 'BTC', price: 30000, category: 'crypto' });

    dashboard.updatePortfolioSummary();

    expect(summaryElement.classList.remove).toHaveBeenCalledWith('hidden');
    expect(totals['total-value'].textContent).toBe('$60000.00');
    expect(totals['total-cost'].textContent).toBe('$20000.00');
    expect(totals['total-pl'].textContent).toContain('+$40000.00');
    expect(totals['best-performer'].textContent).toContain('BTC');
  });

  test('updatePortfolioSummary ranks best performer by percentage return', () => {
    const summaryElement = {
      classList: { add: jest.fn(), remove: jest.fn() },
      style: { removeProperty: jest.fn() },
    };
    const totals = {
      'total-value': { textContent: '' },
      'total-cost': { textContent: '' },
      'total-pl': { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } },
      'best-performer': { textContent: '' },
    };
    document.getElementById.mockImplementation((id) =>
      id === 'portfolio-summary' ? summaryElement : totals[id] || null
    );
    dashboard.stocks = ['BIG', 'SMALL', 'FREE'];
    dashboard.portfolio = {
      BIG: { shares: 100, costBasis: 100 },
      SMALL: { shares: 1, costBasis: 10 },
      FREE: { shares: 1, costBasis: 0 },
    };
    dashboard.cache.set('equity-BIG', { symbol: 'BIG', price: 110 });
    dashboard.cache.set('equity-SMALL', { symbol: 'SMALL', price: 20 });
    dashboard.cache.set('equity-FREE', { symbol: 'FREE', price: 1000 });

    dashboard.updatePortfolioSummary();

    expect(totals['best-performer'].textContent).toBe('SMALL: +100.00%');
  });

  test('updatePortfolioSummary resets best performer when no holding has a comparable basis', () => {
    const summaryElement = {
      classList: { add: jest.fn(), remove: jest.fn() },
      style: { removeProperty: jest.fn() },
    };
    const totals = {
      'total-value': { textContent: '' },
      'total-cost': { textContent: '' },
      'total-pl': { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } },
      'best-performer': { textContent: 'OLD: +10.00%' },
    };
    document.getElementById.mockImplementation((id) =>
      id === 'portfolio-summary' ? summaryElement : totals[id] || null
    );
    dashboard.stocks = ['FREE'];
    dashboard.portfolio = { FREE: { shares: 1, costBasis: 0 } };
    dashboard.cache.set('equity-FREE', { symbol: 'FREE', price: 100 });

    dashboard.updatePortfolioSummary();

    expect(totals['best-performer'].textContent).toBe('N/A');
  });

  test('cached data only counts when it belongs to a currently tracked symbol', () => {
    dashboard.stocks = ['AAPL'];

    expect(dashboard.hasCachedData({ stocks: [{ symbol: 'MSFT' }], crypto: [], etfs: [] })).toBe(false);
    expect(dashboard.hasCachedData({ stocks: [{ symbol: 'AAPL' }], crypto: [], etfs: [] })).toBe(true);
  });

  test('updateMarketStatus applies classes based on market state', () => {
    const statusTextEl = { textContent: '' };
    const statusElement = {
      classList: {
        remove: jest.fn(),
        add: jest.fn(),
      },
      querySelector: jest.fn(() => statusTextEl),
    };

    document.getElementById.mockImplementation((id) => (id === 'market-status' ? statusElement : null));
    jest.spyOn(dashboard, 'isMarketOpen').mockReturnValue({ status: 'open', text: 'Market Open' });

    dashboard.updateMarketStatus();

    expect(statusElement.classList.remove).toHaveBeenCalledWith('open', 'closed', 'pre-post');
    expect(statusElement.classList.add).toHaveBeenCalledWith('open');
    expect(statusTextEl.textContent).toBe('Market Open');
  });

  describe('Snapshot hydration', () => {
    beforeEach(() => {
      dashboard.backendAvailable = true;
      dashboard.config = {
        settings: { cacheExpiry: { stocks: 1000, crypto: 1000 } },
        cryptos: ['BTC'],
        etfs: ['SPY'],
      };
      dashboard.stocks = ['AAPL', 'SPY', 'BTC'];
    });

    test('hydrates dashboard from snapshot payload', async () => {
      const domMap = {
        'stocks-container': { innerHTML: '' },
        'crypto-container': { innerHTML: '' },
        'etf-container': { innerHTML: '' },
        'last-updated': { textContent: '' },
      };

      document.getElementById.mockImplementation((id) => domMap[id] || null);

      jest.spyOn(dashboard, 'renderStockCard').mockImplementation(() => {});
      jest.spyOn(dashboard, 'updatePortfolioSummary').mockImplementation(() => {});
      jest.spyOn(dashboard, 'updateDataSourceIndicator').mockImplementation(() => {});
      const cacheSpy = jest.spyOn(dashboard.cache, 'set');

      const snapshotPayload = {
        stocks: {
          results: [
            {
              success: true,
              data: { symbol: 'AAPL', price: 150, changesPercentage: 1.5, name: 'Apple', provider: 'finnhub' },
            },
            {
              success: true,
              data: { symbol: 'SPY', price: 410, changesPercentage: 0.5, name: 'SPDR', provider: 'finnhub' },
            },
          ],
          fetchedAt: '2024-01-01T10:00:00Z',
        },
        crypto: {
          results: [{ success: true, data: { symbol: 'BTC', price: 30000, changePercent: -2, provider: 'coingecko' } }],
          fetchedAt: '2024-01-01T10:01:00Z',
        },
        metadata: {
          updatedAt: '2024-01-01T10:02:00Z',
        },
      };

      jest.spyOn(dashboard, 'fetchFromApi').mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(snapshotPayload),
      });

      const hydrated = await dashboard.hydrateFromSnapshot();

      expect(hydrated).toBe(true);
      expect(dashboard.renderStockCard).toHaveBeenCalledTimes(3);
      expect(cacheSpy).toHaveBeenCalledWith(
        'equity-AAPL',
        expect.objectContaining({ symbol: 'AAPL', price: 150 }),
        1000
      );
      expect(cacheSpy).toHaveBeenCalledWith(
        'crypto-BTC',
        expect.objectContaining({ symbol: 'BTC', price: 30000 }),
        1000
      );
      expect(cacheSpy).toHaveBeenCalledWith(
        'coingecko-BTC',
        expect.objectContaining({ symbol: 'BTC', price: 30000 }),
        1000
      );
      expect(dashboard.lastUpdated.toISOString()).toBe(new Date('2024-01-01T10:02:00Z').toISOString());
      expect(dashboard.updatePortfolioSummary).toHaveBeenCalled();
      expect(dashboard.updateDataSourceIndicator).toHaveBeenCalled();
    });

    test('preserves cached analyst details when snapshot omits them for tracked symbols', async () => {
      const domMap = {
        'stocks-container': { innerHTML: '' },
        'crypto-container': { innerHTML: '' },
        'etf-container': { innerHTML: '' },
        'last-updated': { textContent: '' },
      };

      document.getElementById.mockImplementation((id) => domMap[id] || null);
      dashboard.storage = {
        getCachedData: jest.fn().mockReturnValue({
          stocks: [
            {
              symbol: 'AAPL',
              category: 'stock',
              price: 150,
              recommendation: 'Buy',
              recommendationDetails: { counts: { buy: 10 }, period: '2026-03-01' },
            },
          ],
          crypto: [],
          etfs: [],
          lastUpdated: '2026-03-01T10:00:00Z',
        }),
        saveCachedData: jest.fn(),
        saveLastUpdated: jest.fn(),
      };

      const renderSpy = jest.spyOn(dashboard, 'renderStockCard').mockImplementation(() => {});
      jest.spyOn(dashboard, 'updatePortfolioSummary').mockImplementation(() => {});
      jest.spyOn(dashboard, 'updateDataSourceIndicator').mockImplementation(() => {});

      const snapshotPayload = {
        stocks: {
          results: [
            {
              success: true,
              data: { symbol: 'AAPL', price: 155, changesPercentage: 1.5, name: 'Apple', provider: 'finnhub' },
            },
          ],
          fetchedAt: '2026-03-02T10:00:00Z',
        },
        crypto: { results: [], fetchedAt: '2026-03-02T10:00:00Z' },
        metadata: { updatedAt: '2026-03-02T10:00:00Z' },
      };

      jest.spyOn(dashboard, 'fetchFromApi').mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(snapshotPayload),
      });

      const hydrated = await dashboard.hydrateFromSnapshot();

      expect(hydrated).toBe(true);
      expect(renderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'AAPL',
          price: 155,
          recommendation: 'Buy',
          recommendationDetails: expect.objectContaining({ period: '2026-03-01' }),
        }),
        null
      );
    });

    test('ignores snapshot entries not tracked by user', async () => {
      dashboard.stocks = ['AAPL']; // user stopped tracking SPY/BTC
      const domMap = {
        'stocks-container': { innerHTML: '' },
        'crypto-container': { innerHTML: '' },
        'etf-container': { innerHTML: '' },
        'last-updated': { textContent: '' },
      };

      document.getElementById.mockImplementation((id) => domMap[id] || null);
      jest.spyOn(dashboard, 'renderStockCard').mockImplementation(() => {});

      const snapshotPayload = {
        stocks: {
          results: [
            { success: true, data: { symbol: 'AAPL', price: 150, provider: 'finnhub' } },
            { success: true, data: { symbol: 'SPY', price: 410, provider: 'finnhub' } },
          ],
          fetchedAt: '2024-01-01T10:00:00Z',
        },
        crypto: {
          results: [{ success: true, data: { symbol: 'BTC', price: 30000, provider: 'coingecko' } }],
          fetchedAt: '2024-01-01T10:01:00Z',
        },
      };

      jest.spyOn(dashboard, 'fetchFromApi').mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(snapshotPayload),
      });

      const hydrated = await dashboard.hydrateFromSnapshot();

      expect(hydrated).toBe(true);
      expect(dashboard.renderStockCard).toHaveBeenCalledTimes(1);
      expect(dashboard.renderStockCard).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL' }), null);
    });

    test('backfills missing snapshot categories from persisted cache', async () => {
      const domMap = {
        'stocks-container': { innerHTML: '' },
        'crypto-container': { innerHTML: '' },
        'etf-container': { innerHTML: '' },
        'last-updated': { textContent: '' },
      };

      document.getElementById.mockImplementation((id) => domMap[id] || null);
      jest.spyOn(dashboard, 'renderStockCard').mockImplementation(() => {});
      jest.spyOn(dashboard, 'updatePortfolioSummary').mockImplementation(() => {});
      jest.spyOn(dashboard, 'updateDataSourceIndicator').mockImplementation(() => {});
      dashboard.ui.updateSectionStatuses = jest.fn();
      dashboard.storage = {
        getCachedData: jest.fn().mockReturnValue({
          stocks: [{ symbol: 'AAPL', price: 150, provider: 'finnhub', category: 'stock' }],
          crypto: [],
          etfs: [{ symbol: 'SPY', price: 410, provider: 'finnhub', category: 'etf' }],
          lastUpdated: '2024-01-01T09:55:00Z',
        }),
        saveLastUpdated: jest.fn(),
        saveCachedData: jest.fn(),
      };

      const snapshotPayload = {
        stocks: {
          results: [],
          fetchedAt: '2024-01-01T10:00:00Z',
        },
        crypto: {
          results: [{ success: true, data: { symbol: 'BTC', price: 30000, provider: 'coingecko' } }],
          fetchedAt: '2024-01-01T10:01:00Z',
        },
        metadata: {
          updatedAt: '2024-01-01T10:02:00Z',
        },
      };

      jest.spyOn(dashboard, 'fetchFromApi').mockResolvedValue({
        status: 200,
        json: () => Promise.resolve(snapshotPayload),
      });

      const hydrated = await dashboard.hydrateFromSnapshot();

      expect(hydrated).toBe(true);
      expect(dashboard.renderStockCard).toHaveBeenCalledTimes(3);
      expect(dashboard.renderStockCard).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL' }), null);
      expect(dashboard.renderStockCard).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'SPY' }), null);
      expect(dashboard.renderStockCard).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'BTC' }), null);
      expect(dashboard.ui.updateSectionStatuses).toHaveBeenCalledWith({
        stocks: 'cached',
        crypto: null,
        etf: 'cached',
      });
      expect(dashboard.storage.saveCachedData).toHaveBeenCalledWith(
        expect.objectContaining({
          stocks: [expect.objectContaining({ symbol: 'AAPL' })],
          etfs: [expect.objectContaining({ symbol: 'SPY' })],
          crypto: [expect.objectContaining({ symbol: 'BTC' })],
        })
      );
    });

    test('returns false when a successful snapshot has no tracked renderable results', async () => {
      dashboard.stocks = ['AAPL'];
      dashboard.storage.getCachedData = jest.fn().mockReturnValue(null);
      document.getElementById.mockReturnValue(null);
      jest.spyOn(dashboard, 'fetchFromApi').mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          stocks: { results: [], fetchedAt: '2026-01-01T00:00:00.000Z' },
          crypto: { results: [] },
          metadata: { updatedAt: '2026-01-01T00:00:00.000Z' },
        }),
      });

      await expect(dashboard.hydrateFromSnapshot()).resolves.toBe(false);
    });

    test('returns false when snapshot endpoint has no data', async () => {
      document.getElementById.mockReturnValue(null);
      jest.spyOn(dashboard, 'fetchFromApi').mockResolvedValue({
        status: 204,
        json: jest.fn(),
      });

      const hydrated = await dashboard.hydrateFromSnapshot();

      expect(hydrated).toBe(false);
      expect(dashboard.fetchFromApi).toHaveBeenCalledWith('/api/snapshot');
    });
  });

  test('refreshData keeps previous cache timestamp when refresh returns no results', async () => {
    const previousTimestamp = '2026-03-13T10:00:00.000Z';
    dashboard.stocks = ['AAPL'];
    dashboard.stockService = {
      isCrypto: jest.fn(() => false),
      fetchEquityData: jest.fn().mockResolvedValue([{ success: false, symbol: 'AAPL', error: 'offline' }]),
    };
    dashboard.cryptoService = {
      fetchCoinGeckoData: jest.fn().mockResolvedValue([]),
    };
    dashboard.storage = {
      getLastUpdated: jest.fn().mockReturnValue(previousTimestamp),
      getCachedData: jest.fn().mockReturnValue({
        stocks: [{ symbol: 'AAPL', price: 150 }],
        crypto: [],
        etfs: [],
        lastUpdated: previousTimestamp,
      }),
      saveLastUpdated: jest.fn(),
      saveCachedData: jest.fn(),
    };
    dashboard.ui = {
      clearContainers: jest.fn(),
      renderErrorCard: jest.fn(),
      updateLastUpdated: jest.fn(),
      updateSources: jest.fn(),
    };

    await dashboard.refreshData();

    expect(dashboard.storage.saveCachedData).not.toHaveBeenCalled();
    expect(dashboard.storage.saveLastUpdated).not.toHaveBeenCalled();
    expect(dashboard.ui.updateLastUpdated).toHaveBeenCalledWith(new Date(previousTimestamp));
  });
});
