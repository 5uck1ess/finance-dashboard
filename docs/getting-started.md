# Getting Started

This guide will help you set up and run the Finance Dashboard on your local machine.

## Prerequisites

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- Node.js 18+ (for the Express backend + static server)
- API keys from one or more data providers (see [API Configuration](./api-configuration.md))

## System Requirements

- **Browser**: Modern browser with JavaScript enabled
- **Network**: Internet connection for API calls
- **Storage**: Minimal (uses browser localStorage for data persistence)

## Browser Compatibility

The dashboard works with all modern browsers that support:

- ES6+ JavaScript features
- Fetch API
- localStorage
- CSS Grid and Flexbox

## Quick Start

### 1. Get API Keys

You'll need at least one API key to get started. See [API Configuration](./api-configuration.md) for detailed instructions.

**Minimum Required**:

- **Finnhub** (for stocks/ETFs): [Get API Key](https://finnhub.io/) - 60 req/min free tier

**Recommended**:

- **CoinGecko** (for crypto): [Get API Key](https://www.coingecko.com/) - 30 req/min free tier (demo API works without key)

**Optional Fallbacks**:

- **Financial Modeling Prep**: [Get API Key](https://financialmodelingprep.com/) - 250 req/min free tier
- **Alpha Vantage**: [Get API Key](https://www.alphavantage.co/) - 5 req/min free tier
- **Yahoo Finance**: No API key required - Automatic fallback (20 req/min recommended)

### 2. Configure the Dashboard

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the baked frontend assets:
   ```bash
   npm run build
   ```
3. Copy the environment template and add your API keys (keep the real file out of git):
   ```bash
   cp .env.example .env
   # edit .env with FINNHUB_API_KEY=..., etc.
   ```
4. (Optional) Configure default symbols/crypto:
   ```bash
   cp config/stocks.example.json config/stocks.json
   # add default stocks/cryptos (keys belong in this file only for legacy mode)
   ```

### 3. Run the Application

```bash
npm start
# Visit http://localhost:1234
```

> Need the legacy all-frontend mode? Serve the folder with any static server (Python/Node/PHP) **and** keep API keys in `config/stocks.json`. This mode is best for offline demos because keys live in the browser bundle and feature parity is secondary to server mode.

## First-Run Workflow

1. **Load the dashboard** – it will show your saved symbols but no data yet (we avoid auto-calling APIs until you decide).
2. **Click the manual Refresh button once** to fetch the initial snapshot (prices, recommendations, crypto, portfolio metrics).
3. **Pick an auto-refresh option** if you want ongoing updates (fixed interval or Recommended). Leaving it on Manual means you'll trigger additional full refreshes yourself whenever you need fresh data.

## File Structure Overview

```
financeDashboard/
├── index.html              # Main dashboard page
├── manage.html             # Investment management page
├── config/
│   ├── stocks.json         # Main configuration (add your API keys here)
│   └── stocks.example.json # Example configuration template
├── css/
│   └── tailwind.generated.css # Baked utility CSS
├── js/
│   ├── app.js              # Main application logic
│   ├── api-clients.js      # API client classes
│   ├── manage.js           # Management page logic
│   └── services/           # Shared config/cache/category helpers
├── scripts/
│   └── build-assets.js     # Generates baked frontend CSS
├── server/
│   ├── index.js            # Express entry point (serves API + static files)
│   ├── config.js           # Loads base config and env defaults
│   ├── services/
│   │   └── data-service.js # Server-side data orchestration
│   └── .env.example        # Template for API keys
└── README.md               # Project overview
```

## Next Steps

- Learn about [API Configuration](./api-configuration.md) for detailed API setup
- Explore [Features](./features.md) to understand all capabilities
- Customize your [Configuration](./configuration.md) settings
- Check [Troubleshooting](./troubleshooting.md) if you encounter issues

---

[← Back to Documentation Index](./README.md) | [Main README →](../README.md)
