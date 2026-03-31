const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const PRIMARY_CONFIG = path.join(CONFIG_DIR, 'stocks.json');
const EXAMPLE_CONFIG = path.join(CONFIG_DIR, 'stocks.example.json');

function readConfigFile() {
  const source = fs.existsSync(PRIMARY_CONFIG) ? PRIMARY_CONFIG : EXAMPLE_CONFIG;
  try {
    const raw = fs.readFileSync(source, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Unable to read config (${source}):`, error.message);
    return {
      stocks: [],
      cryptos: [],
      etfs: [],
      api: {},
      settings: {},
    };
  }
}

function loadBaseConfig() {
  const config = readConfigFile();
  return {
    stocks: config.stocks || [],
    cryptos: config.cryptos || [],
    etfs: config.etfs || [],
    api: config.api || {},
    settings: config.settings || {},
  };
}

function buildRuntimeConfig(baseConfig = {}) {
  const env = process.env;
  const defaultApi = baseConfig.api || {};

  return {
    server: {
      port: parseInt(env.PORT, 10) || 1234,
      corsOrigin: env.CORS_ORIGIN || '',
    },
    providers: {
      finnhub: {
        apiKey: env.FINNHUB_API_KEY || '',
        baseUrl: env.FINNHUB_BASE_URL || defaultApi.finnhub?.baseUrl || 'https://finnhub.io/api/v1',
      },
      financialModelingPrep: {
        apiKey: env.FINANCIAL_MODELING_PREP_API_KEY || env.FMP_API_KEY || '',
        baseUrl:
          env.FINANCIAL_MODELING_PREP_BASE_URL ||
          defaultApi.financialModelingPrep?.baseUrl ||
          'https://financialmodelingprep.com/api/v3',
      },
      alphaVantage: {
        apiKey: env.ALPHA_VANTAGE_API_KEY || '',
        baseUrl: env.ALPHA_VANTAGE_BASE_URL || defaultApi.alphaVantage?.baseUrl || 'https://www.alphavantage.co',
      },
      coingecko: {
        apiKey: env.COINGECKO_API_KEY || '',
        baseUrl: env.COINGECKO_BASE_URL || defaultApi.coingecko?.baseUrl || 'https://api.coingecko.com/api/v3',
      },
      yahooFinance: {
        enabled: env.YAHOO_FINANCE_ENABLED !== 'false',
        baseUrl:
          env.YAHOO_FINANCE_BASE_URL ||
          defaultApi.yahooFinance?.baseUrl ||
          'https://query1.finance.yahoo.com/v8/finance/chart',
      },
    },
  };
}

function sanitizeConfig(config = {}) {
  const api = {};
  Object.entries(config.api || {}).forEach(([provider, providerConfig]) => {
    api[provider] = { ...providerConfig };
    delete api[provider].apiKey;
  });

  return {
    ...config,
    api,
  };
}

function validateEnv() {
  const warnings = [];
  const env = process.env;

  if (!env.FINNHUB_API_KEY || env.FINNHUB_API_KEY === 'YOUR_FINNHUB_API_KEY') {
    warnings.push('FINNHUB_API_KEY is not set. Stock/ETF data will rely on fallback providers.');
  }

  const hasAnyProvider =
    env.FINNHUB_API_KEY ||
    env.FINANCIAL_MODELING_PREP_API_KEY ||
    env.ALPHA_VANTAGE_API_KEY ||
    env.YAHOO_FINANCE_ENABLED !== 'false';

  if (!hasAnyProvider) {
    warnings.push('No data providers configured. The dashboard will not be able to fetch market data.');
  }

  if (!env.ADMIN_TOKEN) {
    warnings.push('ADMIN_TOKEN is not set. The /api/cache/clear endpoint is unprotected.');
  }

  return warnings;
}

module.exports = {
  loadBaseConfig,
  buildRuntimeConfig,
  sanitizeConfig,
  validateEnv,
};
