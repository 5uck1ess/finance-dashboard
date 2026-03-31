const API_ALIAS_MAP = {
    financialModelingPrep: 'fmp',
    fmp: 'fmp',
    alphaVantage: 'alphaVantage',
    finnhub: 'finnhub',
    coingecko: 'coingecko',
    yahooFinance: 'yahooFinance'
};

export function buildApiKeys(baseConfig = {}, userConfig = {}) {
    const apiKeys = {
        ...(baseConfig.apiKeys || {}),
        ...(userConfig.apiKeys || {})
    };

    const hydrateFromApiSection = (config) => {
        if (!config?.api) return;
        Object.entries(config.api).forEach(([provider, value]) => {
            const targetKey = API_ALIAS_MAP[provider] || provider;
            if (value?.apiKey && !apiKeys[targetKey]) {
                apiKeys[targetKey] = value.apiKey;
            }
        });
    };

    hydrateFromApiSection(baseConfig);
    hydrateFromApiSection(userConfig);

    return apiKeys;
}

export async function loadDashboardConfig(storage) {
    if (typeof fetch !== 'function') {
        const userConfig = storage.getConfig();
        return {
            ...userConfig,
            backendAvailable: false,
            apiKeys: buildApiKeys({}, userConfig)
        };
    }

    const userConfig = storage.getConfig();
    let baseConfig = {};
    let backendAvailable = false;

    try {
        const response = await fetch('/api/config');
        if (response && response.ok) {
            baseConfig = await response.json();
            backendAvailable = true;
        }
    } catch (error) {
        console.warn('Unable to load /api/config, falling back to static config:', error);
    }

    if (!baseConfig || Object.keys(baseConfig).length === 0) {
        try {
            const response = await fetch('/config/stocks.json');
            if (response && response.ok) {
                baseConfig = await response.json();
            }
        } catch (error) {
            console.error('Failed to load static config:', error);
        }
    }

    const config = {
        ...baseConfig,
        ...userConfig,
        backendAvailable
    };
    config.apiKeys = buildApiKeys(baseConfig, userConfig);
    return config;
}

export function getApiKeyFromConfig(config = {}, provider) {
    const targetKey = API_ALIAS_MAP[provider] || provider;

    return config.apiKeys?.[targetKey]
        || config.apiKeys?.[provider]
        || config.api?.[targetKey]?.apiKey
        || config.api?.[provider]?.apiKey
        || null;
}
