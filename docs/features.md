# Features

Complete documentation of all Finance Dashboard features.

## Overview

The Finance Dashboard provides real-time tracking of stocks, ETFs, and cryptocurrencies with portfolio management, auto-refresh, and a modern UI.

## Enhanced Data Sources

### Stocks & ETFs
- **Primary Provider**: Finnhub API
- **Fallback Providers**: Financial Modeling Prep, Alpha Vantage, Yahoo Finance
- **Real-time pricing** with automatic updates
- **Analyst recommendations** with consensus breakdown (Finnhub)

### Cryptocurrencies
- **Provider**: CoinGecko API
- **Enhanced data** with logos, market cap, and 24h volume

## Dashboard Features

### Real-time Data Display
- Current price and daily % change
- Three sections: Stocks, Crypto, ETFs
- Market status indicator (Open/Closed/Pre/Post)
- Last updated timestamp
- Source label for stock and crypto providers

### User Experience
- Manual refresh button with loading indicator
- Auto-refresh select (Manual, Recommended, 30s, 1m, 5m)
- Theme toggle (light/dark)
- Click symbol to copy to clipboard
- Empty state handling

### Navigation & Controls
- Sticky navigation bar with Dashboard/Manage links
- Theme toggle and refresh button in the header
- Auto-refresh selector in the toolbar

## Portfolio Tracking

### Portfolio Features
- **Shares owned tracking**: Enter number of shares for each investment
- **Cost basis input**: Record purchase price per share
- **Profit/loss calculations**: Automatic dollar and percentage P/L
- **Portfolio summary section**: Total value, cost, and P/L
- **Best performer identification**: Highlights top gainer
- **Mixed mode**: Supports both watchlist and portfolio tracking simultaneously

### Adding Portfolio Data
1. Click "Manage" in the navigation
2. Add investments with shares and cost basis
3. Save and return to dashboard
4. Portfolio metrics will appear automatically

### Portfolio Summary
The portfolio summary displays:
- **Total Value**: Current market value of all holdings
- **Total Cost**: Original purchase cost
- **Total P/L**: Profit or loss in dollars and percentage
- **Best Performer**: Symbol with highest percentage gain

## Auto-Refresh Options

### Manual Refresh
- Forces a full refresh (bypasses cache) for stocks and crypto
- Includes analyst recommendations and metadata
- Best for initial loads or when you need a fresh snapshot

### Fixed Intervals
- **30 seconds**: Faster updates for active monitoring
- **1 minute**: Balanced refresh rate
- **5 minutes**: Conservative refresh rate
- Uses cached data when available (respects cache TTL)

### Recommended
- Uses `settings.autoRefreshSeconds` (defaults to 5 minutes / 300 seconds)
- Still respects cache TTL
- Always starts in Manual on page load; you must opt in each session

## Management Tools

### Investment Management
- Add investments via form input
- Bulk selection and delete
- Export data (JSON)
- Import data (JSON or text)
- Auto-categorization (Stock/Crypto/ETF)
- Manual category override

### Import/Export Details

**Export Data**
1. Click "Export" on the Manage page
2. Downloads a JSON file containing symbols, portfolio data, and saved config overrides

**Import Data**
1. Click "Import" on the Manage page
2. Choose a JSON file (same export format) or a text file
3. Symbols are added to the current list

**Supported Formats**
- **JSON**: Export file from the dashboard (uses the `stocks` array)
- **TXT**: One symbol per line

## Theme Customization

The dashboard supports light and dark themes:
- Theme preference is stored in localStorage
- Toggle via the moon/sun icon in the header

## Market Status Indicator

Real-time market status display:
- **Market Open**: Green indicator during trading hours (9:30 AM - 4:00 PM ET)
- **Market Closed**: Gray indicator outside trading hours
- **Pre-Market**: Yellow indicator (4:00 AM - 9:30 AM ET)
- **After-Hours**: Yellow indicator (4:00 PM - 8:00 PM ET)
- **Weekend**: Gray indicator on Saturdays and Sundays

## Analyst Recommendations

For stocks, the dashboard displays:
- **Consensus rating**: Strong Buy, Buy, Hold, Sell, Strong Sell
- **Analyst breakdown**: Visual bar chart showing distribution
- **Total analysts**: Number of analysts providing recommendations

## Smart Caching & Snapshots

- **In-memory cache**: Per-symbol TTL (stocks default 5 min, crypto 1 min)
- **LocalStorage cache**: `cachedDashboardData` for quick reloads
- **Server snapshot** (backend mode): `/api/snapshot` hydrates the UI on first load
- Snapshot file location is configurable via `settings.snapshot.file`

## Data Persistence

The Finance Dashboard stores data in browser localStorage:
- **Watchlist symbols**: Stored in `stocks`
- **Portfolio data**: Stored in `portfolio`
- **Theme**: Stored in `theme`
- **Auto-refresh selection**: Stored in `autoRefreshSeconds` (resets to Manual on load)

Data is shared across `index.html` and `manage.html` when served from the same origin.

## Responsive Design

The dashboard works on all devices:
- **Mobile**: Single column layout, touch-friendly
- **Tablet**: Two column layout
- **Desktop**: Three+ column grid layout

## Error Handling

- **API failures**: Graceful fallback to alternative providers
- **Network errors**: Clear error messages
- **Invalid symbols**: Error cards with helpful messages
- **Rate limiting**: Automatic retry with delays
- **Loading states**: Visual feedback during data fetching

---

[← Back to Documentation Index](./README.md) | [Main README →](../README.md)
