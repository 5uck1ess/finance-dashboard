export class UIManager {
  constructor(storageService) {
    this.storage = storageService;
    this.containers = {
      stocks: document.getElementById('stocks-container'),
      crypto: document.getElementById('crypto-container'),
      etf: document.getElementById('etf-container'),
    };
    this.sourceLabel = document.getElementById('data-sources');
  }

  clearContainers() {
    Object.values(this.containers).forEach((container) => {
      if (container) container.innerHTML = '';
    });
  }

  showLoadingState() {
    Object.entries(this.containers).forEach(([type, container]) => {
      if (!container) return;
      container.innerHTML = `
        <div class="terminal-state col-span-full" role="status" aria-live="polite">
          <i class="fas fa-circle-notch fa-spin mb-3 text-2xl text-blue-500"></i>
          <p class="text-sm font-medium text-slate-600 dark:text-slate-300">Loading ${type} data…</p>
        </div>`;
    });
  }

  showLoadError() {
    Object.values(this.containers).forEach((container) => {
      if (!container) return;
      container.innerHTML = `
        <div class="terminal-state terminal-state-error col-span-full" role="alert">
          <i class="fas fa-exclamation-circle mb-3 text-2xl text-rose-500"></i>
          <p class="mb-4 text-sm font-medium text-rose-700 dark:text-rose-200">Dashboard data could not be loaded.</p>
          <button type="button" class="rounded-full bg-rose-100 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300" onclick="app.refreshData({ forceRefresh: true }).then((loaded) => { if (!loaded) app.ui.showLoadError(); }).catch(() => app.ui.showLoadError())">
            <i class="fas fa-redo mr-2 text-[0.65rem]"></i>Retry
          </button>
        </div>`;
    });
  }

  showEmptyState(type) {
    const container = this.containers[type];
    if (!container) return;

    const icons = {
      stocks: 'fa-chart-line',
      crypto: 'fa-bitcoin',
      etf: 'fa-layer-group',
    };

    const messages = {
      stocks: 'Add some stocks to get started',
      crypto: 'Add some crypto to track',
      etf: 'Add some ETFs',
    };

    const accents = {
      stocks: 'from-blue-500/20 to-cyan-400/10 text-blue-600 dark:text-blue-300',
      crypto: 'from-amber-400/25 to-orange-400/10 text-amber-600 dark:text-amber-300',
      etf: 'from-violet-500/20 to-fuchsia-400/10 text-violet-600 dark:text-violet-300',
    };

    container.innerHTML = `
            <div class="terminal-state terminal-empty relative col-span-full overflow-hidden">
                <div class="absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${accents[type] || accents.stocks} opacity-90"></div>
                <div class="relative flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                    <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-800/85 shadow-sm">
                        <i class="fas ${icons[type] || 'fa-search'} text-3xl"></i>
                    </div>
                    <h3 class="mb-2 text-xl font-semibold text-slate-900 dark:text-white">No ${type.charAt(0).toUpperCase() + type.slice(1)}</h3>
                    <p class="max-w-sm text-sm leading-6">${messages[type]}</p>
                </div>
            </div>
        `;
  }

  renderStockCard(data, portfolioMetrics) {
    const category = data.category || 'stock';
    const container = this.containers[category === 'stock' ? 'stocks' : category];
    if (!container) return;

    const card = document.createElement('div');
    card.className =
      'asset-card group relative overflow-hidden rounded-[1.2rem] sm:rounded-[1.6rem] border border-white/60 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/70 p-5 sm:p-7 shadow-lg backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:shadow-xl';
    card.dataset.symbol = data.symbol;
    card.dataset.category = category;
    card.dataset.copyText = this.buildCopyText(data);

    const change = Number.isFinite(data.changePercent) ? data.changePercent : 0;
    const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
    const changeTone =
      change >= 0
        ? 'bg-emerald-100/90 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
        : 'bg-rose-100/90 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
    const accentTone = this.getCategoryAccent(category);

    let portfolioHTML = '';
    if (portfolioMetrics) {
      const plColor =
        portfolioMetrics.profitLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
      portfolioHTML = `
                <div class="mt-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/90 bg-slate-50/80 dark:bg-slate-950/35 p-5 text-sm">
                    <div class="mb-3 flex items-center justify-between">
                        <span class="text-slate-500 dark:text-slate-400">Holdings</span>
                        <span class="font-semibold text-slate-900 dark:text-slate-100" data-portfolio="shares">${portfolioMetrics.shares} shares</span>
                    </div>
                    <div class="mb-3 flex items-center justify-between">
                        <span class="text-slate-500 dark:text-slate-400">Value</span>
                        <span class="font-semibold text-slate-900 dark:text-slate-100" data-portfolio="value">$${portfolioMetrics.totalValue.toFixed(2)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-500 dark:text-slate-400">P/L</span>
                        <span class="font-semibold ${plColor}" data-portfolio="pl">
                            ${portfolioMetrics.profitLoss >= 0 ? '+' : ''}$${portfolioMetrics.profitLoss.toFixed(2)}
                            (${portfolioMetrics.profitLossPercent >= 0 ? '+' : ''}${portfolioMetrics.profitLossPercent.toFixed(2)}%)
                        </span>
                    </div>
                </div>
            `;
    }

    let sparklineHTML = '';
    if (data.sparkline7d && data.sparkline7d.length > 1) {
      sparklineHTML = `
                <div class="mt-4 flex items-center gap-2">
                    ${this.buildSparklineSVG(data.sparkline7d, change)}
                    <span class="text-[0.65rem] uppercase tracking-wider text-slate-400 dark:text-slate-500">7d</span>
                </div>
            `;
    }

    let additionalInfo = '';
    if (category === 'crypto' && data.marketCap) {
      additionalInfo = `
                <div class="mt-5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Market Cap: $${this.formatNumber(data.marketCap)}</span>
                    ${data.volume24h ? `<span>Volume: $${this.formatNumber(data.volume24h)}</span>` : ''}
                </div>
            `;
    }

    let ratingHTML = '';
    if (category === 'stock' && data.recommendation && data.recommendation !== 'N/A') {
      const ratingClass = this.getRatingColorClass(data.recommendation);
      ratingHTML = `
                <div class="mt-2">
                    <div class="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${ratingClass}">
                        ${data.recommendation}
                    </div>
                </div>
            `;
    }

    let recommendationTable = '';
    if (category === 'stock' && data.recommendationDetails && data.recommendationDetails.counts) {
      const counts = data.recommendationDetails.counts;
      const total = data.recommendationDetails.totalAnalysts || Object.values(counts).reduce((s, v) => s + (v || 0), 0);
      const rows = [
        { label: 'Strong Buy', key: 'strongBuy', color: 'bg-green-500' },
        { label: 'Buy', key: 'buy', color: 'bg-green-400' },
        { label: 'Hold', key: 'hold', color: 'bg-yellow-400' },
        { label: 'Sell', key: 'sell', color: 'bg-red-400' },
        { label: 'Strong Sell', key: 'strongSell', color: 'bg-red-500' },
      ]
        .map((row) => {
          const val = counts[row.key] || 0;
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          const barFill = Math.max(4, pct); // minimum visual
          return `
                    <div class="mb-2 flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-200">
                        <span class="w-20 sm:w-28 shrink-0 text-gray-200 truncate">${row.label}</span>
                        <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-700/80">
                            <div class="${row.color} h-2.5" style="width:${barFill}%"></div>
                        </div>
                        <span class="w-8 sm:w-10 shrink-0 text-right font-semibold text-gray-100">${val}</span>
                        <span class="w-10 sm:w-12 shrink-0 text-right text-gray-400">${pct}%</span>
                    </div>
                `;
        })
        .join('');

      recommendationTable = `
                <details data-analyst-panel="true" class="mt-6 rounded-2xl border border-slate-700/90 bg-slate-900 p-4 sm:p-5 text-white shadow-inner overflow-hidden">
                    <summary class="flex cursor-pointer list-none flex-col gap-2 sm:gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <span class="text-xs sm:text-sm font-semibold uppercase leading-7 tracking-[0.08em] text-gray-400">Analyst Recommendations</span>
                        <div class="flex w-full items-start justify-between gap-3 sm:w-auto sm:justify-end">
                            <div class="min-w-0 text-left text-sm leading-7 text-gray-300 sm:text-right">
                                <div class="font-semibold text-gray-100">${total || 0} analysts</div>
                                <div>${data.recommendationDetails.period || 'latest'}</div>
                            </div>
                            <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-gray-400">
                                <i class="fas fa-chevron-down text-xs"></i>
                            </span>
                        </div>
                    </summary>
                    <div class="mt-5">
                        ${rows}
                    </div>
                </details>
            `;
    }

    card.innerHTML = `
            <div class="absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${accentTone} opacity-90"></div>
            <div class="relative min-w-0">
                <div class="mb-6 flex items-start justify-between gap-2">
                    <div class="flex items-center gap-3 min-w-0">
                        ${
                          data.image
                            ? `
                        <div class="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/85 dark:bg-slate-800/90 shadow-sm ring-1 ring-slate-200/70 dark:ring-slate-700/80">
                            <img src="${data.image}" alt="${data.symbol}" class="h-6 w-6 sm:h-7 sm:w-7 rounded-full">
                        </div>
                        `
                            : ''
                        }
                        <div class="min-w-0">
                            <h3 class="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                                ${data.symbol}
                            </h3>
                            <p class="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">${category}</p>
                            ${ratingHTML}
                        </div>
                    </div>
                    <button class="flex-shrink-0 rounded-full bg-white/75 p-2 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 focus:opacity-100 group-hover:opacity-100 dark:bg-slate-800/85 dark:text-slate-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-300" onclick="app.removeStock('${data.symbol}')" aria-label="Remove ${data.symbol}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="mb-4 flex flex-wrap items-end gap-3">
                    <div class="min-w-0">
                        <span class="block text-[0.7rem] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Last price</span>
                        <span class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white" data-role="price">$${data.price.toFixed(2)}</span>
                    </div>
                    <div class="inline-flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold ${changeTone}" data-role="change-container">
                        <i class="fas ${changeIcon} mr-1 text-xs"></i>
                        <span data-role="change-percent">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</span>
                        <span class="ml-1 text-[0.65rem] sm:text-[0.72rem] font-medium uppercase tracking-[0.18em] opacity-75">today</span>
                    </div>
                </div>

                ${sparklineHTML}
                ${portfolioHTML}
                ${additionalInfo}
                ${recommendationTable}
            </div>
        `;

    container.appendChild(card);
  }

  flashElement(el) {
    if (!el) return;
    el.classList.add('price-flash');
    el.addEventListener('animationend', () => el.classList.remove('price-flash'), { once: true });
  }

  updateRenderedCard(data, portfolioMetrics) {
    const card = document.querySelector(`div[data-symbol="${data.symbol}"]`);
    if (!card) {
      this.renderStockCard(data, portfolioMetrics);
      return;
    }
    card.dataset.copyText = this.buildCopyText(data);

    const priceEl = card.querySelector('[data-role="price"]');
    if (priceEl) {
      const oldPrice = priceEl.textContent;
      const newPrice = `$${data.price.toFixed(2)}`;
      if (oldPrice !== newPrice) {
        priceEl.textContent = newPrice;
        this.flashElement(priceEl);
      }
    }

    const changeContainer = card.querySelector('[data-role="change-container"]');
    const changePercentEl = card.querySelector('[data-role="change-percent"]');
    if (changeContainer && changePercentEl) {
      const change = Number.isFinite(data.changePercent) ? data.changePercent : 0;
      const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
      const changeTone =
        change >= 0
          ? 'bg-emerald-100/90 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'bg-rose-100/90 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';

      changeContainer.className = `inline-flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base font-semibold ${changeTone}`;
      changeContainer.innerHTML = `
                <i class="fas ${changeIcon} mr-1 text-xs"></i>
                <span data-role="change-percent">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</span>
                <span class="ml-1 text-[0.65rem] sm:text-[0.72rem] font-medium uppercase tracking-[0.18em] opacity-75">today</span>
            `;
      this.flashElement(changeContainer);
    }

    if (portfolioMetrics) {
      const sharesEl = card.querySelector('[data-portfolio="shares"]');
      const valueEl = card.querySelector('[data-portfolio="value"]');
      const plEl = card.querySelector('[data-portfolio="pl"]');
      if (sharesEl) sharesEl.textContent = `${portfolioMetrics.shares} shares`;
      if (valueEl) valueEl.textContent = `$${portfolioMetrics.totalValue.toFixed(2)}`;
      if (plEl) {
        plEl.classList.remove('text-green-600', 'dark:text-green-400', 'text-red-600', 'dark:text-red-400');
        plEl.classList.add(
          ...(portfolioMetrics.profitLoss >= 0
            ? ['text-green-600', 'dark:text-green-400']
            : ['text-red-600', 'dark:text-red-400'])
        );
        plEl.textContent = `${portfolioMetrics.profitLoss >= 0 ? '+' : ''}$${portfolioMetrics.profitLoss.toFixed(2)} (${portfolioMetrics.profitLossPercent >= 0 ? '+' : ''}${portfolioMetrics.profitLossPercent.toFixed(2)}%)`;
      }
    }
  }

  showSkeletonCards(type, count = 3) {
    const container = this.containers[type];
    if (!container) return;

    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className =
        'skeleton-card relative overflow-hidden rounded-[1.6rem] border border-white/60 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/70 p-7 shadow-lg backdrop-blur-md animate-pulse';
      skeleton.innerHTML = `
                <div class="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-slate-200/40 to-slate-100/20 dark:from-slate-700/30 dark:to-slate-800/10"></div>
                <div class="relative">
                    <div class="mb-6 flex items-start justify-between">
                        <div class="flex items-center gap-3">
                            <div class="h-12 w-12 rounded-2xl bg-slate-200 dark:bg-slate-700"></div>
                            <div>
                                <div class="mb-2 h-5 w-20 rounded bg-slate-200 dark:bg-slate-700"></div>
                                <div class="h-3 w-12 rounded bg-slate-200 dark:bg-slate-700"></div>
                            </div>
                        </div>
                    </div>
                    <div class="mb-4">
                        <div class="mb-1 h-3 w-16 rounded bg-slate-200 dark:bg-slate-700"></div>
                        <div class="h-8 w-32 rounded bg-slate-200 dark:bg-slate-700"></div>
                    </div>
                    <div class="h-10 w-28 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                </div>
            `;
      container.appendChild(skeleton);
    }
  }

  clearSkeletons() {
    document.querySelectorAll('.skeleton-card').forEach((el) => el.remove());
  }

  renderErrorCard(symbol, error) {
    const container = this.containers.stocks;
    if (!container) return;

    const card = document.createElement('div');
    card.className =
      'asset-card asset-card-error relative overflow-hidden rounded-[1.6rem] border border-rose-200/70 dark:border-rose-900/60 bg-rose-50/90 dark:bg-rose-950/30 p-6 shadow-lg';
    card.dataset.symbol = symbol;
    card.innerHTML = `
            <div class="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-rose-400/25 to-orange-300/10"></div>
            <div class="relative">
                <div class="mb-3 flex items-start justify-between">
                    <h3 class="text-lg font-bold text-rose-700 dark:text-rose-300">${symbol}</h3>
                    <button class="rounded-full bg-white/70 p-2 text-rose-400 transition hover:text-rose-600 dark:bg-slate-900/70 dark:text-rose-500" onclick="app.removeStock('${symbol}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="mb-4 flex items-center text-sm text-rose-700 dark:text-rose-200">
                    <i class="fas fa-exclamation-circle mr-2"></i>
                    ${error}
                </div>
                <button class="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/60" onclick="app.refreshData({ forceRefresh: true })">
                    <i class="fas fa-redo text-[0.65rem]"></i>
                    Retry
                </button>
            </div>
        `;
    container.appendChild(card);
  }

  buildSparklineSVG(points, change = 0) {
    if (!points || points.length < 2) return '';

    // Downsample to ~40 points for a clean sparkline
    const maxPoints = 40;
    let sampled = points;
    if (points.length > maxPoints) {
      const step = points.length / maxPoints;
      sampled = [];
      for (let i = 0; i < maxPoints; i++) {
        sampled.push(points[Math.floor(i * step)]);
      }
    }

    const width = 120;
    const height = 32;
    const padding = 1;
    const min = Math.min(...sampled);
    const max = Math.max(...sampled);
    const range = max - min || 1;

    const pathPoints = sampled.map((val, i) => {
      const x = padding + (i / (sampled.length - 1)) * (width - 2 * padding);
      const y = padding + (1 - (val - min) / range) * (height - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const strokeColor = change >= 0 ? '#10b981' : '#ef4444';

    return `
            <svg viewBox="0 0 ${width} ${height}" class="h-8 w-full max-w-[120px]" preserveAspectRatio="none">
                <polyline
                    points="${pathPoints.join(' ')}"
                    fill="none"
                    stroke="${strokeColor}"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    vector-effect="non-scaling-stroke"
                />
            </svg>
        `;
  }

  removeCardAnimated(symbol) {
    const card = document.querySelector(`[data-symbol="${symbol}"]`);
    if (!card) return;
    card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    card.addEventListener('transitionend', () => card.remove(), { once: true });
    // Fallback if transitionend doesn't fire
    setTimeout(() => {
      if (card.parentNode) card.remove();
    }, 400);
  }

  // Helpers
  formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  }

  getRatingColorClass(rating) {
    const r = rating.toLowerCase();
    if (r.includes('buy')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    if (r.includes('sell')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  }

  getCategoryAccent(category) {
    if (category === 'crypto') {
      return 'from-amber-400/30 via-orange-300/18 to-transparent';
    }
    if (category === 'etf') {
      return 'from-violet-400/24 via-fuchsia-300/12 to-transparent';
    }
    return 'from-blue-400/24 via-cyan-300/16 to-transparent';
  }

  updateLastUpdated(date) {
    const el = document.getElementById('last-updated');
    if (!el) return;
    const ts = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(ts.getTime())) {
      el.textContent = 'Last updated: Never';
      el.removeAttribute('title');
      el.classList?.remove?.('hidden');
      return;
    }
    el.title = ts.toLocaleString();

    const now = new Date();
    const diffMs = now - ts;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays >= 7) {
      el.classList?.add?.('hidden');
      return;
    }

    el.classList?.remove?.('hidden');

    if (diffSec < 45) {
      el.textContent = 'Updated just now';
    } else if (diffMin < 60) {
      el.textContent = `Updated ${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      el.textContent = `Updated ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else {
      el.textContent = `Updated ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
  }

  copyToClipboard(text, element, successMessage = 'Copied!') {
    const showTooltip = (message) => {
      if (!element?.parentNode) return;
      const tooltip = document.createElement('div');
      tooltip.className =
        'absolute -top-10 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-slate-700';
      tooltip.textContent = message;
      element.parentNode.appendChild(tooltip);
      setTimeout(() => tooltip.remove(), 1500);
    };

    const fallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => showTooltip(successMessage))
        .catch(() => showTooltip(fallbackCopy() ? successMessage : 'Copy failed'));
      return;
    }

    showTooltip(fallbackCopy() ? successMessage : 'Copy failed');
  }

  buildCopyText(data) {
    const symbol = (data?.symbol || '').toUpperCase();
    const price = Number.isFinite(data?.price) ? data.price.toFixed(2) : 'N/A';
    const change = Number.isFinite(data?.changePercent)
      ? ` (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)`
      : '';
    return `${symbol}: $${price}${change}`;
  }

  copyAllVisibleSymbolsAndPrices(buttonEl) {
    const orderedCards = ['stocks', 'crypto', 'etf'].flatMap((type) => {
      const container = this.containers[type];
      if (!container) return [];
      return Array.from(container.querySelectorAll('[data-symbol]'));
    });

    const lines = orderedCards.map((card) => card.dataset.copyText).filter(Boolean);

    if (lines.length === 0) {
      this.copyToClipboard('No instruments loaded.', buttonEl, 'Nothing to copy');
      return;
    }

    this.copyToClipboard(lines.join('\n'), buttonEl, 'Copied all prices!');
  }

  updateSources({ stocks, crypto }) {
    const buildBadge = (label, value, fallback) => {
      const display = value || fallback || 'N/A';
      return `
                <span class="inline-flex items-center rounded-full border border-white/60 bg-white/75 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-200">
                    <i class="fas fa-plug mr-2 text-slate-400"></i>
                    ${label}: ${display}
                </span>
            `;
    };

    if (!this.sourceLabel) return;
    const hasStocks = Boolean(stocks);
    const hasCrypto = Boolean(crypto);
    if (!hasStocks && !hasCrypto) {
      this.sourceLabel.innerHTML = '';
      this.sourceLabel.classList.add('hidden');
      return;
    }
    this.sourceLabel.classList.remove('hidden');
    this.sourceLabel.innerHTML = `
            ${hasStocks ? buildBadge('Stocks', stocks, 'Stocks') : ''}
            ${hasCrypto ? buildBadge('Crypto', crypto, 'CoinGecko') : ''}
        `;
  }

  updateSectionStatuses(statuses = {}) {
    const sectionIds = {
      stocks: 'stocks-status',
      crypto: 'crypto-status',
      etf: 'etf-status',
    };

    Object.entries(sectionIds).forEach(([type, id]) => {
      const badge = document.getElementById(id);
      if (!badge) return;

      if (statuses[type] === 'cached') {
        badge.textContent = 'Cached';
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    });
  }

  getAnalystPanels() {
    return Array.from(document.querySelectorAll('details[data-analyst-panel="true"]'));
  }

  setAllAnalystPanels(isOpen) {
    this.getAnalystPanels().forEach((panel) => {
      panel.open = isOpen;
    });
  }

  getAnalystPanelState() {
    const panels = this.getAnalystPanels();
    return {
      count: panels.length,
      allOpen: panels.length > 0 && panels.every((panel) => panel.open),
    };
  }

  sortCards(sortKey) {
    const comparators = {
      'alpha-asc': (a, b) => a.localeCompare(b),
      'alpha-desc': (a, b) => b.localeCompare(a),
      'change-desc': (a, b, aEl, bEl) => this._getCardChange(bEl) - this._getCardChange(aEl),
      'change-asc': (a, b, aEl, bEl) => this._getCardChange(aEl) - this._getCardChange(bEl),
      'price-desc': (a, b, aEl, bEl) => this._getCardPrice(bEl) - this._getCardPrice(aEl),
      'price-asc': (a, b, aEl, bEl) => this._getCardPrice(aEl) - this._getCardPrice(bEl),
    };

    const comparator = comparators[sortKey];
    if (!comparator) return;

    Object.values(this.containers).forEach((container) => {
      if (!container) return;
      const cards = Array.from(container.querySelectorAll('[data-symbol]'));
      if (cards.length < 2) return;

      cards.sort((aEl, bEl) => {
        const aSymbol = aEl.dataset.symbol || '';
        const bSymbol = bEl.dataset.symbol || '';
        return comparator(aSymbol, bSymbol, aEl, bEl);
      });

      cards.forEach((card) => container.appendChild(card));
    });
  }

  _getCardPrice(el) {
    const priceEl = el?.querySelector('[data-role="price"]');
    if (!priceEl) return 0;
    return parseFloat(priceEl.textContent.replace(/[^0-9.-]/g, '')) || 0;
  }

  _getCardChange(el) {
    const changeEl = el?.querySelector('[data-role="change-percent"]');
    if (!changeEl) return 0;
    return parseFloat(changeEl.textContent.replace(/[^0-9.-]/g, '')) || 0;
  }
}
