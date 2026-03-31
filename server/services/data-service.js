const path = require('path');
const {
    FinancialModelingPrepClient,
    CoinGeckoClient,
    FinnhubClient,
    AlphaVantageClient,
    YahooFinanceClient,
    RateLimiter,
    EnhancedCache
} = require('./api-clients');

const DEFAULT_RATE_LIMITS = {
    finnhub: { requestsPerMinute: 60, delayBetweenRequests: 1000 },
    fmp: { requestsPerMinute: 250, delayBetweenRequests: 250 },
    alphaVantage: { requestsPerMinute: 5, delayBetweenRequests: 12000 },
    coingecko: { requestsPerMinute: 30, delayBetweenRequests: 2000 },
    yahooFinance: { requestsPerMinute: 20, delayBetweenRequests: 3000 }
};

class DataService {
    constructor(baseConfig = {}, providerConfig = {}) {
        this.baseConfig = baseConfig;
        this.providerConfig = providerConfig;
        this.cache = new EnhancedCache();

        this.initializeClients();
    }

    getRateLimitConfig(providerKey) {
        const settings = this.baseConfig.settings?.rateLimiting || {};
        return settings[providerKey] || DEFAULT_RATE_LIMITS[providerKey] || { requestsPerMinute: 60, delayBetweenRequests: 1000 };
    }

    initializeClients() {
        const config = this.providerConfig || {};

        const finnhubKey = config.finnhub?.apiKey;
        if (finnhubKey) {
            const limiterCfg = this.getRateLimitConfig('finnhub');
            this.finnhubRateLimiter = new RateLimiter(limiterCfg.requestsPerMinute, limiterCfg.delayBetweenRequests);
            this.finnhubClient = new FinnhubClient(finnhubKey, config.finnhub?.baseUrl, this.finnhubRateLimiter);
        } else {
            this.finnhubClient = null;
        }

        const fmpKey = config.financialModelingPrep?.apiKey;
        if (fmpKey) {
            const limiterCfg = this.getRateLimitConfig('fmp');
            this.fmpRateLimiter = new RateLimiter(limiterCfg.requestsPerMinute, limiterCfg.delayBetweenRequests);
            this.fmpClient = new FinancialModelingPrepClient(
                fmpKey,
                config.financialModelingPrep?.baseUrl,
                this.fmpRateLimiter
            );
        } else {
            this.fmpClient = null;
        }

        const alphaKey = config.alphaVantage?.apiKey;
        if (alphaKey) {
            const limiterCfg = this.getRateLimitConfig('alphaVantage');
            this.alphaVantageRateLimiter = new RateLimiter(limiterCfg.requestsPerMinute, limiterCfg.delayBetweenRequests);
            this.alphaVantageClient = new AlphaVantageClient(
                alphaKey,
                config.alphaVantage?.baseUrl,
                this.alphaVantageRateLimiter
            );
        } else {
            this.alphaVantageClient = null;
        }

        const yahooEnabled = config.yahooFinance?.enabled !== false;
        if (yahooEnabled) {
            const limiterCfg = this.getRateLimitConfig('yahooFinance');
            this.yahooFinanceRateLimiter = new RateLimiter(limiterCfg.requestsPerMinute, limiterCfg.delayBetweenRequests);
            this.yahooFinanceClient = new YahooFinanceClient(
                config.yahooFinance?.baseUrl,
                this.yahooFinanceRateLimiter,
                this.baseConfig.api?.yahooFinance?.corsProxy || null
            );
        } else {
            this.yahooFinanceClient = null;
        }

        const coingeckoBase = config.coingecko?.baseUrl || 'https://api.coingecko.com/api/v3';
        const coingeckoKey = config.coingecko?.apiKey || '';
        const limiterCfg = this.getRateLimitConfig('coingecko');
        this.coinGeckoRateLimiter = new RateLimiter(limiterCfg.requestsPerMinute, limiterCfg.delayBetweenRequests);
        this.coinGeckoClient = new CoinGeckoClient(coingeckoBase, coingeckoKey || '');
        this.coinGeckoClient.setRateLimiter(this.coinGeckoRateLimiter);
    }

    getProviderStatus() {
        return {
            finnhub: { enabled: Boolean(this.finnhubClient), baseUrl: this.providerConfig.finnhub?.baseUrl || null },
            financialModelingPrep: { enabled: Boolean(this.fmpClient), baseUrl: this.providerConfig.financialModelingPrep?.baseUrl || null },
            alphaVantage: { enabled: Boolean(this.alphaVantageClient), baseUrl: this.providerConfig.alphaVantage?.baseUrl || null },
            coingecko: { enabled: Boolean(this.coinGeckoClient), baseUrl: this.providerConfig.coingecko?.baseUrl || null },
            yahooFinance: { enabled: Boolean(this.yahooFinanceClient), baseUrl: this.providerConfig.yahooFinance?.baseUrl || null }
        };
    }

    async getEquityQuotes(symbols = [], options = {}) {
        if (!Array.isArray(symbols) || symbols.length === 0) {
            return [];
        }

        const includeRecommendation = options.includeRecommendation !== false;
        const cacheTTL = this.baseConfig.settings?.cacheExpiry?.stocks || 300000;
        const forceRefresh = options.forceRefresh === true;
        const results = [];

        for (const symbol of symbols) {
            const cacheKey = `equity-${symbol}`;
            const cached = this.cache.get(cacheKey);
            if (!forceRefresh) {
                if (cached) {
                    results.push({ success: true, data: cached });
                    continue;
                }
            }

            try {
                const quote = await this.fetchStockQuote(symbol, includeRecommendation);
                const payload = this.mergeSupplementalEquityFields({
                    ...quote,
                    lastUpdated: new Date().toISOString()
                }, cached, includeRecommendation);
                this.cache.set(cacheKey, payload, cacheTTL);
                results.push({ success: true, data: payload });
            } catch (error) {
                results.push({ success: false, symbol, error: error.message });
            }
        }

        return results;
    }

    async fetchStockQuote(symbol, includeRecommendation) {
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
        if (this.yahooFinanceClient) {
            providers.push({ name: 'yahooFinance', client: this.yahooFinanceClient });
        }

        if (providers.length === 0) {
            throw new Error('No stock data provider configured.');
        }

        const errors = [];

        for (const provider of providers) {
            try {
                const quote = await provider.client.getQuote(symbol);

                if (provider.name === 'finnhub' && includeRecommendation) {
                    try {
                        const recommendation = await this.finnhubClient.getRecommendation(symbol);
                        if (recommendation) {
                            quote.recommendation = recommendation.label;
                            quote.recommendationDetails = recommendation;
                        }
                    } catch (recError) {
                        console.warn(`Finnhub recommendation unavailable for ${symbol}: ${recError.message}`);
                    }
                }

                if (includeRecommendation && !quote.recommendation) {
                    quote.recommendation = 'N/A';
                }

                return { ...quote, provider: provider.name };
            } catch (error) {
                errors.push(`${provider.name}: ${error.message}`);
            }
        }

        throw new Error(errors.join(' | '));
    }

    mergeSupplementalEquityFields(incoming = {}, cached = null, includeRecommendation = true) {
        if (includeRecommendation || !cached) {
            return incoming;
        }

        const normalizedRecommendation = typeof incoming.recommendation === 'string'
            ? incoming.recommendation.trim().toUpperCase()
            : incoming.recommendation;
        const hasIncomingRecommendation = incoming.recommendation != null
            && normalizedRecommendation !== ''
            && normalizedRecommendation !== 'N/A';

        return {
            ...incoming,
            recommendation: hasIncomingRecommendation ? incoming.recommendation : cached.recommendation,
            recommendationDetails: incoming.recommendationDetails ?? cached.recommendationDetails ?? null
        };
    }

    async getCryptoQuotes(symbols = [], options = {}) {
        if (!Array.isArray(symbols) || symbols.length === 0) {
            return [];
        }

        if (!this.coinGeckoClient) {
            throw new Error('CoinGecko provider not configured.');
        }

        const cacheTTL = this.baseConfig.settings?.cacheExpiry?.crypto || 60000;
        const forceRefresh = options.forceRefresh === true;
        const results = [];
        const symbolsToFetch = [];

        for (const symbol of symbols) {
            const cacheKey = `crypto-${symbol}`;
            if (!forceRefresh) {
                const cached = this.cache.get(cacheKey);
                if (cached) {
                    results.push({ success: true, data: cached });
                    continue;
                }
            }
            symbolsToFetch.push(symbol);
        }

        if (symbolsToFetch.length === 0) {
            return results;
        }

        try {
            const batch = await this.coinGeckoClient.getMultipleCryptoData(symbolsToFetch);
            for (const entry of batch) {
                if (entry.success) {
                    const payload = {
                        ...entry.data,
                        lastUpdated: new Date().toISOString()
                    };
                    this.cache.set(`crypto-${entry.symbol}`, payload, cacheTTL);
                    results.push({ success: true, data: payload });
                } else {
                    results.push({ success: false, symbol: entry.symbol, error: entry.error });
                }
            }
        } catch (error) {
            for (const symbol of symbolsToFetch) {
                try {
                    const data = await this.coinGeckoClient.getCryptoData(symbol);
                    const payload = {
                        ...data,
                        lastUpdated: new Date().toISOString()
                    };
                    this.cache.set(`crypto-${symbol}`, payload, cacheTTL);
                    results.push({ success: true, data: payload });
                } catch (singleError) {
                    results.push({ success: false, symbol, error: singleError.message });
                }
            }
        }

        return results;
    }

    clearCache() {
        this.cache.clear();
    }
}

module.exports = { DataService };
