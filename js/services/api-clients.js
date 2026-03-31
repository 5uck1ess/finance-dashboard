// API Client Classes for Finance Dashboard

/**
 * Financial Modeling Prep API Client
 * Handles stocks and ETFs data
 */
export class FinancialModelingPrepClient {
    constructor(apiKey, baseUrl, rateLimiter) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || 'https://financialmodelingprep.com/api/v3';
        this.rateLimiter = rateLimiter;
    }

    /**
     * Fetch quote data for a stock/ETF
     */
    async getQuote(symbol) {
        if (!this.apiKey || this.apiKey === 'YOUR_FMP_API_KEY') {
            throw new Error('Financial Modeling Prep API key not configured');
        }

        await this.rateLimiter.wait();

        const url = `${this.baseUrl}/quote/${symbol}?apikey=${this.apiKey}`;

        try {
            const response = await fetch(url);

            if (response.status === 403) {
                console.warn(`Quote endpoint returned 403 for ${symbol}, attempting quote-short fallback.`);
                return await this.getQuoteShortFallback(symbol);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // FMP returns array, take first element or handle single object
            const quote = Array.isArray(data) ? data[0] : data;

            if (!quote || !quote.symbol) {
                throw new Error(`No data found for symbol: ${symbol}`);
            }

            return {
                symbol: quote.symbol,
                price: parseFloat(quote.price) || parseFloat(quote.close) || 0,
                change: parseFloat(quote.change) || 0,
                changesPercentage: parseFloat(quote.changesPercentage) || 0,
                dayLow: parseFloat(quote.dayLow) || 0,
                dayHigh: parseFloat(quote.dayHigh) || 0,
                yearHigh: parseFloat(quote.yearHigh) || 0,
                yearLow: parseFloat(quote.yearLow) || 0,
                marketCap: parseFloat(quote.marketCap) || 0,
                priceAvg50: parseFloat(quote.priceAvg50) || 0,
                priceAvg200: parseFloat(quote.priceAvg200) || 0,
                volume: parseInt(quote.volume) || 0,
                avgVolume: parseInt(quote.avgVolume) || 0,
                timestamp: parseInt(quote.timestamp) || Date.now(),
                name: quote.name || symbol,
                exchange: quote.exchange || 'N/A'
            };
        } catch (error) {
            if (error.message.includes('HTTP 403')) {
                return await this.getQuoteShortFallback(symbol);
            }
            throw new Error(`FMP API Error for ${symbol}: ${error.message}`);
        }
    }

    async getQuoteShortFallback(symbol) {
        const shortUrl = `${this.baseUrl}/quote-short/${symbol}?apikey=${this.apiKey}`;

        try {
            const response = await fetch(shortUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const quote = Array.isArray(data) ? data[0] : data;

            if (!quote || !quote.symbol) {
                throw new Error(`Fallback endpoint returned no data for ${symbol}`);
            }

            let profile = null;
            try {
                profile = await this.fetchProfile(symbol);
            } catch (profileError) {
                console.warn(`Profile data unavailable for ${symbol}: ${profileError.message}`);
            }

            const price = parseFloat(quote.price) || parseFloat(profile?.price) || 0;
            const profileChange = parseFloat(profile?.changes);
            const change = Number.isFinite(profileChange) ? profileChange : 0;
            const profileChangePct = parseFloat(profile?.changesPercentage);
            const changesPercentage = Number.isFinite(profileChangePct) ? profileChangePct : 0;

            return {
                symbol: quote.symbol,
                price,
                change,
                changesPercentage,
                dayLow: 0,
                dayHigh: 0,
                yearHigh: 0,
                yearLow: 0,
                marketCap: parseFloat(profile?.mktCap) || 0,
                priceAvg50: 0,
                priceAvg200: 0,
                volume: parseInt(quote.volume) || 0,
                avgVolume: parseInt(profile?.volAvg) || 0,
                timestamp: Date.now(),
                name: profile?.companyName || quote.symbol,
                exchange: profile?.exchangeShortName || profile?.exchange || 'N/A',
                dataSource: 'quote-short'
            };
        } catch (error) {
            throw new Error(`FMP fallback error for ${symbol}: ${error.message}. Financial Modeling Prep recently tightened browser-origin enforcement—configure a server-side proxy or an alternate provider like Alpha Vantage if the legacy allowance expired.`);
        }
    }

    async fetchProfile(symbol) {
        const profileUrl = `${this.baseUrl}/profile/${symbol}?apikey=${this.apiKey}`;
        const response = await fetch(profileUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return Array.isArray(data) ? data[0] : data;
    }

    /**
     * Get multiple quotes in batch (if supported)
     */
    async getMultipleQuotes(symbols) {
        const results = [];
        for (const symbol of symbols) {
            try {
                const quote = await this.getQuote(symbol);
                results.push({ success: true, data: quote });
            } catch (error) {
                results.push({ success: false, error: error.message, symbol });
            }
        }
        return results;
    }

    /**
     * Search for symbols
     */
    async searchSymbols(query) {
        await this.rateLimiter.wait();

        const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}&limit=10&exchange=NASDAQ,NSE`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data.map(item => ({
                symbol: item.symbol,
                name: item.name,
                currency: item.currency || 'USD',
                exchange: item.exchangeShortName || 'N/A'
            }));
        } catch (error) {
            throw new Error(`FMP Search Error: ${error.message}`);
        }
    }
}

/**
 * Finnhub API Client
 * Primary stock data provider with generous free tier (60 req/min)
 */
export class FinnhubClient {
    constructor(apiKey, baseUrl, rateLimiter) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || 'https://finnhub.io/api/v1';
        this.rateLimiter = rateLimiter;
        this.profileCache = new Map();
        this.recommendationCache = new Map();
    }

    async getQuote(symbol) {
        if (!this.apiKey || this.apiKey === 'YOUR_FINNHUB_API_KEY') {
            throw new Error('Finnhub API key not configured');
        }

        await this.rateLimiter?.wait();

        const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data || typeof data.c === 'undefined') {
                throw new Error(`No data found for symbol: ${symbol}`);
            }

            let profile = await this.getProfile(symbol);
            if (!profile || Object.keys(profile).length === 0) {
                profile = null;
            }

            const price = parseFloat(data.c) || 0;
            const changeValue = parseFloat(data.d);
            const change = Number.isFinite(changeValue) ? changeValue : 0;
            const changePctValue = parseFloat(data.dp);
            const changePct = Number.isFinite(changePctValue) ? changePctValue : 0;
            const rawTimestamp = parseInt(data.t, 10);
            const timestamp = Number.isFinite(rawTimestamp) && rawTimestamp > 0 ? rawTimestamp * 1000 : Date.now();

            return {
                symbol: profile?.ticker || symbol,
                price,
                change,
                changesPercentage: changePct,
                dayLow: parseFloat(data.l) || 0,
                dayHigh: parseFloat(data.h) || 0,
                yearHigh: 0,
                yearLow: 0,
                marketCap: parseFloat(profile?.marketCapitalization) || 0,
                priceAvg50: 0,
                priceAvg200: 0,
                volume: 0,
                avgVolume: 0,
                timestamp,
                name: profile?.name || symbol,
                exchange: profile?.exchange || 'Finnhub',
                currency: profile?.currency || 'USD',
                dataSource: 'finnhub'
            };
        } catch (error) {
            throw new Error(`Finnhub error for ${symbol}: ${error.message}`);
        }
    }

    async getProfile(symbol) {
        if (this.profileCache.has(symbol)) {
            return this.profileCache.get(symbol);
        }

        await this.rateLimiter?.wait();

        const profileUrl = `${this.baseUrl}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`;
        const response = await fetch(profileUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.profileCache.set(symbol, data);
        return data;
    }

    async getRecommendation(symbol) {
        const cached = this.recommendationCache.get(symbol);
        if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) { // 1 hour cache
            return cached.data;
        }

        await this.rateLimiter?.wait();

        const url = `${this.baseUrl}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        const latest = data[0];
        const recommendation = this.buildRecommendation(latest);
        if (recommendation) {
            this.recommendationCache.set(symbol, { timestamp: Date.now(), data: recommendation });
        }

        return recommendation;
    }

    buildRecommendation(entry) {
        const counts = {
            strongBuy: parseInt(entry.strongBuy, 10) || 0,
            buy: parseInt(entry.buy, 10) || 0,
            hold: parseInt(entry.hold, 10) || 0,
            sell: parseInt(entry.sell, 10) || 0,
            strongSell: parseInt(entry.strongSell, 10) || 0
        };

        const totalAnalysts = Object.values(counts).reduce((sum, val) => sum + val, 0);
        if (totalAnalysts === 0) {
            return null;
        }

        const labels = {
            strongBuy: 'Strong Buy',
            buy: 'Buy',
            hold: 'Hold',
            sell: 'Sell',
            strongSell: 'Strong Sell'
        };

        const bestKey = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([key]) => key)[0];

        return {
            label: labels[bestKey] || 'N/A',
            totalAnalysts,
            period: entry.period,
            counts
        };
    }
}

/**
 * Alpha Vantage API Client
 * Provides fallback data when FMP access is restricted
 */
export class AlphaVantageClient {
    constructor(apiKey, baseUrl, rateLimiter) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || 'https://www.alphavantage.co';
        this.rateLimiter = rateLimiter;
    }

    async getQuote(symbol) {
        if (!this.apiKey || this.apiKey === 'YOUR_ALPHA_VANTAGE_API_KEY') {
            throw new Error('Alpha Vantage API key not configured');
        }

        if (this.rateLimiter) {
            await this.rateLimiter.wait();
        }

        const url = `${this.baseUrl}/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.Information || data.Note || data['Error Message']) {
                const apiMessage = data.Information || data.Note || data['Error Message'];
                throw new Error(apiMessage);
            }

            const quote = data['Global Quote'];

            if (!quote || Object.keys(quote).length === 0) {
                throw new Error(`No data found for symbol: ${symbol}`);
            }

            const changePercent = this.parsePercent(quote['10. change percent']);

            return {
                symbol: quote['01. symbol'] || symbol,
                price: parseFloat(quote['05. price']) || 0,
                change: parseFloat(quote['09. change']) || 0,
                changesPercentage: changePercent,
                dayLow: parseFloat(quote['04. low']) || 0,
                dayHigh: parseFloat(quote['03. high']) || 0,
                yearHigh: 0,
                yearLow: 0,
                marketCap: 0,
                priceAvg50: 0,
                priceAvg200: 0,
                volume: parseInt(quote['06. volume']) || 0,
                avgVolume: 0,
                timestamp: Date.now(),
                name: symbol,
                exchange: 'Alpha Vantage',
                dataSource: 'alpha-vantage'
            };
        } catch (error) {
            throw new Error(`Alpha Vantage error for ${symbol}: ${error.message}`);
        }
    }

    parsePercent(value) {
        if (typeof value === 'string') {
            return parseFloat(value.replace('%', '')) || 0;
        }
        return parseFloat(value) || 0;
    }
}

/**
 * Yahoo Finance API Client
 * Optional fallback provider - no API key required
 * Uses unofficial v8 chart endpoint
 */
export class YahooFinanceClient {
    constructor(baseUrl, rateLimiter, corsProxy = null) {
        this.baseUrl = baseUrl || 'https://query1.finance.yahoo.com/v8/finance/chart';
        this.rateLimiter = rateLimiter;
        this.corsProxy = corsProxy; // Optional CORS proxy URL
        this.quoteSummaryBase = this.buildQuoteSummaryBase(this.baseUrl);
        this.recommendationCache = new Map();
        this.defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json,text/plain,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
        };
    }

    buildQuoteSummaryBase(chartBase) {
        const defaultBase = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';
        if (!chartBase) {
            return defaultBase;
        }
        if (chartBase.includes('query1.finance.yahoo.com')) {
            return chartBase.replace('query1.finance.yahoo.com/v8/finance/chart', 'query2.finance.yahoo.com/v10/finance/quoteSummary');
        }
        if (chartBase.includes('/v8/finance/chart')) {
            return chartBase.replace('/v8/finance/chart', '/v10/finance/quoteSummary');
        }
        return defaultBase;
    }

    /**
     * Build URL with optional CORS proxy
     */
    buildUrl(symbol) {
        let url = `${this.baseUrl}/${encodeURIComponent(symbol)}`;

        // Add CORS proxy if configured
        if (this.corsProxy) {
            url = `${this.corsProxy}${url}`;
        }

        return url;
    }

    buildQuoteSummaryUrl(symbol, modules = 'recommendationTrend') {
        const params = new URLSearchParams({
            modules,
            region: 'US',
            lang: 'en-US'
        });
        let url = `${this.quoteSummaryBase}/${encodeURIComponent(symbol)}?${params.toString()}`;
        if (this.corsProxy) {
            url = `${this.corsProxy}${url}`;
        }
        return url;
    }

    /**
     * Fetch quote data for a stock/ETF
     */
    async getQuote(symbol) {
        await this.rateLimiter?.wait();

        const url = this.buildUrl(symbol);

        try {
            const response = await fetch(url, { headers: this.defaultHeaders });

            if (!response.ok) {
                // Handle specific error codes
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please wait before retrying.');
                }
                if (response.status === 404) {
                    throw new Error(`Symbol not found: ${symbol}`);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return this.parseResponse(data, symbol);

        } catch (error) {
            // Handle CORS errors specifically
            if (error.message.includes('CORS') ||
                error.message.includes('Failed to fetch') ||
                error.name === 'TypeError') {
                console.warn(`Yahoo Finance CORS error for ${symbol}. Consider configuring a CORS proxy.`);
                throw new Error(`CORS error: Yahoo Finance may be blocked. Configure a CORS proxy or use another provider.`);
            }
            throw new Error(`Yahoo Finance error for ${symbol}: ${error.message}`);
        }
    }

    async getRecommendation(symbol) {
        const cached = this.recommendationCache.get(symbol);
        if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
            return cached.data;
        }

        await this.rateLimiter?.wait();

        const url = this.buildQuoteSummaryUrl(symbol, 'recommendationTrend,financialData');

        try {
            const response = await fetch(url, { headers: this.defaultHeaders });
            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please wait before retrying.');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const payload = await response.json();
            const summary = payload?.quoteSummary?.result?.[0];
            const trend = summary?.recommendationTrend?.trend;
            let recommendation = null;

            if (Array.isArray(trend) && trend.length > 0) {
                const latest = trend.find(entry => this.getTrendTotal(entry) > 0) || trend[0];
                recommendation = this.buildRecommendationFromTrend(latest);
            }

            if (!recommendation && summary?.financialData) {
                recommendation = this.buildRecommendationFromFinancialData(summary.financialData);
            }

            if (!recommendation) {
                return null;
            }

            if (recommendation) {
                this.recommendationCache.set(symbol, { timestamp: Date.now(), data: recommendation });
            }
            return recommendation;
        } catch (error) {
            if (error.message.includes('CORS') || error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                console.warn(`Yahoo Finance recommendation CORS error for ${symbol}. Configure a proxy if needed.`);
                throw new Error(`CORS error: Yahoo Finance recommendation may be blocked. Configure a proxy or use another provider.`);
            }
            throw new Error(`Yahoo Finance recommendation error for ${symbol}: ${error.message}`);
        }
    }

    getTrendTotal(entry = {}) {
        return ['strongBuy', 'buy', 'hold', 'sell', 'strongSell']
            .map(key => parseInt(entry[key], 10) || 0)
            .reduce((sum, val) => sum + val, 0);
    }

    buildRecommendationFromTrend(entry) {
        if (!entry) return null;

        const counts = {
            strongBuy: parseInt(entry.strongBuy, 10) || 0,
            buy: parseInt(entry.buy, 10) || 0,
            hold: parseInt(entry.hold, 10) || 0,
            sell: parseInt(entry.sell, 10) || 0,
            strongSell: parseInt(entry.strongSell, 10) || 0
        };

        const totalAnalysts = Object.values(counts).reduce((sum, val) => sum + val, 0);
        if (totalAnalysts === 0) {
            return null;
        }

        const labels = {
            strongBuy: 'Strong Buy',
            buy: 'Buy',
            hold: 'Hold',
            sell: 'Sell',
            strongSell: 'Strong Sell'
        };

        const bestKey = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([key]) => key)[0];

        return {
            label: labels[bestKey] || 'N/A',
            totalAnalysts,
            period: entry.period || 'latest',
            counts
        };
    }

    buildRecommendationFromFinancialData(financialData = {}) {
        if (!financialData) return null;

        const key = financialData.recommendationKey || '';
        if (!key) return null;

        const labelMap = {
            strong_buy: 'Strong Buy',
            buy: 'Buy',
            hold: 'Hold',
            sell: 'Sell',
            strong_sell: 'Strong Sell'
        };

        const normalizedKey = key.toLowerCase();
        const label = labelMap[normalizedKey];
        if (!label) return null;

        const totalAnalysts = parseInt(financialData.numberOfAnalystOpinions, 10) || 0;
        const counts = {
            strongBuy: 0,
            buy: 0,
            hold: 0,
            sell: 0,
            strongSell: 0
        };

        const countKeyMap = {
            'Strong Buy': 'strongBuy',
            'Buy': 'buy',
            'Hold': 'hold',
            'Sell': 'sell',
            'Strong Sell': 'strongSell'
        };
        const bucketKey = countKeyMap[label] || 'hold';
        counts[bucketKey] = totalAnalysts || 1;

        return {
            label,
            totalAnalysts,
            period: 'latest',
            counts
        };
    }

    /**
     * Parse Yahoo Finance response to standard format
     */
    parseResponse(data, symbol) {
        try {
            const result = data.chart?.result?.[0];
            if (!result) {
                throw new Error('Invalid response structure');
            }

            const meta = result.meta;
            const quote = result.indicators?.quote?.[0];

            if (!meta || typeof meta.regularMarketPrice === 'undefined') {
                throw new Error('No price data in response');
            }

            return {
                symbol: meta.symbol || symbol,
                price: parseFloat(meta.regularMarketPrice) || 0,
                change: parseFloat(meta.regularMarketChange) || 0,
                changesPercentage: parseFloat(meta.regularMarketChangePercent) || 0,
                dayLow: quote?.low?.[0] || parseFloat(meta.regularMarketDayLow) || 0,
                dayHigh: quote?.high?.[0] || parseFloat(meta.regularMarketDayHigh) || 0,
                yearHigh: 0, // Not available in chart endpoint
                yearLow: 0,  // Not available in chart endpoint
                marketCap: 0, // Requires separate endpoint
                priceAvg50: 0, // Not available
                priceAvg200: 0, // Not available
                volume: parseInt(quote?.volume?.[0]) || parseInt(meta.regularMarketVolume) || 0,
                avgVolume: 0, // Not available
                timestamp: parseInt(meta.regularMarketTime) * 1000 || Date.now(),
                name: meta.longName || meta.shortName || symbol,
                exchange: meta.exchangeName || 'Yahoo Finance',
                currency: meta.currency || 'USD',
                dataSource: 'yahoo-finance'
            };
        } catch (error) {
            throw new Error(`Failed to parse Yahoo Finance response: ${error.message}`);
        }
    }

    /**
     * Get multiple quotes in batch (Yahoo supports comma-separated symbols)
     */
    async getMultipleQuotes(symbols) {
        const results = [];
        // Yahoo Finance supports batch requests, but we'll do individual for consistency
        // and to handle errors per symbol
        for (const symbol of symbols) {
            try {
                const quote = await this.getQuote(symbol);
                results.push({ success: true, data: quote });
            } catch (error) {
                results.push({ success: false, error: error.message, symbol });
            }
        }
        return results;
    }
}

/**
 * CoinGecko API Client
 * Handles cryptocurrency data
 */
export class CoinGeckoClient {
    constructor(baseUrl, apiKey = null) {
        this.baseUrl = baseUrl || 'https://api.coingecko.com/api/v3';
        this.apiKey = apiKey;
        this.rateLimiter = null;
        this.cryptoIds = new Map(); // Cache for symbol -> id mapping
    }

    setRateLimiter(rateLimiter) {
        this.rateLimiter = rateLimiter;
    }

    /**
     * Get cryptocurrency ID from symbol
     */
    async getCryptoId(symbol) {
        if (this.cryptoIds.has(symbol.toLowerCase())) {
            return this.cryptoIds.get(symbol.toLowerCase());
        }

        await this.rateLimiter?.wait();

        const url = `${this.baseUrl}/search?query=${symbol}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const coin = data.coins.find(c =>
                c.symbol.toLowerCase() === symbol.toLowerCase() &&
                c.market_cap_rank &&
                c.market_cap_rank <= 100
            );

            if (coin) {
                this.cryptoIds.set(symbol.toLowerCase(), coin.id);
                return coin.id;
            } else {
                throw new Error(`Cryptocurrency not found: ${symbol}`);
            }
        } catch (error) {
            throw new Error(`CoinGecko Search Error for ${symbol}: ${error.message}`);
        }
    }

    /**
     * Get cryptocurrency price data
     */
    async getCryptoData(symbol) {
        const id = await this.getCryptoId(symbol);

        await this.rateLimiter?.wait();

        const url = `${this.baseUrl}/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            const currentPrice = data.market_data?.current_price?.usd || 0;
            const priceChange24h = data.market_data?.price_change_24h || 0;
            const priceChangePercentage24h = data.market_data?.price_change_percentage_24h || 0;
            const marketCap = data.market_data?.market_cap?.usd || 0;
            const volume24h = data.market_data?.total_volume?.usd || 0;
            const ath = data.market_data?.ath?.usd || 0;
            const atl = data.market_data?.atl?.usd || 0;

            return {
                symbol: data.symbol?.toUpperCase() || symbol,
                price: currentPrice,
                change: priceChange24h,
                changesPercentage: priceChangePercentage24h,
                marketCap: marketCap,
                volume24h: volume24h,
                ath: ath,
                atl: atl,
                dayHigh: data.market_data?.high_24h?.usd || 0,
                dayLow: data.market_data?.low_24h?.usd || 0,
                circulatingSupply: data.market_data?.circulating_supply || 0,
                totalSupply: data.market_data?.total_supply || 0,
                name: data.name || symbol,
                image: data.image?.small || '',
                lastUpdated: data.last_updated || new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`CoinGecko API Error for ${symbol}: ${error.message}`);
        }
    }

    /**
     * Get price data for multiple cryptocurrencies
     */
    async getMultipleCryptoData(symbols) {
        try {
            // Get IDs for all symbols
            const ids = await Promise.all(symbols.map(symbol => this.getCryptoId(symbol)));

            await this.rateLimiter?.wait();

            // Fetch all data at once
            const url = `${this.baseUrl}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&order=market_cap_desc&per_page=${symbols.length}&page=1&sparkline=false&price_change_percentage=24h`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            return symbols.map(symbol => {
                const id = this.cryptoIds.get(symbol.toLowerCase());
                const coinData = data.find(coin => coin.id === id);

                if (coinData) {
                    return {
                        success: true,
                        data: {
                            symbol: coinData.symbol?.toUpperCase() || symbol,
                            price: coinData.current_price || 0,
                            change: coinData.price_change_24h || 0,
                            changesPercentage: coinData.price_change_percentage_24h || 0,
                            marketCap: coinData.market_cap || 0,
                            volume24h: coinData.total_volume || 0,
                            dayHigh: coinData.high_24h || 0,
                            dayLow: coinData.low_24h || 0,
                            name: coinData.name || symbol,
                            image: coinData.image || '',
                            lastUpdated: new Date().toISOString()
                        }
                    };
                } else {
                    return { success: false, error: 'Data not found', symbol };
                }
            });
        } catch (error) {
            return symbols.map(symbol => ({ success: false, error: error.message, symbol }));
        }
    }

    /**
     * Get simple price data (faster, less detailed)
     */
    async getSimpleCryptoData(symbol) {
        const id = await this.getCryptoId(symbol);

        await this.rateLimiter?.wait();

        const url = `${this.baseUrl}/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const coinData = data[id];

            if (!coinData) {
                throw new Error(`No data found for ${symbol}`);
            }

            return {
                symbol: symbol.toUpperCase(),
                price: coinData.usd || 0,
                change: (coinData.usd_24h_change || 0) / 100 * (coinData.usd || 0),
                changesPercentage: coinData.usd_24h_change || 0,
                marketCap: coinData.usd_market_cap || 0,
                volume24h: coinData.usd_24h_vol || 0,
                name: symbol,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`CoinGecko Simple API Error for ${symbol}: ${error.message}`);
        }
    }
}

/**
 * Rate Limiter Class
 * Manages API rate limiting for different services
 */
export class RateLimiter {
    constructor(maxRequests, delay, { now, sleep } = {}) {
        this.maxRequests = maxRequests;
        this.delay = delay;
        this.requests = [];
        this.now = now || (() => Date.now());
        this.sleep = sleep || ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
    }

    async wait() {
        const now = this.now();

        // Remove old requests
        this.requests = this.requests.filter(time => now - time < 60000);

        // If we're at the limit, wait
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = oldestRequest + 60000 - now;
            if (waitTime > 0) {
                await this.sleep(waitTime);
            }
        }

        // Add this request
        this.requests.push(this.now());

        // Wait between requests
        if (this.delay > 0) {
            await this.sleep(this.delay);
        }
    }
}

/**
 * Enhanced Cache Manager
 * Supports different TTL for different data types
 */
export class EnhancedCache {
    constructor() {
        this.cache = new Map();
    }

    get(key) {
        const item = this.cache.get(key);
        if (item && Date.now() < item.expiry) {
            return item.data;
        }
        if (item) {
            this.cache.delete(key);
        }
        return null;
    }

    set(key, data, ttl = 300000) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttl
        });
    }

    clear() {
        this.cache.clear();
    }

    getStats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;

        for (const item of this.cache.values()) {
            if (now < item.expiry) {
                valid++;
            } else {
                expired++;
            }
        }

        return { valid, expired, total: this.cache.size };
    }
}
