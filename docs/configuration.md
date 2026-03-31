# Configuration

Complete guide to configuring and customizing the Finance Dashboard.

## Configuration Sources

The dashboard supports two modes:

1. **Server-backed mode (recommended)**
   - API keys live in `.env` (never shipped to the browser)
   - `config/stocks.json` provides defaults, rate limits, and snapshot settings
   - Frontend loads `/api/config` for sanitized settings

2. **Static mode (legacy/offline)**
   - API keys live in `config/stocks.json`
   - Serve the project with any static server (no Express backend)
   - Best suited for offline demos and local-only use

## Configuration File

All default symbols and provider settings are stored in `config/stocks.json`. Start by copying the example:

```bash
cp config/stocks.example.json config/stocks.json
```

### Server Environment Variables

Copy `.env.example` to `.env` and populate API keys:

```bash
cp .env.example .env
```

Common keys:

- `PORT`
- `FINNHUB_API_KEY`
- `FINANCIAL_MODELING_PREP_API_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `COINGECKO_API_KEY`
- `YAHOO_FINANCE_ENABLED`
- `CORS_ORIGIN`
- `ADMIN_TOKEN`

## Configuration Schema

### Basic Structure

```json
{
  "stocks": ["GOOGL", "NVDA", "AAPL"],
  "cryptos": ["BTC", "ETH"],
  "etfs": ["SPY", "QQQ"],
  "api": { ... },
  "settings": { ... }
}
```

## API Configuration

See [API Configuration](./api-configuration.md) for detailed API setup instructions.

### Minimal Configuration

```json
{
  "api": {
    "finnhub": {
      "baseUrl": "https://finnhub.io/api/v1"
    },
    "coingecko": {
      "baseUrl": "https://api.coingecko.com/api/v3"
    }
  }
}
```

### Complete Configuration

```json
{
  "stocks": ["GOOGL", "NVDA", "AAPL"],
  "cryptos": ["BTC", "ETH", "ADA"],
  "etfs": ["SPY", "QQQ", "VTI"],
  "api": {
    "finnhub": {
      "baseUrl": "https://finnhub.io/api/v1"
    },
    "financialModelingPrep": {
      "baseUrl": "https://financialmodelingprep.com/api/v3"
    },
    "alphaVantage": {
      "baseUrl": "https://www.alphavantage.co"
    },
    "coingecko": {
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
      "coingecko": { "requestsPerMinute": 30, "delayBetweenRequests": 2000 },
      "yahooFinance": { "requestsPerMinute": 20, "delayBetweenRequests": 3000 }
    },
    "cacheExpiry": {
      "stocks": 300000,
      "crypto": 60000
    },
    "autoRefreshSeconds": 300,
    "snapshot": {
      "file": "config/dashboard-snapshot.json"
    }
  }
}
```

## Settings Configuration

### Rate Limiting

Customize rate limiting behavior for each API provider:

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

**Parameters**:

- `requestsPerMinute`: Maximum requests per minute (match provider limits)
- `delayBetweenRequests`: Milliseconds to wait between requests

### Cache Expiry

Configure how long data is cached:

```json
{
  "settings": {
    "cacheExpiry": {
      "stocks": 300000,
      "crypto": 60000
    }
  }
}
```

### Recommended Auto-Refresh

Set the default seconds used by the "Recommended" option:

```json
{
  "settings": {
    "autoRefreshSeconds": 300
  }
}
```

### Snapshot Storage (Server Mode)

When the backend is running, it stores the latest snapshot in a JSON file and serves it via `/api/snapshot`:

```json
{
  "settings": {
    "snapshot": {
      "file": "config/dashboard-snapshot.json"
    }
  }
}
```

## Default Symbols

You can pre-configure default stocks, ETFs, and cryptos:

```json
{
  "stocks": ["GOOGL", "NVDA", "AAPL"],
  "etfs": ["SPY", "QQQ"],
  "cryptos": ["BTC", "ETH"]
}
```

These defaults are loaded on first run if no localStorage data exists.

## User Preferences (localStorage)

The dashboard stores user preferences in browser localStorage:

- `stocks`: Array of tracked symbols
- `portfolio`: Portfolio data object
- `theme`: Theme preference (`light`/`dark`)
- `autoRefreshSeconds`: Auto-refresh selection (resets to Manual on load)
- `minimizedSections`: Reserved for section UI state
- `lastUpdated`: Last refresh timestamp
- `cachedDashboardData`: Cached API snapshot used for fast reloads
- `finance_dashboard_config`: Optional config overrides (advanced)

## Environment Variables

For server-backed deployments, set API keys and overrides via environment variables:

```bash
export FINNHUB_API_KEY="your_key_here"
export COINGECKO_API_KEY="your_key_here"
```

See `.env.example` for the full list of supported keys.

## Frontend Asset Build

The dashboard ships baked frontend assets rather than compiling utilities in the browser:

```bash
npm run build
```

Run that command after changing HTML utility classes, icon usage, or the local Tailwind config.

## Configuration Validation

The dashboard validates configuration on load:

1. **API Keys**: Checks for at least one configured provider
2. **JSON Syntax**: Validates JSON structure
3. **Required Fields**: Ensures `baseUrl` is present for each provider
4. **Fallback**: Uses default values if settings are missing

## Configuration Best Practices

1. **Use server env vars** for API keys in production
2. **Keep defaults in `config/stocks.json`** (symbols, base URLs, rate limits)
3. **Add fallbacks** for redundancy
4. **Monitor quotas** in provider dashboards
5. **Export data** regularly from the Manage page

---

[← Back to Documentation Index](./README.md) | [Main README →](../README.md)
