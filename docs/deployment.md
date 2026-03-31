# Deployment

Complete guide to deploying the Finance Dashboard on various platforms.

## Overview

The Finance Dashboard can run as a server-backed Express app (recommended) or as a static site in legacy mode. This guide covers Docker deployment, NAS setup, and static hosting options.

## Docker Deployment

### Quick Start

```bash
# Build image
docker build -t finance-dashboard .

# Run container
docker run -d -p 1234:1234 --env-file ./.env --name finance-dashboard finance-dashboard

# Access dashboard
open http://localhost:1234
```

The image build bakes the frontend utility CSS before producing the runtime image, so the container serves static CSS at runtime.

### Environment File

- Copy `.env.example` to `.env` and populate API keys.
- Pass the file to Docker with `--env-file ./.env` (as in the example above) so keys stay on the host/NAS instead of the image.
- For multi-environment setups, keep separate env files (`.env.staging`, `.env.prod`) and reference the appropriate one at runtime.

### Docker Compose

If you prefer managing the container with Docker Compose (including on a NAS), use the bundled `docker-compose.yml`:

```bash
# Build image, start container, and detach
docker compose up --build -d

# View logs / stop when needed
docker compose logs -f
docker compose down
```

Key features of the compose file:

- Uses the same `finance-dashboard` image built from the repository
- Publishes port `1234` by default (`FINANCE_DASHBOARD_PORT=8080 docker compose up -d` to override)
- Loads environment variables from `./.env` so API keys stay outside the image
- Persistent volume for config and snapshot data (survives container restarts)
- Built-in health check monitoring via `/healthz`
- Enables `restart: unless-stopped` for hands-off restarts on NAS devices

> Tip: Create a `.env` file next to `docker-compose.yml` and set `FINANCE_DASHBOARD_PORT=8080` (or any other overrides) so Compose picks up your defaults automatically.

### Dockerfile Features

- **Node 20 Alpine build + runtime stages** running the Express API + static server
- **Build stage** generates baked frontend assets before the runtime image is assembled
- **Runtime stage** keeps production dependencies only via `npm ci --omit=dev`
- **Port 1234** exposed by default (override with `PORT` env var)
- **Environment-driven secrets**: relies on runtime env vars for provider API keys
- **Built-in HEALTHCHECK**: monitors `/healthz` endpoint every 30 seconds
- **Single container** serves both API routes and static frontend files

### Docker Configuration

The Dockerfile uses:

- **Base image**: `node:20-alpine`
- **Build step**: `npm run build:assets`
- **Port**: 1234 (configurable via `PORT`)
- **Working dir**: `/app` (contains both `server/` and static assets)
- **Entrypoint**: `node server/index.js` (Express handles `/api/*` + static routes)

### HTTP Server

- The Express server already enables compression, sensible security headers (via Helmet), and SPA-friendly routing.
- No separate `nginx.conf` is required; the container serves both API routes and static assets directly.

### Custom Port

To use a different port:

```bash
docker run -d -p 8080:1234 --name finance-dashboard finance-dashboard
```

Then access at `http://localhost:8080`

### Environment Variables

Supply API keys and overrides through environment variables:

```bash
docker run -d -p 1234:1234 \
  --env FINNHUB_API_KEY=pk_... \
  --env FINANCIAL_MODELING_PREP_API_KEY=... \
  --env COINGECKO_API_KEY=... \
  --name finance-dashboard finance-dashboard
```

For convenience (and to keep secrets out of shell history), prefer an env file:

```bash
docker run -d -p 1234:1234 \
  --env-file ./.env \
  --name finance-dashboard finance-dashboard
```

## NAS Deployment

### Synology NAS

1. **Build and save image**:

   ```bash
   docker build -t finance-dashboard .
   docker save finance-dashboard > finance-dashboard.tar
   ```

2. **Transfer to NAS**: Copy `finance-dashboard.tar` to your NAS

3. **Load image**:
   - Open Docker in Synology DSM
   - Go to Image → Add → From File
   - Select `finance-dashboard.tar`

4. **Run container**:
   - Select `finance-dashboard` image
   - Click Launch
   - Configure port mapping (1234:1234)
   - Enable auto-restart
5. **Compose option** (DSM 7 Container Manager → Project):
   - Upload `docker-compose.yml` (and optional `.env`)
   - Adjust environment variables/volumes in the UI
   - Click Deploy → Start Project

### QNAP NAS

1. **Build and save image** (same as Synology)

2. **Load image**:
   - Open Container Station
   - Go to Images → Import
   - Select `finance-dashboard.tar`

3. **Create container**:
   - Select imported image
   - Configure port mapping
   - Enable auto-start
4. **Compose option** (Container Station → Create → Compose):
   - Paste the contents of `docker-compose.yml`
   - Provide any overrides (e.g., `FINANCE_DASHBOARD_PORT`)
   - Deploy the stack and monitor logs from the Projects tab

### Generic NAS Deployment

```bash
# On your development machine
docker build -t finance-dashboard .
docker save finance-dashboard > finance-dashboard.tar

# Transfer to NAS (using scp, SMB, etc.)
scp finance-dashboard.tar user@nas:/path/to/docker/

# On NAS
docker load < finance-dashboard.tar
docker run -d -p 1234:1234 --restart unless-stopped finance-dashboard
```

**Using Compose on any NAS/server**:

```bash
scp -r docker-compose.yml config user@nas:/path/to/finance-dashboard/
ssh user@nas
cd /path/to/finance-dashboard
FINANCE_DASHBOARD_PORT=8080 docker compose up -d
```

## Static Hosting

### GitHub Pages

1. **Create repository**: Create a new GitHub repository

2. **Push code**:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/username/finance-dashboard.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to Settings → Pages
   - Select source branch (main)
   - Select root directory
   - Save

4. **Access**: `https://username.github.io/finance-dashboard/`

**Note**: GitHub Pages serves over HTTPS, but API calls may require CORS configuration.

### Netlify

1. **Install Netlify CLI**:

   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**:

   ```bash
   netlify deploy --prod
   ```

3. **Configure**: Netlify auto-detects static sites

### Vercel

1. **Install Vercel CLI**:

   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

### Apache

1. **Copy files** to web root:

   ```bash
   cp -r financeDashboard/* /var/www/html/
   ```

2. **Configure Apache** (optional):
   ```apache
   <VirtualHost *:80>
       ServerName finance-dashboard.local
       DocumentRoot /var/www/html

       <Directory /var/www/html>
           Options Indexes FollowSymLinks
           AllowOverride All
           Require all granted
       </Directory>
   </VirtualHost>
   ```

### Nginx (Manual)

1. **Copy files** to web root:

   ```bash
   cp -r financeDashboard/* /usr/share/nginx/html/
   ```

2. **Configure Nginx**:
   ```nginx
   server {
       listen 80;
       server_name finance-dashboard.local;
       root /usr/share/nginx/html;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

## Production Considerations

### Security

1. **API Key Protection**:
   - Store keys in environment variables (`.env`, Docker secrets, NAS UI)
   - Keep `config/stocks.json` for defaults only (no live secrets)
   - Rotate keys centrally and restart the container to apply

2. **HTTPS**:
   - Use HTTPS in production
   - Configure SSL certificates
   - Enable HSTS headers

3. **CORS**:
   - Verify API providers support your domain
   - Some providers may require domain whitelisting

### Performance

1. **Caching**:
   - Enable browser caching for static assets
   - Configure CDN if using one
   - Use service workers for offline support (future enhancement)

2. **Compression**:
   - Enable gzip/brotli compression
   - Minify JavaScript/CSS (if not already done)

3. **CDN**:
   - Use CDN for static assets
   - Consider Cloudflare, AWS CloudFront, etc.

### Monitoring

1. **Uptime Monitoring**:
   - Use services like UptimeRobot, Pingdom
   - Monitor dashboard availability

2. **Error Tracking**:
   - Consider client-side error tracking (Sentry, etc.)
   - Monitor API failures

3. **Analytics**:
   - Optional: Add analytics (respecting privacy)
   - Track usage patterns

## Environment-Specific Configuration

### Development

```bash
# Local development server
npm start
```

### Staging

```bash
# Docker with staging env vars
docker run -d -p 1234:1234 \
  --env-file ./.env.staging \
  --name finance-dashboard-staging \
  finance-dashboard
```

### Production

```bash
# Docker with production config
docker run -d -p 1234:1234 \
  --env-file /secure/path/finance-dashboard.prod.env \
  --restart unless-stopped \
  --name finance-dashboard-prod \
  finance-dashboard
```

## Backup and Recovery

### Backup Configuration

```bash
# Backup environment file (API keys)
cp .env .env.backup

# Backup optional config defaults
cp config/stocks.json config/stocks.json.backup

# Export data from dashboard
# Use Export Data feature in dashboard
```

### Recovery

1. **Restore env/config**: Copy backups to `.env` (and `config/stocks.json` if used)
2. **Import data**: Use Import Data feature in dashboard
3. **Verify**: Check that all symbols and settings are restored

## Troubleshooting Deployment

### Container Won't Start

1. Check Docker logs: `docker logs finance-dashboard`
2. Verify port isn't in use: `netstat -an | grep 1234`
3. Check Docker status: `docker ps -a`

### Files Not Loading

1. Verify file permissions
2. Check nginx/Apache configuration
3. Verify file paths are correct
4. Check browser console for 404 errors

### API Calls Failing

1. Verify CORS is configured correctly
2. Check API keys are valid
3. Verify network connectivity
4. Check API provider status pages

---

[← Back to Documentation Index](./README.md) | [Main README →](../README.md)
