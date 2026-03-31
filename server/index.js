require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { loadBaseConfig, buildRuntimeConfig, sanitizeConfig, validateEnv } = require('./config');
const { DataService } = require('./services/data-service');
const { SnapshotStore } = require('./services/snapshot-store');

const envWarnings = validateEnv();
if (envWarnings.length > 0) {
  console.warn('Environment configuration warnings:');
  envWarnings.forEach((w) => console.warn(`  - ${w}`));
}

const baseConfig = loadBaseConfig();
const runtimeConfig = buildRuntimeConfig(baseConfig);
const dataService = new DataService(baseConfig, runtimeConfig.providers);

const snapshotConfig = baseConfig.settings?.snapshot?.file || path.join('config', 'dashboard-snapshot.json');
const snapshotFilePath = path.isAbsolute(snapshotConfig) ? snapshotConfig : path.join(__dirname, '..', snapshotConfig);
const snapshotStore = new SnapshotStore(snapshotFilePath);

const app = express();

app.disable('x-powered-by');
app.use(
  helmet({
    hsts: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'upgrade-insecure-requests': null,
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        'font-src': ["'self'", 'https://cdnjs.cloudflare.com'],
        'img-src': ["'self'", 'data:', 'https://assets.coingecko.com', 'https://coin-images.coingecko.com'],
        'connect-src': [
          "'self'",
          'https://financialmodelingprep.com',
          'https://finnhub.io',
          'https://www.alphavantage.co',
          'https://query1.finance.yahoo.com',
          'https://query2.finance.yahoo.com',
          'https://api.coingecko.com',
        ],
      },
    },
  })
);
app.use(compression());
app.use(express.json({ limit: '50kb' }));

const corsOrigin = runtimeConfig.server.corsOrigin;
if (corsOrigin) {
  const origins = corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(cors({ origin: origins }));
} else {
  app.use(cors());
}

app.use(morgan('combined'));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/config', (req, res) => {
  const sanitized = sanitizeConfig(baseConfig);
  res.json({
    ...sanitized,
    providers: dataService.getProviderStatus(),
  });
});

app.post('/api/stocks/quotes', async (req, res, next) => {
  try {
    const { symbols = [], includeRecommendation = true, forceRefresh = false } = req.body || {};
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'symbols array is required' });
    }

    const results = await dataService.getEquityQuotes(symbols, { includeRecommendation, forceRefresh });
    const payload = { results };

    try {
      await snapshotStore.updateSection(
        'stocks',
        {
          requestedSymbols: symbols,
          options: { includeRecommendation, forceRefresh },
          results,
          fetchedAt: new Date().toISOString(),
        },
        { lastSection: 'stocks' }
      );
    } catch (snapshotError) {
      console.warn('Unable to persist stock snapshot:', snapshotError.message);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.post('/api/crypto/quotes', async (req, res, next) => {
  try {
    const { symbols = [], forceRefresh = false } = req.body || {};
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'symbols array is required' });
    }

    const results = await dataService.getCryptoQuotes(symbols, { forceRefresh });
    const payload = { results };

    try {
      await snapshotStore.updateSection(
        'crypto',
        {
          requestedSymbols: symbols,
          options: { forceRefresh },
          results,
          fetchedAt: new Date().toISOString(),
        },
        { lastSection: 'crypto' }
      );
    } catch (snapshotError) {
      console.warn('Unable to persist crypto snapshot:', snapshotError.message);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get('/api/snapshot', async (req, res, next) => {
  try {
    const snapshot = await snapshotStore.readSnapshot();
    if (!snapshot) {
      return res.status(204).end();
    }
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

app.post('/api/cache/clear', async (req, res, next) => {
  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken && req.headers['x-admin-token'] !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    dataService.clearCache();
    await snapshotStore.clearSnapshot();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

const rootDir = path.join(__dirname, '..');
const serveStatic = (route, dir) => {
  app.use(route, express.static(path.join(rootDir, dir), { fallthrough: true, index: false }));
};

serveStatic('/css', 'css');
serveStatic('/js', 'js');
serveStatic('/config', 'config');
serveStatic('/docs', 'docs');

app.get('/favicon.svg', (req, res) => {
  res.sendFile(path.join(rootDir, 'favicon.svg'));
});

app.get(['/manage', '/manage.html'], (req, res) => {
  res.sendFile(path.join(rootDir, 'manage.html'));
});

app.get(['/', '/index', '/index.html'], (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const port = runtimeConfig.server.port;
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Finance Dashboard server listening on port ${port}`);
  });
}

module.exports = app;
