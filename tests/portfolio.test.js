const { FinanceDashboard } = require('../js/app');

describe('Portfolio Calculations', () => {
  let dashboard;

  const createPosition = (symbol, shares, costBasis) => {
    dashboard.portfolio[symbol] = { shares, costBasis };
  };

  beforeEach(() => {
    jest.spyOn(FinanceDashboard.prototype, 'init').mockImplementation(() => Promise.resolve());
    dashboard = new FinanceDashboard();
    dashboard.portfolio = {};
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('calculates profit scenarios', () => {
    createPosition('TEST', 10, 100);
    const metrics = dashboard.calculatePortfolioMetrics('TEST', 150);
    expect(metrics).toMatchObject({
      shares: 10,
      costBasis: 100,
      totalValue: 1500,
      totalCost: 1000,
      profitLoss: 500
    });
    expect(metrics.profitLossPercent).toBe(50);
  });

  test('calculates loss scenarios', () => {
    createPosition('LOSS', 10, 150);
    const metrics = dashboard.calculatePortfolioMetrics('LOSS', 100);
    expect(metrics.profitLoss).toBe(-500);
    expect(metrics.profitLossPercent).toBeCloseTo(-33.33, 2);
  });

  test('returns null for zero-share positions', () => {
    createPosition('EMPTY', 0, 100);
    expect(dashboard.calculatePortfolioMetrics('EMPTY', 150)).toBeNull();
  });

  test('handles zero cost basis without dividing by zero', () => {
    createPosition('FREE', 10, 0);
    const metrics = dashboard.calculatePortfolioMetrics('FREE', 150);
    expect(metrics.profitLoss).toBe(1500);
    expect(metrics.profitLossPercent).toBe(0);
  });

  test('supports fractional shares and precision math', () => {
    createPosition('FRACTION', 0.5, 100);
    const metrics = dashboard.calculatePortfolioMetrics('FRACTION', 150);
    expect(metrics.totalValue).toBe(75);
    expect(metrics.totalCost).toBe(50);
    expect(metrics.profitLoss).toBe(25);
  });

  test('handles very small gains', () => {
    createPosition('TINY', 1, 100);
    const metrics = dashboard.calculatePortfolioMetrics('TINY', 100.01);
    expect(metrics.profitLoss).toBeCloseTo(0.01, 5);
    expect(metrics.profitLossPercent).toBeCloseTo(0.01, 2);
  });

  test('handles large numbers and break-even scenarios', () => {
    createPosition('BIG', 1000, 50);
    const bigMetrics = dashboard.calculatePortfolioMetrics('BIG', 75);
    expect(bigMetrics.profitLoss).toBe(25000);

    createPosition('EVEN', 10, 100);
    const evenMetrics = dashboard.calculatePortfolioMetrics('EVEN', 100);
    expect(evenMetrics.profitLoss).toBe(0);
  });

  test('supports negative price edge cases', () => {
    createPosition('WEIRD', 10, 100);
    const metrics = dashboard.calculatePortfolioMetrics('WEIRD', -50);
    expect(metrics.totalValue).toBe(-500);
    expect(metrics.profitLoss).toBe(-1500);
    expect(metrics.profitLossPercent).toBe(-150);
  });

  test('aggregates multiple holdings for portfolio summaries', () => {
    createPosition('AAPL', 10, 100);
    createPosition('MSFT', 5, 200);
    createPosition('GOOGL', 3, 150);

    const holdings = ['AAPL', 'MSFT', 'GOOGL'];
    const aggregate = holdings.reduce((acc, symbol) => {
      const metrics = dashboard.calculatePortfolioMetrics(symbol, symbol === 'AAPL' ? 150 : symbol === 'MSFT' ? 250 : 100);
      if (!metrics) {
        return acc;
      }
      acc.totalValue += metrics.totalValue;
      acc.totalCost += metrics.totalCost;
      return acc;
    }, { totalValue: 0, totalCost: 0 });

    const totalPL = aggregate.totalValue - aggregate.totalCost;
    const totalPLPercent = aggregate.totalCost > 0 ? (totalPL / aggregate.totalCost) * 100 : 0;

    expect(aggregate.totalValue).toBe(3050);
    expect(aggregate.totalCost).toBe(2450);
    expect(totalPL).toBe(600);
    expect(totalPLPercent).toBeCloseTo(24.49, 2);
  });
});
