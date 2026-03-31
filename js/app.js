import { StorageService } from './services/storage.js';
import { StockService } from './services/stock-service.js';
import { CryptoService } from './services/crypto-service.js';
import { UIManager } from './ui/ui-manager.js';
import {
  FinnhubClient,
  FinancialModelingPrepClient,
  AlphaVantageClient,
  YahooFinanceClient,
  CoinGeckoClient,
  EnhancedCache,
  RateLimiter,
} from './services/api-clients.js';
import { loadDashboardConfig, buildApiKeys, getApiKeyFromConfig } from './services/config-loader.js';
import {
  deriveSources,
  fillMissingCategoriesFromCache,
  persistCacheSnapshot as persistDashboardCacheSnapshot,
  renderTrackedSnapshotData,
} from './services/dashboard-cache.js';
import {
  getInstrumentCategory,
  groupSymbolsByCategory,
  isCryptoSymbol,
  isETFSymbol,
} from './services/instrument-utils.js';
import { getMarketStatus, getLastUpdatedText } from './services/market-utils.js';
import { normalizeCryptoQuote, normalizeEquityQuote } from './services/quote-normalizers.js';

class FinanceDashboard {
  constructor() {
    this.storage = new StorageService();
    this.ui = new UIManager(this.storage);
    this.cache = new EnhancedCache();
    this.portfolio = {};
    this.stocks = [];
    this.config = {};
    this.apiClients = {};
    this.lastUpdated = null;
  }

  async init() {
    await this.loadConfig();
    this.initializeServices();
    this.setupEventListeners();
    this.setupLifecycleHandlers();
    this.updateRecommendedRefreshLabel();
    this.loadSavedStocks();
    this.applyTheme();

    const snapshotLoaded = await this.hydrateFromSnapshot();
    if (!snapshotLoaded) {
      const cached = this.storage.getCachedData();
      this.renderCachedData(cached);
    }

    this.updateMarketStatus();
    this.startLastUpdatedTimer();

    // Prepare auto-refresh UI (manual by default; no timer until user opts in)
    this.initAutoRefresh();

    this.isReady = true;
    document.dispatchEvent(new CustomEvent('finance-dashboard:ready'));
  }

  async loadConfig() {
    this.config = await loadDashboardConfig(this.storage);
  }

  buildApiKeys(baseConfig = {}, userConfig = {}) {
    return buildApiKeys(baseConfig, userConfig);
  }

  getApiKey(provider) {
    return getApiKeyFromConfig(this.config, provider);
  }

  initializeServices() {
    const rateLimiter = new RateLimiter(5, 1000);
    const cache = this.cache || new EnhancedCache();

    const yahooConfig = this.config.api?.yahooFinance || {};
    const yahooEnabled = yahooConfig.enabled !== false;
    const yahooCorsProxy = yahooConfig.corsProxy || this.config.corsProxy || null;
    const shouldUseYahooInBrowser = yahooEnabled && (yahooCorsProxy || !this.config.backendAvailable);

    this.apiClients = {
      finnhub: new FinnhubClient(this.getApiKey('finnhub'), null, rateLimiter),
      fmp: new FinancialModelingPrepClient(this.getApiKey('fmp'), null, rateLimiter),
      alphaVantage: new AlphaVantageClient(this.getApiKey('alphaVantage'), null, rateLimiter),
      yahooFinance: shouldUseYahooInBrowser ? new YahooFinanceClient(null, rateLimiter, yahooCorsProxy) : null,
      coingecko: new CoinGeckoClient(null, null),
      cache: cache,
    };

    this.stockService = new StockService(this.apiClients, this.storage, this.config);
    this.cryptoService = new CryptoService(this.apiClients, this.storage, this.config);
  }

  setupLifecycleHandlers() {
    // Flush in-flight data to localStorage when the page is being unloaded,
    // hidden, or the browser is about to crash/update.
    const flush = () => {
      if (this._pendingSnapshot) {
        this.persistCacheSnapshot(this._pendingSnapshot, new Date().toISOString());
        this._pendingSnapshot = null;
      }
    };

    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    });

    // Periodic flush every 15 seconds to guard against hard crashes
    this._flushTimer = setInterval(() => {
      if (this._pendingSnapshot) {
        this.persistCacheSnapshot(this._pendingSnapshot, new Date().toISOString());
      }
    }, 15000);
  }

  trackPendingSnapshot(snapshot) {
    this._pendingSnapshot = snapshot;
  }

  setupEventListeners() {
    // Add Stock Form
    const addForm = document.getElementById('add-stock-form');
    if (addForm) {
      addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('stock-symbol');
        if (input && input.value) {
          this.addStock(input.value.toUpperCase());
          input.value = '';
        }
      });
    }

    const fullRefreshBtn = document.getElementById('full-refresh-btn');
    if (fullRefreshBtn) {
      fullRefreshBtn.addEventListener('click', () => {
        this.refreshData({
          forceRefresh: true,
          priceOnly: false,
          includeRecommendation: true,
          triggerButtonId: 'full-refresh-btn',
        });
      });
    }

    const priceRefreshBtn = document.getElementById('price-refresh-btn');
    if (priceRefreshBtn) {
      priceRefreshBtn.addEventListener('click', () => {
        this.refreshData({
          forceRefresh: true,
          priceOnly: true,
          includeRecommendation: false,
          triggerButtonId: 'price-refresh-btn',
        });
      });
    }

    const copyAllBtn = document.getElementById('copy-all-btn');
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', () => {
        this.ui.copyAllVisibleSymbolsAndPrices(copyAllBtn);
      });
    }

    const toggleAnalystPanelsBtn = document.getElementById('toggle-analyst-panels-btn');
    if (toggleAnalystPanelsBtn) {
      toggleAnalystPanelsBtn.addEventListener('click', () => {
        const { allOpen } = this.ui.getAnalystPanelState();
        this.ui.setAllAnalystPanels(!allOpen);
        this.updateAnalystPanelToggle();
      });
    }

    document.addEventListener('toggle', (event) => {
      if (event.target?.matches?.('details[data-analyst-panel="true"]')) {
        this.updateAnalystPanelToggle();
      }
    });

    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Auto Refresh Select
    const autoRefreshSelect = document.getElementById('auto-refresh-select');
    if (autoRefreshSelect) {
      autoRefreshSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        this.storage.saveAutoRefresh(value);
        this.applyAutoRefresh(value);
      });
    }

    // Sort Select
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value !== 'default') {
          this.ui.sortCards(value);
        }
      });
    }
  }

  getRefreshButtons() {
    return ['full-refresh-btn', 'price-refresh-btn'].map((id) => document.getElementById(id)).filter(Boolean);
  }

  formatRefreshIntervalLabel(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    if (seconds % 60 === 0) {
      return `${seconds / 60}m`;
    }
    return `${seconds}s`;
  }

  updateRecommendedRefreshLabel() {
    const select = document.getElementById('auto-refresh-select');
    if (!select) return;

    const recommendedOption = select.querySelector('option[value="recommended"]');
    if (!recommendedOption) return;

    const recommendedSeconds = this.config.settings?.autoRefreshSeconds || 300;
    recommendedOption.textContent = `Recommended (${this.formatRefreshIntervalLabel(recommendedSeconds)})`;
  }

  updateAnalystPanelToggle() {
    const button = document.getElementById('toggle-analyst-panels-btn');
    if (!button) return;

    const { count, allOpen } = this.ui.getAnalystPanelState();
    if (count === 0) {
      button.classList.add('hidden');
      return;
    }

    button.classList.remove('hidden');
    button.textContent = allOpen ? 'Hide all analyst panels' : 'Show all analyst panels';
  }

  loadSavedStocks() {
    const saved = localStorage.getItem('stocks');
    if (saved) {
      this.stocks = JSON.parse(saved);
      return;
    }

    const configStocks = Array.isArray(this.config?.stocks) ? this.config.stocks : [];
    const configCryptos = Array.isArray(this.config?.cryptos) ? this.config.cryptos : [];
    const configEtfs = Array.isArray(this.config?.etfs) ? this.config.etfs : [];

    const combined = Array.from(new Set([...configStocks, ...configCryptos, ...configEtfs])).filter(Boolean);

    if (combined.length > 0) {
      this.stocks = combined;
      this.saveStocks();
      return;
    }

    this.stocks = ['AAPL', 'MSFT', 'GOOGL', 'BTC', 'ETH']; // Defaults
    this.saveStocks();
  }

  async addStock(symbol) {
    if (this.stocks.includes(symbol)) {
      alert('Stock already added!');
      return;
    }
    this.stocks.push(symbol);
    this.saveStocks();
    await this.refreshData();
  }

  removeStock(symbol) {
    this.stocks = this.stocks.filter((s) => s !== symbol);
    this.saveStocks();
    this.ui.removeCardAnimated(symbol);

    if (this.stocks.length === 0) {
      this.ui.showEmptyState('stocks');
    }
  }

  saveStocks() {
    localStorage.setItem('stocks', JSON.stringify(this.stocks));
  }

  async refreshData(options = {}) {
    const triggerButton = options.triggerButtonId ? document.getElementById(options.triggerButtonId) : null;
    const refreshButtons = this.getRefreshButtons();
    const priceOnly = options.priceOnly === true;
    refreshButtons.forEach((button) => {
      button.disabled = true;
    });
    if (triggerButton) {
      triggerButton.classList.add('animate-spin');
    }

    const cacheSnapshot = { stocks: [], crypto: [], etfs: [] };

    let stockSource = null;
    let cryptoSource = null;
    const renderedCounts = { stocks: 0, crypto: 0, etf: 0 };

    try {
      const stockSymbols = this.stocks.filter((s) => !this.stockService.isCrypto(s));
      const cryptoSymbols = this.stocks.filter((s) => this.stockService.isCrypto(s));

      if (!priceOnly) {
        this.ui.clearContainers();
        // Show skeleton placeholders while data loads
        if (stockSymbols.length > 0) this.ui.showSkeletonCards?.('stocks', Math.min(stockSymbols.length, 4));
        if (cryptoSymbols.length > 0) this.ui.showSkeletonCards?.('crypto', Math.min(cryptoSymbols.length, 3));
      }

      if (stockSymbols.length > 0) {
        const results = await this.stockService.fetchEquityData(stockSymbols, options);
        if (!priceOnly) this.ui.clearSkeletons?.();
        results.forEach((result) => {
          if (result.success) {
            const portfolio = this.getPortfolioMetrics(result.data.symbol, result.data.price);
            if (priceOnly) {
              this.ui.updateRenderedCard(result.data, portfolio);
            } else {
              this.ui.renderStockCard(result.data, portfolio);
            }
            if (result.data.category === 'etf') renderedCounts.etf += 1;
            else renderedCounts.stocks += 1;
            if (!stockSource && (result.data.provider || result.data.dataSource)) {
              stockSource = result.data.provider || result.data.dataSource;
            }
            const targetArray = result.data.category === 'etf' ? cacheSnapshot.etfs : cacheSnapshot.stocks;
            targetArray.push(result.data);
          } else {
            if (!priceOnly) {
              this.ui.renderErrorCard(result.symbol, result.error);
            }
          }
        });
        // Track partial results so crash-recovery can pick them up
        this.trackPendingSnapshot(cacheSnapshot);
      } else if (!priceOnly) {
        this.ui.showEmptyState('stocks');
      }

      if (cryptoSymbols.length > 0) {
        const results = await this.cryptoService.fetchCoinGeckoData(cryptoSymbols, options);
        results.forEach((result) => {
          if (result.success) {
            const portfolio = this.getPortfolioMetrics(result.data.symbol, result.data.price);
            if (priceOnly) {
              this.ui.updateRenderedCard(result.data, portfolio);
            } else {
              this.ui.renderStockCard(result.data, portfolio);
            }
            renderedCounts.crypto += 1;
            if (!cryptoSource && (result.data.provider || result.data.dataSource)) {
              cryptoSource = result.data.provider || result.data.dataSource;
            }
            cacheSnapshot.crypto.push(result.data);
          } else {
            if (!priceOnly) {
              this.ui.renderErrorCard(result.symbol, result.error);
            }
          }
        });
        // Track partial results so crash-recovery can pick them up
        this.trackPendingSnapshot(cacheSnapshot);
      } else if (!priceOnly && this.stocks.some((s) => this.stockService.isCrypto(s))) {
        this.ui.showEmptyState('crypto');
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      // Fallback defaults if we had results but no explicit provider captured
      if (!stockSource && (cacheSnapshot.stocks.length > 0 || cacheSnapshot.etfs.length > 0)) {
        const first = cacheSnapshot.stocks[0] || cacheSnapshot.etfs[0];
        stockSource = first?.provider || first?.dataSource || 'Stocks';
      }
      if (!cryptoSource && cacheSnapshot.crypto.length > 0) {
        const first = cacheSnapshot.crypto[0];
        cryptoSource = first?.provider || first?.dataSource || 'CoinGecko';
      }

      const now = new Date();
      const hasFreshResults =
        cacheSnapshot.stocks.length > 0 || cacheSnapshot.etfs.length > 0 || cacheSnapshot.crypto.length > 0;

      if (hasFreshResults) {
        this.persistCacheSnapshot(cacheSnapshot, now.toISOString());
        this._pendingSnapshot = null; // Clear pending; data is persisted
        this.storage.saveLastUpdated(now);
        this.lastUpdated = now;
        this.ui.updateLastUpdated(now);
      } else {
        const existingTimestamp = this.getLastUpdatedTimestamp();
        this.ui.updateLastUpdated(existingTimestamp ? new Date(existingTimestamp) : null);
      }
      this.ensureSectionCoverage(renderedCounts);
      this.ui?.updateSectionStatuses?.({});
      this.ui.updateSources({ stocks: stockSource, crypto: cryptoSource });
      this.updateAnalystPanelToggle();
      refreshButtons.forEach((button) => {
        button.classList.remove('animate-spin');
        button.disabled = false;
      });
    }
  }

  calculatePortfolioMetrics(symbol, currentPrice) {
    const hasManualPortfolio = this.portfolio && Object.keys(this.portfolio).length > 0;
    const portfolio = hasManualPortfolio
      ? this.portfolio
      : this.storage?.getPortfolio
        ? this.storage.getPortfolio()
        : {};
    const holding = portfolio[symbol];
    if (!holding || !holding.shares) return null;

    const avgPrice = Number(holding.avgPrice ?? holding.costBasis ?? 0);
    const totalValue = holding.shares * currentPrice;
    const totalCost = holding.shares * avgPrice;
    const profitLoss = totalValue - totalCost;
    const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

    return {
      symbol,
      shares: holding.shares,
      costBasis: avgPrice,
      avgPrice,
      totalValue,
      totalCost,
      profitLoss,
      profitLossPercent,
    };
  }

  getPortfolioMetrics(symbol, currentPrice) {
    return this.calculatePortfolioMetrics(symbol, currentPrice);
  }

  setTheme(theme) {
    this.theme = theme;
    const html = document.documentElement;
    const body = document.body;
    const isDark = theme === 'dark';

    html.classList.toggle('dark', isDark);
    html.classList.toggle('light', !isDark);
    if (body) body.classList.toggle('dark', isDark);
    html.setAttribute('data-theme', theme);
    if (body) body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const themeIcon = document.querySelector('#theme-toggle i');
    if (themeIcon) {
      themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
  }

  toggleTheme() {
    const nextTheme = this.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  applyTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) {
      this.setTheme(saved);
      return;
    }
    // Auto-detect system preference on first visit
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    this.setTheme(prefersDark ? 'dark' : 'light');
  }

  getCategory(symbol) {
    return this.stockService?.getCategory
      ? this.stockService.getCategory(symbol)
      : getInstrumentCategory(symbol, this.config);
  }

  isCryptoSymbol(symbol) {
    return isCryptoSymbol(symbol, this.config);
  }

  isETFSymbol(symbol) {
    return isETFSymbol(symbol, this.config);
  }

  groupStocksByCategory(symbols = []) {
    return groupSymbolsByCategory(symbols, this.config);
  }

  applyConfigDefaults() {
    if (!this.stocks || this.stocks.length === 0) {
      const configStocks = Array.isArray(this.config?.stocks) ? this.config.stocks : [];
      const configCryptos = Array.isArray(this.config?.cryptos) ? this.config.cryptos : [];
      const configEtfs = Array.isArray(this.config?.etfs) ? this.config.etfs : [];
      const combined = Array.from(new Set([...configStocks, ...configCryptos, ...configEtfs])).filter(Boolean);
      this.stocks = combined.length > 0 ? combined : this.stocks;
      this.saveStocks();
    }
  }

  isMarketOpen(date = new Date()) {
    return getMarketStatus(date);
  }

  formatNumber(num = 0) {
    if (Math.abs(num) >= 1e9 && num >= 0) return (num / 1e9).toFixed(2) + 'B';
    if (Math.abs(num) >= 1e6 && num >= 0) return (num / 1e6).toFixed(2) + 'M';
    if (Math.abs(num) > 1e3 && num > 0) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  }

  getRatingColorClass(rating) {
    const r = rating.toLowerCase();
    if (r.includes('buy')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    if (r.includes('sell')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  }

  getRatingClass(rating = '') {
    const r = rating.toLowerCase();
    if (r.includes('buy')) return 'rating-buy';
    if (r.includes('sell')) return 'rating-sell';
    if (r.includes('hold') || r.includes('neutral')) return 'rating-hold';
    return '';
  }

  getLastUpdatedText(timestamp, now = new Date()) {
    return getLastUpdatedText(timestamp, now);
  }

  updateMarketStatus(date = new Date()) {
    const statusEl = document.getElementById('market-status');
    if (!statusEl) return;
    const dot = statusEl.querySelector('.status-dot');
    const textEl = statusEl.querySelector('.status-text');
    const result = this.isMarketOpen(date);

    statusEl.classList.remove('open', 'closed', 'pre-post');
    statusEl.classList.add(result.status);

    if (dot?.classList) {
      dot.classList.remove('bg-green-500', 'bg-gray-400', 'bg-yellow-400');
      if (result.status === 'open') dot.classList.add('bg-green-500');
      else if (result.status === 'pre-post') dot.classList.add('bg-yellow-400');
      else dot.classList.add('bg-gray-400');
    }
    if (textEl) {
      textEl.textContent = result.text;
    }
  }

  updatePortfolioSummary() {
    const summaryEl = document.getElementById('portfolio-summary');
    if (!summaryEl) return;

    let totalValue = 0;
    let totalCost = 0;
    let bestPerformer = { symbol: null, profitLoss: -Infinity };
    const holdings = [];

    (this.stocks || []).forEach((symbol) => {
      const cached =
        this.cache?.get(`equity-${symbol}`) ||
        this.cache?.get(`crypto-${symbol}`) ||
        this.cache?.get(`coingecko-${symbol}`) ||
        null;
      const price = cached?.price || cached?.close || 0;
      const metrics = this.calculatePortfolioMetrics(symbol, price);
      if (!metrics) return;

      totalValue += metrics.totalValue;
      totalCost += metrics.totalCost;
      holdings.push({ symbol, value: metrics.totalValue });

      if (metrics.profitLoss > bestPerformer.profitLoss) {
        bestPerformer = { symbol, profitLoss: metrics.profitLoss };
      }
    });

    if (totalValue === 0 && totalCost === 0) {
      summaryEl.style.display = 'none';
      return;
    }

    summaryEl.style.display = 'block';

    const setText = (id, value, field = 'textContent') => {
      const el = document.getElementById(id);
      if (el) {
        el[field] = value;
      }
    };

    setText('total-value', `$${totalValue.toFixed(2)}`);
    setText('total-cost', `$${totalCost.toFixed(2)}`);

    const totalPL = totalValue - totalCost;
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    const plEl = document.getElementById('total-pl');
    if (plEl) {
      const sign = totalPL >= 0 ? '+' : '';
      plEl.innerHTML = `${sign}$${totalPL.toFixed(2)} (${totalPLPercent.toFixed(2)}%)`;
      plEl.className = totalPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    }

    if (bestPerformer.symbol) {
      const bestEl = document.getElementById('best-performer');
      if (bestEl) {
        const sign = bestPerformer.profitLoss >= 0 ? '+' : '';
        bestEl.innerHTML = `${bestPerformer.symbol}: ${sign}$${bestPerformer.profitLoss.toFixed(2)}`;
      }
    }

    this.renderDonutChart(holdings, totalValue);
  }

  renderDonutChart(holdings, totalValue) {
    const container = document.getElementById('portfolio-donut');
    if (!container || holdings.length === 0 || totalValue <= 0) {
      if (container) container.innerHTML = '';
      return;
    }

    // Sort by value descending, group small slices into "Other"
    const sorted = [...holdings].sort((a, b) => b.value - a.value);
    const slices = [];
    let otherValue = 0;
    sorted.forEach((h, i) => {
      if (i < 6 && h.value / totalValue >= 0.03) {
        slices.push(h);
      } else {
        otherValue += h.value;
      }
    });
    if (otherValue > 0) {
      slices.push({ symbol: 'Other', value: otherValue });
    }

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

    const size = 100;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 36;
    const innerRadius = 22;

    let cumulativeAngle = -Math.PI / 2;
    let paths = '';
    let legendHTML = '';

    slices.forEach((slice, i) => {
      const pct = slice.value / totalValue;
      const angle = pct * 2 * Math.PI;
      const color = colors[i % colors.length];

      const x1 = cx + radius * Math.cos(cumulativeAngle);
      const y1 = cy + radius * Math.sin(cumulativeAngle);
      const x2 = cx + radius * Math.cos(cumulativeAngle + angle);
      const y2 = cy + radius * Math.sin(cumulativeAngle + angle);
      const ix1 = cx + innerRadius * Math.cos(cumulativeAngle + angle);
      const iy1 = cy + innerRadius * Math.sin(cumulativeAngle + angle);
      const ix2 = cx + innerRadius * Math.cos(cumulativeAngle);
      const iy2 = cy + innerRadius * Math.sin(cumulativeAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      paths += `<path d="M${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} L${ix1},${iy1} A${innerRadius},${innerRadius} 0 ${largeArc},0 ${ix2},${iy2} Z" fill="${color}" stroke="white" stroke-width="1"/>`;
      legendHTML += `<span class="inline-flex items-center gap-1 text-[0.6rem] text-slate-600 dark:text-slate-300"><span class="inline-block h-2 w-2 rounded-full" style="background:${color}"></span>${slice.symbol} ${(pct * 100).toFixed(0)}%</span>`;

      cumulativeAngle += angle;
    });

    container.innerHTML = `
            <svg viewBox="0 0 ${size} ${size}" class="h-20 w-20 mb-2">
                ${paths}
            </svg>
            <div class="flex flex-wrap justify-center gap-x-2 gap-y-1">
                ${legendHTML}
            </div>
        `;
  }

  initAutoRefresh() {
    const autoRefreshSelect = document.getElementById('auto-refresh-select');
    const savedValue = this.storage.getAutoRefresh();
    const initialValue = savedValue || 'manual';
    if (autoRefreshSelect) {
      autoRefreshSelect.value = initialValue;
    }
    this.applyAutoRefresh(initialValue);
  }

  applyAutoRefresh(value) {
    this.stopAutoRefresh();

    if (!value || value === 'manual') {
      return;
    }

    const recommendedSeconds = this.config.settings?.autoRefreshSeconds || 300;
    const seconds = value === 'recommended' ? recommendedSeconds : parseInt(value, 10);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }

    this.autoRefreshTimer = setInterval(
      () =>
        this.refreshData({
          priceOnly: true,
          includeRecommendation: false,
        }),
      seconds * 1000
    );
    // Kick off an immediate refresh when switching out of manual
    this.refreshData({ priceOnly: true, includeRecommendation: false });
  }

  async fetchFromApi(path, options) {
    if (typeof fetch !== 'function') {
      throw new Error('fetch is not available');
    }
    return fetch(path, options);
  }

  async fetchStockQuote(symbol, options = {}) {
    if (this.stockService?.fetchStockQuote) {
      return this.stockService.fetchStockQuote(symbol, options);
    }
    throw new Error('Stock service not initialized');
  }

  async fetchEquityData(symbols, options = {}) {
    const results = [];
    const cacheTTL = this.config.settings?.cacheExpiry?.stocks || 300000;
    for (const symbol of symbols) {
      const cacheKey = `equity-${symbol}`;
      const cached = this.cache?.get(cacheKey);
      if (cached && !options.forceRefresh) {
        results.push({ success: true, data: cached });
        continue;
      }

      try {
        const data = await this.fetchStockQuote(symbol, options);
        const enhanced = normalizeEquityQuote({ ...data, symbol }, this.config, (resolvedSymbol) =>
          this.getCategory(resolvedSymbol)
        );
        this.cache?.set(cacheKey, enhanced, cacheTTL);
        results.push({ success: true, data: enhanced });
      } catch (error) {
        results.push({ success: false, symbol, error: error.message });
      }
    }
    return results;
  }

  renderStockCard(data, portfolio) {
    if (this.ui?.renderStockCard) {
      this.ui.renderStockCard(data, portfolio);
    }
  }

  updateDataSourceIndicator(sources) {
    if (this.ui?.updateSources) {
      this.ui.updateSources(sources);
    }
  }

  async hydrateFromSnapshot() {
    try {
      const isOk = (resp) => resp && (resp.ok !== undefined ? resp.ok : resp.status >= 200 && resp.status < 300);

      let response = await this.fetchFromApi('/api/snapshot');
      if (!isOk(response)) {
        response = await this.fetchFromApi('/snapshot');
      }
      const status = response?.status;
      if (!isOk(response) || status === 204) {
        return false;
      }
      const snapshot = await response.json();

      const cacheSnapshot = { stocks: [], crypto: [], etfs: [] };

      const cacheTTLStocks = this.config.settings?.cacheExpiry?.stocks || 300000;
      const cacheTTLCrypto = this.config.settings?.cacheExpiry?.crypto || 300000;

      (snapshot.stocks?.results || []).forEach((entry) => {
        if (entry.success && entry.data) {
          const payload = normalizeEquityQuote(
            entry.data,
            this.config,
            (symbol) => this.stockService?.getCategory(symbol) || getInstrumentCategory(symbol, this.config)
          );
          if (payload.category === 'etf') {
            cacheSnapshot.etfs.push(payload);
          } else {
            cacheSnapshot.stocks.push(payload);
          }
          this.cache?.set(`equity-${payload.symbol}`, payload, cacheTTLStocks);
        }
      });

      (snapshot.crypto?.results || []).forEach((entry) => {
        if (entry.success && entry.data) {
          const payload = normalizeCryptoQuote(entry.data);
          cacheSnapshot.crypto.push(payload);
          this.cache?.set(`crypto-${payload.symbol}`, payload, cacheTTLCrypto);
          this.cache?.set(`coingecko-${payload.symbol}`, payload, cacheTTLCrypto);
        }
      });

      const lastUpdated =
        snapshot.metadata?.updatedAt ||
        snapshot.stocks?.fetchedAt ||
        snapshot.crypto?.fetchedAt ||
        new Date().toISOString();
      cacheSnapshot.lastUpdated = lastUpdated;

      const mergedSnapshot = fillMissingCategoriesFromCache(cacheSnapshot, this.storage.getCachedData());
      const { stockSource, cryptoSource } = deriveSources(mergedSnapshot);
      const fallbackStatuses = {
        stocks: cacheSnapshot.stocks.length === 0 && (mergedSnapshot.stocks?.length || 0) > 0 ? 'cached' : null,
        crypto: cacheSnapshot.crypto.length === 0 && (mergedSnapshot.crypto?.length || 0) > 0 ? 'cached' : null,
        etf: cacheSnapshot.etfs.length === 0 && (mergedSnapshot.etfs?.length || 0) > 0 ? 'cached' : null,
      };

      this.lastUpdated = new Date(lastUpdated);
      this.storage.saveLastUpdated(this.lastUpdated);
      this.persistCacheSnapshot(mergedSnapshot, lastUpdated);
      this.renderSnapshotData(mergedSnapshot);
      this.ui?.updateSectionStatuses?.(fallbackStatuses);
      this.ui.updateSources({ stocks: stockSource, crypto: cryptoSource });
      this.updateAnalystPanelToggle();
      this.updateDataSourceIndicator({ stocks: stockSource, crypto: cryptoSource });
      this.updatePortfolioSummary();
      return true;
    } catch (error) {
      console.warn('Snapshot hydrate failed:', error.message);
      return false;
    }
  }
  stopAutoRefresh() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  getLastUpdatedTimestamp() {
    const saved = this.storage.getLastUpdated();
    if (saved) return saved;
    const cached = this.storage.getCachedData();
    if (cached?.lastUpdated) return cached.lastUpdated;
    return this.lastUpdated;
  }

  startLastUpdatedTimer() {
    const update = () => {
      this.updateMarketStatus(new Date());
      const ts = this.getLastUpdatedTimestamp();
      if (ts) {
        this.ui.updateLastUpdated(new Date(ts));
      } else {
        this.ui.updateLastUpdated(null);
      }
    };
    update();
    if (this.lastUpdatedTimer) {
      clearInterval(this.lastUpdatedTimer);
    }
    this.lastUpdatedTimer = setInterval(update, 30000);
  }

  hasCachedData(cached) {
    if (!cached) return false;
    const total = (cached.stocks?.length || 0) + (cached.crypto?.length || 0) + (cached.etfs?.length || 0);
    return total > 0;
  }

  ensureSectionCoverage(renderedCounts = { stocks: 0, crypto: 0, etf: 0 }) {
    const grouped = this.groupStocksByCategory(this.stocks || []);

    if (grouped.stocks.length > 0 && !renderedCounts.stocks && this.ui?.showEmptyState) {
      this.ui.showEmptyState('stocks');
    }
    if (grouped.crypto.length > 0 && !renderedCounts.crypto && this.ui?.showEmptyState) {
      this.ui.showEmptyState('crypto');
    }
    if (grouped.etf.length > 0 && !renderedCounts.etf && this.ui?.showEmptyState) {
      this.ui.showEmptyState('etf');
    }
  }

  renderSnapshotData(cacheSnapshot = { stocks: [], crypto: [], etfs: [], lastUpdated: null }) {
    const renderedCounts = renderTrackedSnapshotData({
      trackedSymbols: this.stocks,
      cacheSnapshot,
      getPortfolioMetrics: (symbol, price) => this.getPortfolioMetrics(symbol, price),
      renderStockCard: (entry, portfolio) => this.renderStockCard(entry, portfolio),
      ui: this.ui,
    });
    this.ensureSectionCoverage(renderedCounts);
    return renderedCounts;
  }

  renderCachedData(cachedParam = undefined) {
    const cached = cachedParam !== undefined ? cachedParam : this.storage.getCachedData();
    if (!cached) {
      this.ui.updateSources({ stocks: '', crypto: '' });
      return;
    }

    this.ui.clearContainers();
    const stockSymbols = this.stocks.filter((s) => !this.isCryptoSymbol(s) && !this.isETFSymbol(s));
    const etfSymbols = this.stocks.filter((s) => this.isETFSymbol(s));
    const cryptoSymbols = this.stocks.filter((s) => this.isCryptoSymbol(s));

    let stockSource = null;
    let cryptoSource = null;
    const renderedCounts = { stocks: 0, crypto: 0, etf: 0 };

    (cached.stocks || []).forEach((entry) => {
      if (stockSymbols.includes(entry.symbol)) {
        entry.changePercent = entry.changePercent ?? entry.changesPercentage ?? 0;
        const portfolio = this.getPortfolioMetrics(entry.symbol, entry.price);
        this.renderStockCard(entry, portfolio);
        renderedCounts.stocks += 1;
        if (!stockSource && (entry.provider || entry.dataSource)) {
          stockSource = entry.provider || entry.dataSource;
        }
      }
    });

    (cached.etfs || []).forEach((entry) => {
      if (etfSymbols.includes(entry.symbol)) {
        entry.changePercent = entry.changePercent ?? entry.changesPercentage ?? 0;
        const portfolio = this.getPortfolioMetrics(entry.symbol, entry.price);
        this.renderStockCard(entry, portfolio);
        renderedCounts.etf += 1;
        if (!stockSource && (entry.provider || entry.dataSource)) {
          stockSource = entry.provider || entry.dataSource;
        }
      }
    });

    (cached.crypto || []).forEach((entry) => {
      if (cryptoSymbols.includes(entry.symbol)) {
        entry.changePercent = entry.changePercent ?? entry.changesPercentage ?? 0;
        const portfolio = this.getPortfolioMetrics(entry.symbol, entry.price);
        this.renderStockCard(entry, portfolio);
        renderedCounts.crypto += 1;
        if (!cryptoSource && (entry.provider || entry.dataSource)) {
          cryptoSource = entry.provider || entry.dataSource;
        }
      }
    });

    if (cached.lastUpdated) {
      this.ui.updateLastUpdated(new Date(cached.lastUpdated));
    } else {
      // fallback to last entry timestamp if available
      const any =
        (cached.stocks && cached.stocks[0]) || (cached.etfs && cached.etfs[0]) || (cached.crypto && cached.crypto[0]);
      if (any?.lastUpdated) {
        this.ui.updateLastUpdated(new Date(any.lastUpdated));
      }
    }

    if (!stockSource && ((cached.stocks && cached.stocks.length > 0) || (cached.etfs && cached.etfs.length > 0))) {
      const first = (cached.stocks && cached.stocks[0]) || (cached.etfs && cached.etfs[0]);
      stockSource = first?.provider || first?.dataSource || 'Stocks';
    }
    if (!cryptoSource && cached.crypto && cached.crypto.length > 0) {
      const first = cached.crypto[0];
      cryptoSource = first?.provider || first?.dataSource || 'CoinGecko';
    }

    this.ensureSectionCoverage(renderedCounts);
    this.ui.updateSectionStatuses({
      stocks: renderedCounts.stocks > 0 ? 'cached' : null,
      crypto: renderedCounts.crypto > 0 ? 'cached' : null,
      etf: renderedCounts.etf > 0 ? 'cached' : null,
    });
    this.ui.updateSources({ stocks: stockSource, crypto: cryptoSource });
    this.updateAnalystPanelToggle();
  }

  persistCacheSnapshot(cacheSnapshot = { stocks: [], crypto: [], etfs: [] }, lastUpdatedOverride = null) {
    persistDashboardCacheSnapshot(this.storage, cacheSnapshot, lastUpdatedOverride);
  }
}

// Initialize in browser (skip during Jest)
const isJest =
  typeof globalThis !== 'undefined' &&
  globalThis.process &&
  globalThis.process.env &&
  globalThis.process.env.JEST_WORKER_ID !== undefined;
if (typeof window !== 'undefined' && !isJest) {
  window.app = new FinanceDashboard();
  window.app.init();
  // Expose for HTML onclick handlers
  window.FinanceDashboard = FinanceDashboard;
}

// CommonJS export for tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FinanceDashboard };
}
