const { EnhancedCache } = require('../js/api-clients');

describe('EnhancedCache', () => {
  let cache;

  beforeEach(() => {
    cache = new EnhancedCache();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initializes empty cache', () => {
    expect(cache.get('missing')).toBeNull();
    expect(cache.getStats()).toEqual({ valid: 0, expired: 0, total: 0 });
  });

  test('stores and retrieves data with ttl', () => {
    const payload = { symbol: 'AAPL', price: 150.5 };
    cache.set('quote', payload, 1000);
    expect(cache.get('quote')).toEqual(payload);

    jest.advanceTimersByTime(1500);
    expect(cache.get('quote')).toBeNull();
  });

  test('clears entries and reports stats', () => {
    cache.set('valid', { data: 1 }, 60000);
    cache.set('expired', { data: 2 }, 1000);

    jest.advanceTimersByTime(1500);

    const stats = cache.getStats();
    expect(stats.total).toBe(2);
    expect(stats.valid).toBe(1);
    expect(stats.expired).toBe(1);

    cache.clear();
    expect(cache.get('valid')).toBeNull();
    expect(cache.getStats()).toEqual({ valid: 0, expired: 0, total: 0 });
  });

  test('handles multiple entries and removes expired keys on read', () => {
    cache.set('key1', { symbol: 'AAPL' }, 60000);
    cache.set('key2', { symbol: 'MSFT' }, 1000);

    jest.advanceTimersByTime(1500);
    expect(cache.get('key2')).toBeNull();
    expect(cache.get('key1')).toEqual({ symbol: 'AAPL' });
  });
});

