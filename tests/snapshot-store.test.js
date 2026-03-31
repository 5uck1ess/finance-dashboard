const fs = require('fs');
const os = require('os');
const path = require('path');
const { SnapshotStore } = require('../server/services/snapshot-store');

describe('SnapshotStore', () => {
  let tempDir;
  let filePath;
  let store;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-store-'));
    filePath = path.join(tempDir, 'dashboard-snapshot.json');
    store = new SnapshotStore(filePath);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('updateSection persists data and metadata', async () => {
    const results = [{ success: true, data: { symbol: 'AAPL', price: 150 } }];

    await store.updateSection('stocks', { results, requestedSymbols: ['AAPL'] }, { lastSection: 'stocks' });
    const snapshot = await store.readSnapshot();

    expect(snapshot).toBeTruthy();
    expect(snapshot.stocks.results).toHaveLength(1);
    expect(snapshot.stocks.results[0].data.symbol).toBe('AAPL');
    expect(snapshot.stocks).toHaveProperty('fetchedAt');
    expect(snapshot.metadata.lastSection).toBe('stocks');
    expect(snapshot.metadata).toHaveProperty('updatedAt');
  });

  test('clearSnapshot removes the snapshot file', async () => {
    await store.writeSnapshot({ stocks: { results: [] } });
    expect(fs.existsSync(filePath)).toBe(true);

    await store.clearSnapshot();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('updateSection preserves analyst recommendation fields when stock snapshot omits them', async () => {
    await store.writeSnapshot({
      stocks: {
        results: [{
          success: true,
          data: {
            symbol: 'AAPL',
            price: 150,
            recommendation: 'Buy',
            recommendationDetails: { counts: { buy: 10 }, period: '2026-03-01' }
          }
        }]
      }
    });

    await store.updateSection('stocks', {
      results: [{
        success: true,
        data: {
          symbol: 'AAPL',
          price: 155
        }
      }]
    });

    const snapshot = await store.readSnapshot();
    expect(snapshot.stocks.results[0].data).toEqual(expect.objectContaining({
      symbol: 'AAPL',
      price: 155,
      recommendation: 'Buy',
      recommendationDetails: expect.objectContaining({ period: '2026-03-01' })
    }));
  });
});
