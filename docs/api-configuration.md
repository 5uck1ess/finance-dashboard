# API Configuration

Complete guide to configuring API providers for the Finance Dashboard.

## Overview

The Finance Dashboard supports multiple API providers with an automatic fallback chain:

- **Primary**: Finnhub (stocks/ETFs)
- **Crypto**: CoinGecko
- **Optional Fallbacks**: Financial Modeling Prep, Alpha Vantage, Yahoo Finance

## Where to Put API Keys

### Server-Backed Mode (Recommended)

- Store keys in `.env`
- The backend uses them to fetch data and returns sanitized config to the browser
- Keys never reach client-side JavaScript

### Static Mode (Legacy)

- Store keys in `config/stocks.json`
- Serve the project as a static site

## API Providers

### Finnhub (Stocks & ETFs — Recommended)

**Purpose**: Primary stock and ETF data source

**Environment Variable**: `FINNHUB_API_KEY`

**Rate Limits** (Free Tier):
- **60 requests per minute**
- **30,000 requests per month**

**Endpoints Used**:
- `/quote` - Real-time quotes
- `/stock/profile2` - Company metadata
- `/stock/recommendation` - Analyst consensus data

**Configuration (static mode)**:
```json
{
  "api": {
    "finnhub": {
      "apiKey": "YOUR_FINNHUB_API_KEY",
      "baseUrl": "https://finnhub.io/api/v1"
    }
  }
}
```

### Financial Modeling Prep (Optional Secondary Source)

**Purpose**: Optional secondary stock feed

**Environment Variable**: `FINANCIAL_MODELING_PREP_API_KEY`

**Rate Limits** (Free Tier):
- **250 requests per minute**
- **250 requests per day**

**Endpoints Used**:
- `/quote/{symbol}` - Real-time quotes
- `/search` - Symbol search

**Configuration (static mode)**:
```json
{
  "api": {
    "financialModelingPrep": {
      "apiKey": "YOUR_FMP_API_KEY",
      "baseUrl": "https://financialmodelingprep.com/api/v3"
    }
  }
}
```

### Alpha Vantage (Optional Fallback)

**Purpose**: Backup stock data when other providers fail

**Environment Variable**: `ALPHA_VANTAGE_API_KEY`

**Rate Limits** (Free Tier):
- **5 requests per minute**
- **500 requests per day**

**Endpoints Used**:
- `GLOBAL_QUOTE` - Last price, intraday high/low, change percent

**Configuration (static mode)**:
```json
{
  "api": {
    "alphaVantage": {
      "apiKey": "YOUR_ALPHA_VANTAGE_API_KEY",
      "baseUrl": "https://www.alphavantage.co"
    }
  }
}
```

### Yahoo Finance (Optional Fallback - No API Key Required)

**Purpose**: Last-resort fallback provider when all other providers fail

**Environment Variable**: `YAHOO_FINANCE_ENABLED` (default: true)

**Rate Limits**:
- **Unofficial endpoint** - No official rate limits
- **Recommended**: 20 requests per minute

**Endpoints Used**:
- `/v8/finance/chart/{symbol}` - Real-time quotes and price data

**Notes**:
- In server-backed mode, Yahoo is accessed server-side (no CORS issues)
- In static mode, you may need a CORS proxy

**Configuration (static mode)**:
```json
{
  "api": {
    "yahooFinance": {
      "enabled": true,
      "baseUrl": "https://query1.finance.yahoo.com/v8/finance/chart",
      "corsProxy": null
    }
  }
}
```

### CoinGecko (Cryptocurrency)

**Purpose**: Cryptocurrency data

**Environment Variable**: `COINGECKO_API_KEY` (optional for demo API)

**Rate Limits** (Free Tier):
- **30 requests per minute**
- **10,000 requests per month**

**Endpoints Used**:
- `/coins/markets` - Batch crypto data
- `/coins/{id}` - Detailed crypto data
- `/search` - Crypto search

**Configuration (static mode)**:
```json
{
  "api": {
    "coingecko": {
      "apiKey": "OPTIONAL_COINGECKO_KEY",
      "baseUrl": "https://api.coingecko.com/api/v3"
    }
  }
}
```

## Rate Limit Configuration

Customize rate limiting behavior in `config/stocks.json`:

```json
{
  "settings": {
    "rateLimiting": {
      "finnhub": { "requestsPerMinute": 60, "delayBetweenRequests": 1000 },
      "fmp": { "requestsPerMinute": 250, "delayBetweenRequests": 250 },
      "alphaVantage": { "requestsPerMinute": 5, "delayBetweenRequests": 12000 },
      "coingecko": { "requestsPerMinute": 30, "delayBetweenRequests": 2000 },
      "yahooFinance": { "requestsPerMinute": 20, "delayBetweenRequests": 3000 }
    }
  }
}
```

## API Key Security Best Practices

1. **Never commit API keys**
2. **Use `.env` for keys** in production
3. **Keep example config** free of secrets
4. **Rotate keys** if exposed
5. **Monitor usage** in provider dashboards

## Fallback Provider Strategy

The dashboard automatically tries providers in this order:

1. **Finnhub** (if configured)
2. **Financial Modeling Prep** (if configured)
3. **Alpha Vantage** (if configured)
4. **Yahoo Finance** (enabled by default)

## CORS Considerations

- **Server-backed mode** avoids browser CORS issues because API calls are made server-side
- **Static mode** relies on browser CORS support; Yahoo may require a proxy

## Complete Configuration Example

```json
{
  "stocks": ["GOOGL", "NVDA", "AAPL"],
  "cryptos": ["BTC", "ETH", "ADA"],
  "etfs": ["SPY", "QQQ"],
  "api": {
    "finnhub": {
      "apiKey": "YOUR_FINNHUB_API_KEY",
      "baseUrl": "https://finnhub.io/api/v1"
    },
    "financialModelingPrep": {
      "apiKey": "OPTIONAL_FMP_KEY",
      "baseUrl": "https://financialmodelingprep.com/api/v3"
    },
    "alphaVantage": {
      "apiKey": "OPTIONAL_ALPHA_VANTAGE_KEY",
      "baseUrl": "https://www.alphavantage.co"
    },
    "coingecko": {
      "apiKey": "OPTIONAL_COINGECKO_KEY",
      "baseUrl": "https://api.coingecko.com/api/v3"
    },
    "yahooFinance": {
      "enabled": true,
      "baseUrl": "https://query1.finance.yahoo.com/v8/finance/chart",
      "corsProxy": null
    }
  },
  "settings": {
    "rateLimiting": {
      "finnhub": { "requestsPerMinute": 60, "delayBetweenRequests": 1000 },
      "fmp": { "requestsPerMinute": 250, "delayBetweenRequests": 250 },
      "alphaVantage": { "requestsPerMinute": 5, "delayBetweenRequests": 12000 },
      "yahooFinance": { "requestsPerMinute": 20, "delayBetweenRequests": 3000 },
      "coingecko": { "requestsPerMinute": 30, "delayBetweenRequests": 2000 }
    },
    "cacheExpiry": {
      "stocks": 300000,
      "crypto": 60000
    }
  }
}
```

---

[← Back to Documentation Index](./README.md) | [Main README →](../README.md)
