# Migration Guide

Guide for upgrading from previous versions of the Finance Dashboard.

## Migration from v5.x to v6.0

### Overview of Changes

- **Code quality tooling**: ESLint, Prettier, and pre-commit hooks via husky + lint-staged
- **API rate limiting**: Express middleware protects API endpoints (100 req/min per IP)
- **Environment validation**: Server warns on startup about missing or placeholder API keys
- **Docker improvements**: HEALTHCHECK directive, persistent volume for config data
- **CI/CD**: Lint and test jobs run before Docker image build
- **Onboarding**: Root `.env.example`, `CONTRIBUTING.md`, and `SECURITY.md` added

### Migration Steps

1. **Install new dependencies**:

   ```bash
   npm install
   ```

2. **Use root `.env.example`** (replaces `server/.env.example`):

   ```bash
   cp .env.example .env
   # Edit with your API keys
   ```

3. **Update Docker Compose** if you use a custom `docker-compose.yml`:
   - Add the `volumes` and `healthcheck` sections (see the updated file)

4. **New npm scripts available**:
   ```bash
   npm run lint          # Run ESLint
   npm run lint:fix      # Auto-fix lint issues
   npm run format        # Format with Prettier
   npm run format:check  # Check formatting
   ```

### What's Preserved

- All existing functionality, config files, and localStorage data
- Docker deployment workflow (build, save, load on NAS)
- All API provider configurations

### What's New

- Pre-commit hooks automatically lint and format staged files
- Server logs warnings for missing API keys on startup
- API endpoints are rate-limited (100 requests per minute per IP)
- Docker containers have health checks for monitoring
- Config/snapshot data persists across container restarts via Docker volume

---

## Migration from v4.x to v5.6

### Overview of Changes

- **Server-backed configuration**: API keys move to `.env` when using the Express backend
- **Snapshot hydration**: Backend persists a snapshot and serves it via `/api/snapshot`
- **Recommended auto-refresh**: Uses `settings.autoRefreshSeconds` (defaults to 5m / 300s)
- **Static mode still supported**: `config/stocks.json` continues to work for offline use

### Migration Steps

1. **Create `.env`**

   ```bash
   cp server/.env.example .env
   # Add your API keys
   ```

2. **Keep defaults in `config/stocks.json`**
   - Symbols, base URLs, rate limits, and snapshot file path live here

3. **Run the backend**

   ```bash
   npm run build
   npm start
   ```

4. **Verify provider status**
   - Open `http://localhost:1234/api/config` and confirm providers are enabled

5. **(Optional) Update settings**
   - Add `settings.autoRefreshSeconds` or `settings.snapshot.file` if desired

### What's Preserved

- Watchlist symbols and portfolio data in localStorage
- Theme preference
- Auto-refresh selection (resets to Manual on reload)

### What's New

- Server-powered config and API routes (`/api/config`, `/api/stocks/quotes`, `/api/crypto/quotes`)
- Snapshot file to speed up first render
- Admin-only cache clear endpoint (`/api/cache/clear` with `ADMIN_TOKEN`)
- Build-time frontend assets replace browser-side Tailwind compilation

## Migration from v3.0 to v4.0

If you're upgrading from v3.0 to v4.0:

### Overview of Changes

- **Yahoo Finance Integration**: New fallback provider added automatically (no configuration needed)
- **Enhanced Fallback Chain**: Yahoo Finance provides last-resort data when other providers fail
- **No Breaking Changes**: All existing functionality preserved

### Migration Steps

1. **No Action Required**: Yahoo Finance is enabled by default
2. **Optional Configuration**: You can customize Yahoo Finance settings in `config/stocks.json`:
   ```json
   {
     "api": {
       "yahooFinance": {
         "enabled": true,
         "baseUrl": "https://query1.finance.yahoo.com/v8/finance/chart",
         "corsProxy": null
       }
     },
     "settings": {
       "rateLimiting": {
         "yahooFinance": {
           "requestsPerMinute": 20,
           "delayBetweenRequests": 3000
         }
       }
     }
   }
   ```
3. **Test Functionality**: Verify all features work as expected

## Migration from v2.0 (Twelve Data)

If you're upgrading from the Twelve Data version (v2.0) to v5.6:

### Overview of Changes

- **API Migration**: From Twelve Data to Finnhub (primary) + CoinGecko (crypto)
- **Enhanced Features**: Better crypto data, analyst recommendations, improved rate limits

### Migration Steps

#### 1. Backup Your Data

**Export Current Data**:

1. Open your v2.0 dashboard
2. Click the menu button (⋯)
3. Select "Export Data"
4. Save the JSON file

**Backup Configuration**:

```bash
cp config/stocks.json config/stocks.json.backup
```

#### 2. Get New API Keys

**Required**:

- **Finnhub**: [Get API Key](https://finnhub.io/) - Primary stock/ETF provider
- **CoinGecko**: [Get API Key](https://www.coingecko.com/) - Crypto provider (demo API works without key)

**Optional** (for redundancy):

- **Financial Modeling Prep**: Keep existing key if you have one
- **Alpha Vantage**: [Get API Key](https://www.alphavantage.co/) - Fallback provider

#### 3. Update Configuration

**Old v2.0 Configuration** (Twelve Data):

```json
{
  "apiKey": "YOUR_TWELVE_DATA_KEY",
  "stocks": ["AAPL", "GOOGL"]
}
```

**New v5.6 Configuration**:

```json
{
  "stocks": ["AAPL", "GOOGL"],
  "cryptos": ["BTC", "ETH"],
  "api": {
    "finnhub": {
      "apiKey": "YOUR_FINNHUB_API_KEY",
      "baseUrl": "https://finnhub.io/api/v1"
    },
    "coingecko": {
      "baseUrl": "https://api.coingecko.com/api/v3"
    }
  }
}
```

#### 4. Import Your Data

1. Open the new dashboard
2. Click "Manage"
3. Use "Import" to add your exported symbols

#### 5. Test Functionality

1. **Verify stocks load**: Check that stock data appears
2. **Test crypto**: Add a crypto symbol and verify it loads
3. **Check portfolio**: If you had portfolio data, verify it's preserved
4. **Test features**: Try auto-refresh, theme toggle, etc.

### Rollback Procedure

If you need to rollback to v2.0:

1. **Restore backup**:

   ```bash
   cp config/stocks.json.backup config/stocks.json
   ```

2. **Use backup code**: The original Twelve Data implementation is saved in `js/app.js.backup`

## Version History

### v6.0 (Current)

- ESLint + Prettier with pre-commit hooks (husky + lint-staged)
- API rate limiting middleware (express-rate-limit)
- Environment variable validation on startup
- Docker HEALTHCHECK and persistent volume for config/snapshots
- CI/CD lint and test steps before Docker build
- Root `.env.example` for easier onboarding
- CONTRIBUTING.md and SECURITY.md for open-source readiness

### v5.8 (Previous)

- Server-backed config and API routes
- Snapshot hydration via `/api/snapshot`
- Recommended auto-refresh interval setting

### v5.0 (Previous)

- Express backend and server-side API support
- Environment-driven secrets

### v4.0 (Previous)

- Yahoo Finance as last-resort fallback provider
- Improved fallback chain

### v3.0 (Previous)

- Finnhub + CoinGecko migration
- Analyst recommendations and improved crypto data

### v2.0 (Previous)

- Twelve Data API

## Breaking Changes

### API Key Location (Server Mode)

If you're running the Express backend, API keys must be placed in `.env`. `config/stocks.json` is only used for defaults and static mode.

### Symbol Categorization

Symbols are auto-categorized:

- Stocks: Individual company tickers
- Crypto: BTC, ETH, etc.
- ETFs: SPY, QQQ, etc.

## Support

If you encounter issues during migration:

1. Check [Troubleshooting](./troubleshooting.md) guide
2. Review browser console for errors
3. Verify API keys are correct
4. Test with example symbols first
5. Check API provider status pages

---

[← Back to Documentation Index](./README.md) | [Main README →](../README.md)
