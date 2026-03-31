import { normalizeCryptoQuote } from './quote-normalizers.js';

export class CryptoService {
    constructor(apiClients, storageService, config) {
        this.coinGeckoClient = apiClients.coingecko;
        this.storage = storageService;
        this.config = config;
        this.cache = apiClients.cache; // Shared cache
    }

    async fetchCoinGeckoData(symbols, options = {}) {
        if (this.config.backendAvailable) {
            return this.fetchCoinGeckoDataFromServer(symbols, options);
        }
        return this.fetchCoinGeckoDataLocally(symbols, options);
    }

    async fetchCoinGeckoDataFromServer(symbols, options = {}) {
        const results = [];
        const cacheTTL = this.config.settings?.cacheExpiry?.crypto || 60000;
        const forceRefresh = options.forceRefresh === true;
        const symbolsToRequest = [];

        for (const symbol of symbols) {
            const cacheKey = `crypto-${symbol}`;
            const cached = this.cache.get(cacheKey);
            if (cached && !forceRefresh) {
                results.push({ success: true, data: cached });
            } else {
                symbolsToRequest.push(symbol);
            }
        }

        if (symbolsToRequest.length > 0) {
            try {
                const response = await fetch('/api/crypto/quotes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: symbolsToRequest, forceRefresh })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const payload = await response.json();
                (payload.results || []).forEach(entry => {
                    if (entry.success) {
                        const decorated = this.decorateCryptoData(entry.data);
                        this.cache.set(`crypto-${decorated.symbol}`, decorated, cacheTTL);
                        results.push({ success: true, data: decorated });
                    } else {
                        results.push({ success: false, symbol: entry.symbol, error: entry.error });
                    }
                });
            } catch (error) {
                symbolsToRequest.forEach(symbol => {
                    results.push({ success: false, symbol, error: error.message });
                });
            }
        }

        return results;
    }

    decorateCryptoData(data) {
        return normalizeCryptoQuote(data);
    }

    async fetchCoinGeckoDataLocally(symbols, options = {}) {
        const results = [];
        const cacheTTL = this.config.settings?.cacheExpiry?.crypto || 60000; // 1 minute for crypto
        const forceRefresh = options.forceRefresh === true;
        const symbolsToFetch = [];

        for (const symbol of symbols) {
            const cacheKey = `coingecko-${symbol}`;
            const cached = this.cache.get(cacheKey) || this.cache.get(`crypto-${symbol}`);
            if (cached && !forceRefresh) {
                results.push({ success: true, data: cached });
            } else {
                symbolsToFetch.push(symbol);
            }
        }

        if (symbolsToFetch.length === 0) {
            return results;
        }

        if (!this.coinGeckoClient) {
            // Fallback if client not available
            return symbolsToFetch.map(symbol => ({
                success: false,
                error: 'CoinGecko client not initialized',
                symbol
            }));
        }

        try {
            const batchResults = await this.coinGeckoClient.getMultipleCryptoData(symbolsToFetch);

            for (const result of batchResults) {
                const cacheKey = `coingecko-${result.symbol}`;

                if (result.success) {
                    const enhancedData = this.decorateCryptoData({
                        ...result.data,
                        lastUpdated: new Date().toISOString()
                    });

                    this.cache.set(cacheKey, enhancedData, cacheTTL);
                    this.cache.set(`crypto-${enhancedData.symbol}`, enhancedData, cacheTTL);
                    results.push({ success: true, data: enhancedData });
                } else {
                    results.push({ success: false, error: result.error, symbol: result.symbol });
                }
            }
        } catch (batchError) {
            for (const symbol of symbolsToFetch) {
                const cacheKey = `coingecko-${symbol}`;
                try {
                    const data = await this.coinGeckoClient.getCryptoData(symbol);
                    const enhancedData = this.decorateCryptoData({
                        ...data,
                        lastUpdated: new Date().toISOString()
                    });

                    this.cache.set(cacheKey, enhancedData, cacheTTL);
                    this.cache.set(`crypto-${enhancedData.symbol}`, enhancedData, cacheTTL);
                    results.push({ success: true, data: enhancedData });
                } catch (error) {
                    results.push({ success: false, error: error.message, symbol });
                }
            }
        }

        return results;
    }
}
