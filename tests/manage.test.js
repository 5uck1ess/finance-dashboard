const { BACKUP_VERSION, ManageInvestments } = require('../js/manage');

describe('Management page and backup workflows', () => {
  let app;
  let storageState;

  beforeEach(() => {
    storageState = new Map();
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key) => (storageState.has(key) ? storageState.get(key) : null)),
        setItem: jest.fn((key, value) => storageState.set(key, value)),
        removeItem: jest.fn((key) => storageState.delete(key)),
        clear: jest.fn(() => storageState.clear()),
      },
    });
    jest.spyOn(ManageInvestments.prototype, 'init').mockImplementation(() => Promise.resolve());
    app = new ManageInvestments();
    app.config = { stocks: [], cryptos: [], etfs: [] };
    app.renderLists = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.prompt;
    delete global.alert;
  });

  test('persists symbols and manually selected categories together', () => {
    app.investments = [
      { symbol: 'AAPL', category: 'stock' },
      { symbol: 'ETHX', category: 'crypto' },
    ];

    app.saveInvestments();

    expect(JSON.parse(storageState.get('stocks'))).toEqual(['AAPL', 'ETHX']);
    expect(JSON.parse(storageState.get('assetCategories'))).toEqual({ AAPL: 'stock', ETHX: 'crypto' });
  });

  test('catches initialization failures and routes them to visible error handling', () => {
    ManageInvestments.prototype.init.mockRejectedValueOnce(new Error('config unavailable'));
    const errorSpy = jest.spyOn(ManageInvestments.prototype, 'showInitializationError').mockImplementation();

    new ManageInvestments();
    return Promise.resolve()
      .then(() => {
        expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'config unavailable' }));
      })
      .catch((error) => {
        throw error;
      });
  });

  test('removing an investment also removes its portfolio holding', () => {
    storageState.set(
      'portfolio',
      JSON.stringify({ AAPL: { shares: 2, avgPrice: 100 }, MSFT: { shares: 1, avgPrice: 200 } })
    );
    app.investments = [
      { symbol: 'AAPL', category: 'stock' },
      { symbol: 'MSFT', category: 'stock' },
    ];

    app.removeInvestment('AAPL');

    expect(JSON.parse(storageState.get('portfolio'))).toEqual({ MSFT: { shares: 1, avgPrice: 200 } });
    expect(JSON.parse(storageState.get('stocks'))).toEqual(['MSFT']);
  });

  test('edits existing shares and cost basis after validation', () => {
    storageState.set('portfolio', JSON.stringify({ AAPL: { shares: 2, avgPrice: 100 } }));
    global.prompt = jest.fn().mockReturnValueOnce('3.5').mockReturnValueOnce('125.25');
    global.alert = jest.fn();

    expect(app.editInvestment('AAPL')).toBe(true);

    expect(JSON.parse(storageState.get('portfolio'))).toEqual({ AAPL: { shares: 3.5, avgPrice: 125.25 } });
    expect(global.alert).not.toHaveBeenCalled();
  });

  test('rejects invalid holding edits without overwriting the portfolio', () => {
    const original = JSON.stringify({ AAPL: { shares: 2, avgPrice: 100 } });
    storageState.set('portfolio', original);
    global.prompt = jest.fn().mockReturnValueOnce('0').mockReturnValueOnce('100');
    global.alert = jest.fn();

    expect(app.editInvestment('AAPL')).toBe(false);

    expect(storageState.get('portfolio')).toBe(original);
    expect(global.alert).toHaveBeenCalled();
  });

  test('cancelling an edit leaves the existing holding unchanged', () => {
    const original = JSON.stringify({ AAPL: { shares: 2, avgPrice: 100 } });
    storageState.set('portfolio', original);
    global.prompt = jest.fn().mockReturnValue(null);

    expect(app.editInvestment('AAPL')).toBe(false);
    expect(storageState.get('portfolio')).toBe(original);
  });

  test('restores every field from a versioned JSON backup', () => {
    const restored = app.restoreBackup({
      version: BACKUP_VERSION,
      symbols: ['aapl', 'btc'],
      portfolio: { aapl: { shares: 2, avgPrice: 101.5 }, btc: { shares: 0.25, costBasis: 30000 } },
      configuration: { settings: { autoRefreshSeconds: 60 } },
      categories: { aapl: 'stock', btc: 'crypto' },
    });

    expect(restored.symbols).toEqual(['AAPL', 'BTC']);
    expect(JSON.parse(storageState.get('stocks'))).toEqual(['AAPL', 'BTC']);
    expect(JSON.parse(storageState.get('portfolio'))).toEqual({
      AAPL: { shares: 2, avgPrice: 101.5 },
      BTC: { shares: 0.25, avgPrice: 30000 },
    });
    expect(JSON.parse(storageState.get('finance_dashboard_config'))).toEqual({
      settings: { autoRefreshSeconds: 60 },
    });
    expect(JSON.parse(storageState.get('assetCategories'))).toEqual({ AAPL: 'stock', BTC: 'crypto' });
    expect(app.investments.map(({ symbol, category }) => ({ symbol, category }))).toEqual([
      { symbol: 'AAPL', category: 'stock' },
      { symbol: 'BTC', category: 'crypto' },
    ]);
  });

  test('exports a complete versioned backup payload', () => {
    const OriginalBlob = global.Blob;
    const blobSpy = jest.fn((parts, options) => ({ parts, options }));
    global.Blob = blobSpy;
    jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    app.investments = [
      { symbol: 'AAPL', category: 'stock' },
      { symbol: 'BTC', category: 'crypto' },
    ];
    storageState.set(
      'portfolio',
      JSON.stringify({ AAPL: { shares: 2, avgPrice: 100 }, ORPHAN: { shares: 9, avgPrice: 1 } })
    );
    storageState.set('finance_dashboard_config', JSON.stringify({ settings: { autoRefreshSeconds: 60 } }));

    try {
      app.exportData();
    } finally {
      global.Blob = OriginalBlob;
    }

    const payload = JSON.parse(blobSpy.mock.calls[0][0][0]);
    expect(payload).toMatchObject({
      version: BACKUP_VERSION,
      symbols: ['AAPL', 'BTC'],
      portfolio: { AAPL: { shares: 2, avgPrice: 100 } },
      configuration: { settings: { autoRefreshSeconds: 60 } },
      categories: { AAPL: 'stock', BTC: 'crypto' },
    });
    expect(payload.exportedAt).toEqual(expect.any(String));
  });

  test('accepts the legacy backup field names', () => {
    app.restoreBackup({
      stocks: ['COINX'],
      portfolio: { COINX: { shares: 1, costBasis: 400 } },
      config: { cryptos: ['COINX'] },
    });

    expect(JSON.parse(storageState.get('stocks'))).toEqual(['COINX']);
    expect(JSON.parse(storageState.get('assetCategories'))).toEqual({ COINX: 'crypto' });
  });

  test('invalid backups do not partially overwrite existing data', () => {
    storageState.set('stocks', JSON.stringify(['SAFE']));
    storageState.set('portfolio', JSON.stringify({ SAFE: { shares: 1, avgPrice: 10 } }));

    expect(() =>
      app.restoreBackup({
        version: BACKUP_VERSION,
        symbols: ['BROKEN'],
        portfolio: { BROKEN: { shares: -1, avgPrice: 10 } },
        configuration: {},
        categories: { BROKEN: 'stock' },
      })
    ).toThrow('Invalid portfolio values');

    expect(JSON.parse(storageState.get('stocks'))).toEqual(['SAFE']);
    expect(JSON.parse(storageState.get('portfolio'))).toEqual({ SAFE: { shares: 1, avgPrice: 10 } });
  });

  test('rejects unsupported backup versions before writing', () => {
    expect(() => app.restoreBackup({ version: 99, symbols: [] })).toThrow('Unsupported backup version');
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  test('rejects unsafe symbols before rendering or writing', () => {
    expect(() => app.restoreBackup({ version: BACKUP_VERSION, symbols: ['<img src=x onerror=alert(1)>'] })).toThrow(
      'Invalid investment symbol'
    );
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  test('rolls back all keys when storage fails during restore', () => {
    const originals = {
      stocks: JSON.stringify(['SAFE']),
      portfolio: JSON.stringify({ SAFE: { shares: 1, avgPrice: 10 } }),
      finance_dashboard_config: JSON.stringify({ safe: true }),
      assetCategories: JSON.stringify({ SAFE: 'stock' }),
    };
    Object.entries(originals).forEach(([key, value]) => storageState.set(key, value));
    let shouldFail = true;
    localStorage.setItem.mockImplementation((key, value) => {
      if (key === 'assetCategories' && shouldFail) {
        shouldFail = false;
        throw new Error('quota exceeded');
      }
      storageState.set(key, value);
    });

    expect(() =>
      app.restoreBackup({
        version: BACKUP_VERSION,
        symbols: ['NEW'],
        portfolio: { NEW: { shares: 1, avgPrice: 20 } },
        configuration: { safe: false },
        categories: { NEW: 'stock' },
      })
    ).toThrow('Backup restore failed');

    expect(Object.fromEntries(storageState)).toMatchObject(originals);
  });
});
