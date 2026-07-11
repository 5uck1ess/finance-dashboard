# Finance Dashboard

A modern, responsive finance tracking dashboard with real-time stock, ETF, and cryptocurrency data.

## Features

- Real-time pricing with automatic updates
- Portfolio tracking with profit/loss calculations
- Dark/light theme support
- Auto-refresh with market-aware scheduling
- Import/Export functionality
- Responsive design for all devices
- Enhanced crypto data with logos and market metrics
- Analyst recommendations for stocks
- Multi-provider fallback chain (Finnhub, FMP, Alpha Vantage, Yahoo Finance)
- Server-side API proxy (keys never exposed to browser)
- Rate limiting and caching for efficient API usage

## Quick Start

### 1. Get API Keys

- **Finnhub** (Required): [Get API Key](https://finnhub.io/) - 60 req/min free tier
- **CoinGecko** (Crypto): [Get API Key](https://www.coingecko.com/) - 30 req/min free tier (demo API works without key)
- **Optional Fallbacks**: [Financial Modeling Prep](https://financialmodelingprep.com/), [Alpha Vantage](https://www.alphavantage.co/), Yahoo Finance (no API key required)

### 2. Configure Environment

```bash
npm install
cp .env.example .env
# Edit .env with your API keys (never commit the real file)
npm run build
```

### 3. Run

```bash
npm start
# Visit http://localhost:1234
```

## Docker Deployment

```bash
# Build and run with Docker Compose
docker compose up --build -d

# Or build manually for NAS deployment
docker build -t finance-dashboard .
docker save finance-dashboard > finance-dashboard.tar
```

See [Deployment Guide](./docs/deployment.md) for NAS-specific instructions (Synology, QNAP, Ugreen, etc.).

## Development

```bash
npm run dev           # Start dev server with auto-reload
npm test              # Run tests
npm run lint          # Lint code
npm run format        # Format code with Prettier
```

Pre-commit hooks automatically run linting and formatting on staged files.

## Documentation

**[Complete Documentation](./docs/README.md)**

For detailed setup, configuration, API documentation, troubleshooting, and deployment guides, see the [documentation folder](./docs/).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and contribution guidelines.

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability reporting instructions.

## License

MIT License

---

**Version**: 7.0.0 | **Last Updated**: July 2026
