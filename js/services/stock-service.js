import { getInstrumentCategory, isCryptoSymbol, isETFSymbol } from './instrument-utils.js';
import { normalizeEquityQuote } from './quote-normalizers.js';

export class StockService {
    constructor(apiClients, storageService, config) {
        this.finnhubClient = apiClients.finnhub;
        this.fmpClient = apiClients.fmp;
        this.alphaVantageClient = apiClients.alphaVantage;
        this.yahooFinanceClient = apiClients.yahooFinance;
        this.storage = storageService;
        this.config = config;
        this.cache = apiClients.cache; // Shared cache
    }

    isCrypto(symbol) {
        return isCryptoSymbol(symbol, this.config);
    }

    isETF(symbol) {
        return isETFSymbol(symbol, this.config);
    }

    getCategory(symbol) {
        return getInstrumentCategory(symbol, this.config);
    }

    async fetchEquityData(symbols, options = {}) {
        if (this.config.backendAvailable) {
            return this.fetchEquityDataFromServer(symbols, options);
        }
        return this.fetchEquityDataLocally(symbols, options);
    }

    async fetchEquityDataFromServer(symbols, options = {}) {
        const results = [];
        const cacheTTL = this.config.settings?.cacheExpiry?.stocks || 300000;
        const includeRecommendation = options.includeRecommendation !== false;
        const forceRefresh = options.forceRefresh === true;
        const symbolsToRequest = [];

        for (const symbol of symbols) {
            const cacheKey = `equity-${symbol}`;
            const cached = this.cache.get(cacheKey);
            if (cached && !forceRefresh) {
                results.push({ success: true, data: cached });
            } else {
                symbolsToRequest.push(symbol);
            }
        }

        if (symbolsToRequest.length > 0) {
            try {
                const response = await fetch('/api/stocks/quotes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        symbols: symbolsToRequest,
                        includeRecommendation,
                        forceRefresh
                    })
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const payload = await response.json();
                (payload.results || []).forEach(entry => {
                    if (entry.success) {
                        const enhancedData = this.decorateEquityData(entry.data);
                        if (!includeRecommendation) {
                            const cached = this.cache.get(`equity-${enhancedData.symbol}`);
                            if (cached?.recommendation) {
                                enhancedData.recommendation = cached.recommendation;
                                enhancedData.recommendationDetails = cached.recommendationDetails || null;
                            }
                        }
                        this.cache.set(`equity-${enhancedData.symbol}`, enhancedData, cacheTTL);
                        results.push({ success: true, data: enhancedData });
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

    decorateEquityData(data) {
        return normalizeEquityQuote(data, this.config, (symbol) => this.getCategory(symbol));
    }

    async fetchEquityDataLocally(symbols, options = {}) {
        const results = [];
        const cacheTTL = this.config.settings?.cacheExpiry?.stocks || 300000; // 5 minutes

        for (const symbol of symbols) {
            const cacheKey = `equity-${symbol}`;
            const cached = this.cache.get(cacheKey);

            if (cached && !options.forceRefresh) {
                results.push({ success: true, data: cached });
                continue;
            }

            try {
                const data = await this.fetchStockQuote(symbol, options);
                if (cached && options.includeRecommendation === false) {
                    data.recommendation = cached.recommendation;
                    data.recommendationDetails = cached.recommendationDetails;
                }
                const enhancedData = this.decorateEquityData({
                    ...data,
                    lastUpdated: new Date().toISOString()
                });

                this.cache.set(cacheKey, enhancedData, cacheTTL);
                results.push({ success: true, data: enhancedData });
            } catch (error) {
                results.push({ success: false, error: error.message, symbol });
            }
        }

        return results;
    }

    async fetchStockQuote(symbol, options = {}) {
        const includeRecommendation = options.includeRecommendation !== false;
        const providers = [];

        if (this.finnhubClient) {
            providers.push({ name: 'finnhub', client: this.finnhubClient });
        }

        if (this.fmpClient) {
            providers.push({ name: 'financialModelingPrep', client: this.fmpClient });
        }

        if (this.alphaVantageClient) {
            providers.push({ name: 'alphaVantage', client: this.alphaVantageClient });
        }

        // Add Yahoo Finance as last fallback (no API key required)
        if (this.yahooFinanceClient) {
            providers.push({ name: 'yahooFinance', client: this.yahooFinanceClient });
        }

        if (providers.length === 0) {
            throw new Error('No stock data provider configured.');
        }

        const errors = [];

        for (const provider of providers) {
            try {
                const data = await provider.client.getQuote(symbol);

                if (provider.name === 'finnhub' && includeRecommendation) {
                    try {
                        const recommendation = await this.finnhubClient.getRecommendation(symbol);
                        if (recommendation) {
                            data.recommendation = recommendation.label;
                            data.recommendationDetails = recommendation;
                        }
                    } catch (recError) {
                        console.warn(`Finnhub recommendation unavailable for ${symbol}:`, recError.message);
                    }
                }

                if (includeRecommendation && !data.recommendation) {
                    data.recommendation = 'N/A';
                }

                return { ...data, provider: provider.name };
            } catch (error) {
                errors.push(`${provider.name}: ${error.message}`);
            }
        }

        throw new Error(errors.join(' | '));
    }
}
