import { loadDashboardConfig } from './services/config-loader.js';
import { applyCategoryOverrides, getConfiguredSymbols, getInstrumentCategory } from './services/instrument-utils.js';
import { StorageService } from './services/storage.js';

// Manage Page Functionality

const BACKUP_VERSION = 1;
const VALID_CATEGORIES = new Set(['stock', 'crypto', 'etf']);
const VALID_SYMBOL = /^[A-Z0-9][A-Z0-9._^-]{0,19}$/;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSymbol(value) {
  const symbol = String(value || '')
    .trim()
    .toUpperCase();
  if (!VALID_SYMBOL.test(symbol)) throw new Error(`Invalid investment symbol: ${value}`);
  return symbol;
}

class ManageInvestments {
  constructor() {
    this.investments = [];
    this.selectedItems = new Set();
    this.storage = new StorageService();
    this.config = {};
    this.init().catch((error) => this.showInitializationError(error));
  }

  showInitializationError(error) {
    console.error('Management page initialization failed:', error);
    const main = document.querySelector('main');
    if (!main) return;
    main.insertAdjacentHTML(
      'afterbegin',
      '<div role="alert" class="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">Management data could not be loaded. <button type="button" class="font-semibold underline" onclick="manageApp.init().catch((error) => manageApp.showInitializationError(error))">Retry</button></div>'
    );
  }

  async init() {
    const config = await loadDashboardConfig(this.storage);
    this.config = applyCategoryOverrides(config, this.storage.getCategories());
    this.loadInvestments();
    this.applyTheme();
    this.setupEventListeners();
    this.renderLists();
  }

  loadInvestments() {
    const existing = JSON.parse(localStorage.getItem('stocks') || '[]');

    let symbols;
    if (existing.length > 0) {
      symbols = existing;
    } else {
      const placeholderSymbols = getConfiguredSymbols(this.config);
      symbols = placeholderSymbols.length > 0 ? placeholderSymbols : [];
      if (symbols.length > 0) {
        localStorage.setItem('stocks', JSON.stringify(symbols));
      }
    }

    this.investments = symbols.flatMap((rawSymbol) => {
      try {
        const symbol = normalizeSymbol(rawSymbol);
        return [{ symbol, category: getInstrumentCategory(symbol, this.config), name: this.getStockName(symbol) }];
      } catch {
        return [];
      }
    });
  }

  getStockName(symbol) {
    // Placeholder - in real app, fetch from API or cache
    const names = {
      AAPL: 'Apple Inc.',
      MSFT: 'Microsoft Corp.',
      GOOGL: 'Alphabet Inc.',
      AMZN: 'Amazon.com Inc.',
      TSLA: 'Tesla Inc.',
      BTC: 'Bitcoin',
      ETH: 'Ethereum',
      SOL: 'Solana',
      SPY: 'SPDR S&P 500 ETF',
      QQQ: 'Invesco QQQ Trust',
      VTI: 'Vanguard Total Stock Market ETF',
    };
    return names[symbol] || symbol;
  }

  setupEventListeners() {
    const addBtn = document.getElementById('add-btn');
    if (addBtn) addBtn.addEventListener('click', () => this.addInvestment());

    const symbolInput = document.getElementById('symbol-input');
    if (symbolInput)
      symbolInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addInvestment();
      });

    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn)
      uploadBtn.addEventListener('click', () => {
        document.getElementById('import-file').click();
      });

    const importFile = document.getElementById('import-file');
    if (importFile)
      importFile.addEventListener('change', (e) => {
        this.importFile(e.target.files[0]);
      });

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn)
      exportBtn.addEventListener('click', () => {
        this.exportData();
      });

    const resetBtn = document.getElementById('reset-data-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const confirmed = confirm(
          'Reset all local dashboard data? This clears symbols, portfolio, theme, and cached data.'
        );
        if (!confirmed) return;

        const keys = [
          'stocks',
          'portfolio',
          'theme',
          'autoRefreshSeconds',
          'minimizedSections',
          'lastUpdated',
          'cachedDashboardData',
          'finance_dashboard_config',
          'assetCategories',
        ];
        keys.forEach((key) => localStorage.removeItem(key));
        window.location.reload();
      });
    }

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    const selectAllBtn = document.getElementById('select-all-btn');
    if (selectAllBtn) selectAllBtn.addEventListener('click', () => this.selectAll());

    const deselectAllBtn = document.getElementById('deselect-all-btn');
    if (deselectAllBtn) deselectAllBtn.addEventListener('click', () => this.deselectAll());

    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', () => this.deleteSelected());
  }

  addInvestment() {
    const input = document.getElementById('symbol-input');
    const categorySelect = document.getElementById('category-select');
    const sharesInput = document.getElementById('shares-input');
    const costBasisInput = document.getElementById('cost-basis-input');
    let symbol;
    try {
      symbol = normalizeSymbol(input.value);
    } catch (error) {
      alert(error.message);
      return;
    }

    if (this.investments.some((inv) => inv.symbol === symbol)) {
      alert(`${symbol} is already in your list`);
      return;
    }

    let category;
    if (categorySelect.value === 'auto') {
      category = getInstrumentCategory(symbol, this.config);
    } else {
      category = categorySelect.value;
    }

    const shares = parseFloat(sharesInput.value) || 0;
    const costBasis = parseFloat(costBasisInput.value) || 0;

    this.investments.push({
      symbol,
      category,
      name: this.getStockName(symbol),
    });

    if (shares > 0) {
      const portfolio = this.storage.getPortfolio();
      portfolio[symbol] = { shares, avgPrice: costBasis };
      this.storage.savePortfolio(portfolio);
    }

    this.saveInvestments();
    this.renderLists();
    input.value = '';
    sharesInput.value = '';
    costBasisInput.value = '';
  }

  removeInvestment(symbol) {
    this.investments = this.investments.filter((inv) => inv.symbol !== symbol);
    const portfolio = this.storage.getPortfolio();
    if (Object.prototype.hasOwnProperty.call(portfolio, symbol)) {
      delete portfolio[symbol];
      this.storage.savePortfolio(portfolio);
    }
    this.saveInvestments();
    this.renderLists();
  }

  editInvestment(symbol) {
    const portfolio = this.storage.getPortfolio();
    const holding = portfolio[symbol] || { shares: 0, avgPrice: 0 };
    const sharesValue = prompt(`Shares held for ${symbol}:`, String(holding.shares ?? 0));
    if (sharesValue === null) return false;
    const costBasisValue = prompt(
      `Average cost basis per share for ${symbol}:`,
      String(holding.avgPrice ?? holding.costBasis ?? 0)
    );
    if (costBasisValue === null) return false;

    const shares = Number(sharesValue);
    const avgPrice = Number(costBasisValue);
    if (!Number.isFinite(shares) || shares <= 0 || !Number.isFinite(avgPrice) || avgPrice < 0) {
      alert('Shares must be greater than zero and cost basis must be zero or greater.');
      return false;
    }

    portfolio[symbol] = { shares, avgPrice };
    this.storage.savePortfolio(portfolio);
    this.renderLists();
    return true;
  }

  importFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.restoreBackup(data);
        document.getElementById('import-file').value = '';
      } catch (error) {
        alert('Unable to restore backup: ' + error.message);
      }
    };
    reader.readAsText(file);
  }

  exportData() {
    const symbols = this.investments.map((inv) => inv.symbol);
    const trackedSymbols = new Set(symbols);
    const portfolio = Object.fromEntries(
      Object.entries(this.storage.getPortfolio()).filter(([symbol]) => trackedSymbols.has(symbol))
    );
    const data = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      symbols,
      portfolio,
      configuration: this.storage.getConfig(),
      categories: Object.fromEntries(this.investments.map((inv) => [inv.symbol, inv.category])),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finance-dashboard-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  normalizeBackup(data) {
    if (!isPlainObject(data)) throw new Error('Backup must be a JSON object.');
    if (data.version !== undefined && data.version !== BACKUP_VERSION) {
      throw new Error(`Unsupported backup version: ${data.version}`);
    }

    const rawSymbols = data.symbols ?? data.stocks;
    if (!Array.isArray(rawSymbols)) throw new Error('Backup is missing its symbols list.');
    const symbols = Array.from(new Set(rawSymbols.map((symbol) => normalizeSymbol(symbol))));
    const trackedSymbols = new Set(symbols);
    const portfolio = data.portfolio ?? {};
    const configuration = data.configuration ?? data.config ?? {};
    const categories = data.categories ?? {};
    if (!isPlainObject(portfolio) || !isPlainObject(configuration) || !isPlainObject(categories)) {
      throw new Error('Portfolio, configuration, and categories must be JSON objects.');
    }

    const normalizedPortfolio = {};
    Object.entries(portfolio).forEach(([rawSymbol, holding]) => {
      if (!isPlainObject(holding)) throw new Error(`Invalid portfolio record for ${rawSymbol}.`);
      const symbol = normalizeSymbol(rawSymbol);
      const shares = Number(holding.shares);
      const avgPrice = Number(holding.avgPrice ?? holding.costBasis ?? 0);
      if (!symbol || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(avgPrice) || avgPrice < 0) {
        throw new Error(`Invalid portfolio values for ${rawSymbol}.`);
      }
      if (trackedSymbols.has(symbol)) normalizedPortfolio[symbol] = { shares, avgPrice };
    });

    const normalizedCategories = {};
    Object.entries(categories).forEach(([rawSymbol, category]) => {
      const symbol = normalizeSymbol(rawSymbol);
      if (!symbol || !VALID_CATEGORIES.has(category)) throw new Error(`Invalid category for ${rawSymbol}.`);
      normalizedCategories[symbol] = category;
    });
    symbols.forEach((symbol) => {
      normalizedCategories[symbol] ||= getInstrumentCategory(
        symbol,
        applyCategoryOverrides(configuration, normalizedCategories)
      );
    });

    return { symbols, portfolio: normalizedPortfolio, configuration, categories: normalizedCategories };
  }

  restoreBackup(data) {
    const backup = this.normalizeBackup(data);
    const keys = ['stocks', 'portfolio', 'finance_dashboard_config', 'assetCategories'];
    const previous = Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));

    try {
      localStorage.setItem('stocks', JSON.stringify(backup.symbols));
      this.storage.savePortfolio(backup.portfolio);
      this.storage.saveConfig(backup.configuration);
      this.storage.saveCategories(backup.categories);
    } catch (error) {
      try {
        keys.forEach((key) => {
          if (previous[key] === null) localStorage.removeItem(key);
          else localStorage.setItem(key, previous[key]);
        });
      } catch (rollbackError) {
        throw new Error(`Backup restore and recovery failed: ${error.message}; ${rollbackError.message}`);
      }
      throw new Error(`Backup restore failed and previous data was recovered: ${error.message}`);
    }

    this.config = applyCategoryOverrides(backup.configuration, backup.categories);
    this.investments = backup.symbols.map((symbol) => ({
      symbol,
      category: backup.categories[symbol],
      name: this.getStockName(symbol),
    }));
    this.renderLists();
    return backup;
  }

  saveInvestments() {
    const symbols = this.investments.map((inv) => inv.symbol);
    localStorage.setItem('stocks', JSON.stringify(symbols));
    this.storage.saveCategories(
      Object.fromEntries(this.investments.map((investment) => [investment.symbol, investment.category]))
    );
  }

  renderLists() {
    const categories = {
      stocks: this.investments.filter((inv) => inv.category === 'stock'),
      crypto: this.investments.filter((inv) => inv.category === 'crypto'),
      etf: this.investments.filter((inv) => inv.category === 'etf'),
    };

    const stocksCount = document.getElementById('stocks-count');
    const cryptoCount = document.getElementById('crypto-count');
    const etfCount = document.getElementById('etf-count');

    if (stocksCount) stocksCount.textContent = categories.stocks.length;
    if (cryptoCount) cryptoCount.textContent = categories.crypto.length;
    if (etfCount) etfCount.textContent = categories.etf.length;

    this.renderCategory('stocks', categories.stocks);
    this.renderCategory('crypto', categories.crypto);
    this.renderCategory('etf', categories.etf);
  }

  renderCategory(categoryId, items) {
    const container = document.getElementById(`${categoryId}-list`);
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `
                <div class="rounded-[1.4rem] border border-dashed border-slate-300/80 bg-slate-50/80 p-8 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-500">
                    <i class="fas fa-inbox mb-3 text-3xl"></i>
                    <p class="text-sm font-medium tracking-wide uppercase">No items yet</p>
                </div>`;
      return;
    }

    container.innerHTML = items
      .map(
        (item) => `
            <div class="investment-item terminal-investment group mb-2 flex items-center justify-between" data-symbol="${item.symbol}">
                <div class="flex items-center space-x-3">
                    <input type="checkbox" class="item-checkbox h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700" data-symbol="${item.symbol}" />
                    <span class="drag-handle cursor-move rounded-full bg-slate-100 px-2 py-1 text-slate-400 transition hover:text-slate-700 dark:bg-slate-800 dark:hover:text-slate-300" title="Drag to reorder">
                        <i class="fas fa-grip-vertical"></i>
                    </span>
                    <div>
                        <span class="block text-base font-bold tracking-tight text-slate-900 dark:text-white">${item.symbol}</span>
                        <span class="block max-w-[180px] truncate text-xs text-slate-500 dark:text-slate-400">${item.name}</span>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button class="edit-btn rounded-full bg-white/80 p-2 text-slate-400 opacity-0 transition hover:bg-blue-50 hover:text-blue-500 focus:opacity-100 group-hover:opacity-100 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-300" data-symbol="${item.symbol}" title="Edit shares and cost basis" aria-label="Edit ${item.symbol} holding">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="delete-btn rounded-full bg-white/80 p-2 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 focus:opacity-100 group-hover:opacity-100 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-300" data-symbol="${item.symbol}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `
      )
      .join('');

    // Re-attach listeners (checkboxes, delete, drag)
    // ... (Simplified for brevity, logic same as before but with Tailwind classes)

    container.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const symbol = e.currentTarget.dataset.symbol;
        if (confirm(`Delete ${symbol}?`)) {
          this.removeInvestment(symbol);
        }
      });
    });

    container.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editInvestment(e.currentTarget.dataset.symbol);
      });
    });

    container.querySelectorAll('.item-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        // Selection logic
      });
    });

    this.setupDragAndDrop(container);
  }

  // ... selectAll, deselectAll, deleteSelected methods ...
  // I'll keep them simple for now or copy from previous if needed.
  // For this refactor, I'll assume basic add/remove is key.
  // I'll add the bulk actions back if requested, but for now I'll stick to core functionality to fit in context.

  selectAll() {
    document.querySelectorAll('.item-checkbox').forEach((cb) => (cb.checked = true));
  }

  deselectAll() {
    document.querySelectorAll('.item-checkbox').forEach((cb) => (cb.checked = false));
  }

  deleteSelected() {
    const checked = Array.from(document.querySelectorAll('.item-checkbox:checked')).map((cb) => cb.dataset.symbol);
    if (checked.length === 0) return;

    if (confirm(`Delete ${checked.length} items?`)) {
      checked.forEach((s) => this.removeInvestment(s));
    }
  }

  setupDragAndDrop(container) {
    const items = container.querySelectorAll('.investment-item');

    items.forEach((item) => {
      item.setAttribute('draggable', 'true');

      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.dataset.symbol);
        item.classList.add('opacity-50');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('opacity-50');
        item.classList.remove('ring-2', 'ring-blue-400');
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        item.classList.add('ring-2', 'ring-blue-400');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('ring-2', 'ring-blue-400');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('ring-2', 'ring-blue-400');
        const fromSymbol = e.dataTransfer.getData('text/plain');
        const toSymbol = item.dataset.symbol;
        this.reorderInvestments(fromSymbol, toSymbol);
      });
    });
  }

  reorderInvestments(fromSymbol, toSymbol) {
    if (!fromSymbol || !toSymbol || fromSymbol === toSymbol) return;

    const fromIndex = this.investments.findIndex((inv) => inv.symbol === fromSymbol);
    const toIndex = this.investments.findIndex((inv) => inv.symbol === toSymbol);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = this.investments.splice(fromIndex, 1);
    this.investments.splice(toIndex, 0, moved);
    this.saveInvestments();
    this.renderLists();
  }

  setTheme(theme) {
    const html = document.documentElement;
    const body = document.body;
    const isDark = theme === 'dark';

    html.classList.toggle('dark', isDark);
    html.classList.toggle('light', !isDark);
    body?.classList.toggle('dark', isDark);
    html.setAttribute('data-theme', theme);
    body?.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const themeIcon = document.querySelector('#theme-toggle i');
    if (themeIcon) {
      themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
  }

  toggleTheme() {
    const current = localStorage.getItem('theme') || 'dark';
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  }

  applyTheme() {
    this.setTheme(localStorage.getItem('theme') || 'dark');
  }
}

// Initialize
let manageApp;
if (typeof window !== 'undefined' && window.location.pathname.includes('manage')) {
  manageApp = new ManageInvestments();
  window.manageApp = manageApp;
}

export { BACKUP_VERSION, ManageInvestments };
