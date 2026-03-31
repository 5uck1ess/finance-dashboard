function mergeEntryWithCached(incomingEntry = {}, cachedEntry = {}) {
    const merged = { ...cachedEntry, ...incomingEntry };
    const normalizedRecommendation = typeof incomingEntry.recommendation === 'string'
        ? incomingEntry.recommendation.trim().toUpperCase()
        : incomingEntry.recommendation;
    const hasIncomingRecommendation = incomingEntry.recommendation != null
        && normalizedRecommendation !== ''
        && normalizedRecommendation !== 'N/A';

    if (!hasIncomingRecommendation && cachedEntry.recommendation != null) {
        merged.recommendation = cachedEntry.recommendation;
    }
    if (incomingEntry.recommendationDetails == null && cachedEntry.recommendationDetails != null) {
        merged.recommendationDetails = cachedEntry.recommendationDetails;
    }

    return merged;
}

function mergeCategoryEntries(incoming = [], current = []) {
    if (!incoming || incoming.length === 0) return current || [];
    const currentMap = new Map((current || []).map((item) => [item.symbol, item]));
    return incoming.map((item) => mergeEntryWithCached(item, currentMap.get(item.symbol) || {}));
}

export function deriveSources(cacheSnapshot = { stocks: [], crypto: [], etfs: [] }) {
    let stockSource = null;
    let cryptoSource = null;

    if (!stockSource && ((cacheSnapshot.stocks && cacheSnapshot.stocks.length > 0) || (cacheSnapshot.etfs && cacheSnapshot.etfs.length > 0))) {
        const first = (cacheSnapshot.stocks && cacheSnapshot.stocks[0]) || (cacheSnapshot.etfs && cacheSnapshot.etfs[0]);
        stockSource = first?.provider || first?.dataSource || 'Stocks';
    }

    if (!cryptoSource && cacheSnapshot.crypto && cacheSnapshot.crypto.length > 0) {
        const first = cacheSnapshot.crypto[0];
        cryptoSource = first?.provider || first?.dataSource || 'CoinGecko';
    }

    return { stockSource, cryptoSource };
}

export function fillMissingCategoriesFromCache(
    incomingSnapshot = { stocks: [], crypto: [], etfs: [] },
    persistedCache = { stocks: [], crypto: [], etfs: [], lastUpdated: null }
) {
    const snapshot = incomingSnapshot || { stocks: [], crypto: [], etfs: [] };
    const cached = persistedCache || { stocks: [], crypto: [], etfs: [], lastUpdated: null };

    return {
        stocks: (snapshot.stocks && snapshot.stocks.length > 0)
            ? mergeCategoryEntries(snapshot.stocks, cached.stocks)
            : (cached.stocks || []),
        crypto: (snapshot.crypto && snapshot.crypto.length > 0)
            ? mergeCategoryEntries(snapshot.crypto, cached.crypto)
            : (cached.crypto || []),
        etfs: (snapshot.etfs && snapshot.etfs.length > 0)
            ? mergeCategoryEntries(snapshot.etfs, cached.etfs)
            : (cached.etfs || []),
        lastUpdated: snapshot.lastUpdated || cached.lastUpdated || null
    };
}

export function renderTrackedSnapshotData({
    trackedSymbols = [],
    cacheSnapshot = { stocks: [], crypto: [], etfs: [], lastUpdated: null },
    getPortfolioMetrics,
    renderStockCard,
    ui
}) {
    const tracked = new Set(trackedSymbols || []);
    const renderedCounts = { stocks: 0, crypto: 0, etf: 0 };
    const renderEntry = (entry) => {
        if (!entry?.symbol || (tracked.size > 0 && !tracked.has(entry.symbol))) return;
        const portfolio = getPortfolioMetrics(entry.symbol, entry.price);
        renderStockCard(entry, portfolio);
        if (entry.category === 'crypto') renderedCounts.crypto += 1;
        else if (entry.category === 'etf') renderedCounts.etf += 1;
        else renderedCounts.stocks += 1;
    };

    ui?.clearContainers?.();
    (cacheSnapshot.stocks || []).forEach(renderEntry);
    (cacheSnapshot.etfs || []).forEach(renderEntry);
    (cacheSnapshot.crypto || []).forEach(renderEntry);

    if (cacheSnapshot.lastUpdated) {
        ui?.updateLastUpdated?.(new Date(cacheSnapshot.lastUpdated));
    }

    return renderedCounts;
}

export function persistCacheSnapshot(storage, cacheSnapshot = { stocks: [], crypto: [], etfs: [] }, lastUpdatedOverride = null) {
    const existing = storage.getCachedData() || { stocks: [], crypto: [], etfs: [] };

    const mergeCategory = (incoming = [], current = []) => {
        if (!incoming || incoming.length === 0) return current;
        const mergedIncoming = mergeCategoryEntries(incoming, current);
        const symbols = new Set(mergedIncoming.map((item) => item.symbol));
        const untouchedCurrent = (current || []).filter((item) => !symbols.has(item.symbol));
        return [...mergedIncoming, ...untouchedCurrent];
    };

    storage.saveCachedData({
        stocks: mergeCategory(cacheSnapshot.stocks, existing.stocks),
        crypto: mergeCategory(cacheSnapshot.crypto, existing.crypto),
        etfs: mergeCategory(cacheSnapshot.etfs, existing.etfs),
        lastUpdated: lastUpdatedOverride || existing.lastUpdated || new Date().toISOString()
    });
}
