export function normalizeEquityQuote(data = {}, config = {}, getCategory) {
    const resolveCategory = typeof getCategory === 'function' ? getCategory : () => 'stock';

    return {
        symbol: data.symbol,
        price: data.price,
        changePercent: data.changePercent ?? data.changesPercentage ?? 0,
        name: data.name,
        exchange: data.exchange,
        marketCap: data.marketCap,
        dayHigh: data.dayHigh,
        dayLow: data.dayLow,
        volume: data.volume,
        provider: data.provider,
        recommendation: data.recommendation ?? null,
        recommendationDetails: data.recommendationDetails || null,
        category: data.category || resolveCategory(data.symbol, config),
        lastUpdated: data.lastUpdated || new Date().toISOString()
    };
}

export function normalizeCryptoQuote(data = {}) {
    return {
        ...data,
        provider: data.provider || 'coingecko',
        changePercent: data.changePercent ?? data.changesPercentage ?? 0,
        category: 'crypto',
        lastUpdated: data.lastUpdated || new Date().toISOString()
    };
}

