const DEFAULT_CRYPTO_SYMBOLS = ['BTC', 'ETH', 'ADA', 'SOL', 'DOT', 'LINK', 'LTC', 'XRP', 'BCH', 'BNB', 'DOGE', 'MATIC', 'AVAX', 'UNI', 'SUSHI', 'CAKE', 'PEPE'];
const DEFAULT_ETF_SYMBOLS = ['SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'VEA', 'VWO', 'AGG', 'BND', 'GLD', 'SLV', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLP', 'XLY', 'XLU'];

function normalizeSymbolList(symbols = []) {
    return Array.isArray(symbols)
        ? symbols.map((symbol) => String(symbol).toUpperCase()).filter(Boolean)
        : [];
}

export function isCryptoSymbol(symbol, config = {}) {
    const symbolUpper = String(symbol || '').toUpperCase();
    if (!symbolUpper) return false;
    if (DEFAULT_CRYPTO_SYMBOLS.includes(symbolUpper)) return true;
    return normalizeSymbolList(config.cryptos).includes(symbolUpper);
}

export function isETFSymbol(symbol, config = {}) {
    const symbolUpper = String(symbol || '').toUpperCase();
    if (!symbolUpper) return false;
    if (DEFAULT_ETF_SYMBOLS.includes(symbolUpper)) return true;
    return normalizeSymbolList(config.etfs).includes(symbolUpper);
}

export function getInstrumentCategory(symbol, config = {}) {
    if (isCryptoSymbol(symbol, config)) return 'crypto';
    if (isETFSymbol(symbol, config)) return 'etf';
    return 'stock';
}

export function groupSymbolsByCategory(symbols = [], config = {}) {
    return symbols.reduce((buckets, symbol) => {
        const category = getInstrumentCategory(symbol, config);
        if (category === 'crypto') buckets.crypto.push(symbol);
        else if (category === 'etf') buckets.etf.push(symbol);
        else buckets.stocks.push(symbol);
        return buckets;
    }, { stocks: [], crypto: [], etf: [] });
}

export function getConfiguredSymbols(config = {}) {
    return Array.from(new Set([
        ...normalizeSymbolList(config.stocks),
        ...normalizeSymbolList(config.cryptos),
        ...normalizeSymbolList(config.etfs)
    ]));
}

