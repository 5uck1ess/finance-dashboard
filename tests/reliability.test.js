const { applyCategoryOverrides } = require('../js/services/instrument-utils');
const { StorageService } = require('../js/services/storage');
const { UIManager } = require('../js/ui/ui-manager');

describe('Reliability helpers', () => {
  test('category overrides move symbols without mutating unrelated configuration', () => {
    const config = {
      stocks: ['AAPL', 'CUSTOM'],
      cryptos: ['BTC'],
      etfs: ['SPY'],
      settings: { autoRefreshSeconds: 60 },
    };

    const result = applyCategoryOverrides(config, { CUSTOM: 'crypto', BTC: 'etf' });

    expect(result).toEqual({
      stocks: ['AAPL'],
      cryptos: ['CUSTOM'],
      etfs: ['SPY', 'BTC'],
      settings: { autoRefreshSeconds: 60 },
    });
    expect(config.stocks).toEqual(['AAPL', 'CUSTOM']);
  });

  test('category storage round-trips valid data and tolerates invalid JSON', () => {
    const values = new Map();
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key) => values.get(key) ?? null),
        setItem: jest.fn((key, value) => values.set(key, value)),
      },
    });
    const storage = new StorageService();

    storage.saveCategories({ AAPL: 'stock' });
    expect(storage.getCategories()).toEqual({ AAPL: 'stock' });

    values.set('assetCategories', '{not-json');
    jest.spyOn(console, 'error').mockImplementation();
    expect(storage.getCategories()).toEqual({});
  });

  test('loading and failure states fill every available section with clear status and retry text', () => {
    const containers = {
      'stocks-container': { innerHTML: '' },
      'crypto-container': { innerHTML: '' },
      'etf-container': { innerHTML: '' },
    };
    document.getElementById.mockImplementation((id) => containers[id] || null);
    const ui = new UIManager({});

    ui.showLoadingState();
    expect(containers['stocks-container'].innerHTML).toContain('Loading stocks data');
    expect(containers['crypto-container'].innerHTML).toContain('role="status"');

    ui.showLoadError();
    Object.values(containers).forEach((container) => {
      expect(container.innerHTML).toContain('Dashboard data could not be loaded');
      expect(container.innerHTML).toContain('Retry');
    });
  });
});
