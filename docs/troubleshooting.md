# Troubleshooting

Common issues and solutions for the Finance Dashboard.

## Common Issues

### "API key not configured" Error

**Symptoms**: Error message appears, no data loads

**Solutions**:
1. **Server mode**: Verify `.env` contains your keys (`FINNHUB_API_KEY`, etc.)
2. **Static mode**: Ensure `config/stocks.json` includes the keys
3. Check JSON syntax (use a validator)
4. Verify API key values are correct (no extra spaces)
5. Ensure you're using a web server (not file://)

**Verification Steps**:
1. Open `.env` or `config/stocks.json`
2. Verify the structure matches `server/.env.example` or `stocks.example.json`
3. Open `http://localhost:1234/api/config` to see provider status

### No Data Loading

**Symptoms**: Dashboard loads but shows no stock/crypto data

**Solutions**:
1. **Verify internet connection**
2. **Check provider status**: Open `/api/config` and confirm providers are enabled
3. **Check browser console** for errors
4. **Verify API keys** are valid
5. **Check rate limits** (429 errors)
6. **Try manual refresh**
7. **If styles look stale after UI edits**: rerun `npm run build`

### High Latency / Slow Loading

**Symptoms**: Dashboard takes a long time to load data

**Solutions**:
1. **First load is slower**: Initial load fetches all data; subsequent loads use cache
2. **Check API rate limits**: Multiple symbols may trigger delays
3. **Reduce symbol count**: Fewer symbols = faster loading
4. **Increase cache time**: Adjust cache expiry in settings (see [Configuration](./configuration.md))
5. **Check network speed**

### Crypto Data Not Loading

**Symptoms**: Stocks load but crypto data doesn't appear

**Solutions**:
1. **Check CoinGecko API**: CoinGecko may be rate-limited
2. **Verify crypto symbols**: Ensure symbols are valid (BTC, ETH, etc.)
3. **Check browser console** for CoinGecko errors
4. **Verify CoinGecko config**: Ensure `coingecko.baseUrl` is set

### Yahoo Finance CORS Errors

**Symptoms**: CORS error messages in console when Yahoo Finance is used as fallback

**Solutions**:
1. **Static mode only**: Configure a `corsProxy` for Yahoo Finance
2. **Server mode**: Ensure the backend is running (Yahoo is fetched server-side)
3. **Disable Yahoo Finance**: Set `yahooFinance.enabled: false` if needed

### Portfolio Data Not Showing

**Symptoms**: Portfolio summary doesn't appear or shows $0.00

**Solutions**:
1. **Add portfolio data**: Go to Manage page and add shares/cost basis
2. **Refresh dashboard**: Click manual refresh to update summary
3. **Check localStorage**: Verify `portfolio` exists in browser localStorage

### Auto-Refresh Not Working

**Symptoms**: Auto-refresh doesn't trigger or resets on reload

**Solutions**:
1. **Auto-refresh resets to Manual** on every page load (opt-in each session)
2. **Select a refresh option** from the dropdown
3. **Verify interval**: Only 30s/1m/5m/Recommended are supported
4. **Check console** for JavaScript errors

### Theme Not Persisting

**Symptoms**: Theme resets to default on page reload

**Solutions**:
1. **Check localStorage**: Verify browser allows localStorage
2. **Clear cache** and try again
3. **Check browser settings**: Private mode may block localStorage

### Symbols Not Adding

**Symptoms**: Can't add new stocks/cryptos to track

**Solutions**:
1. **Check format**: Ensure symbols are uppercase (AAPL not aapl)
2. **Verify duplicates**: Symbol may already be in list
3. **Check localStorage**: Verify browser allows writes
4. **Check console** for errors

### Import/Export Not Working

**Symptoms**: Import or export buttons don't work

**Solutions**:
1. **Check file format**: Supported formats are JSON (export file) or TXT (one symbol per line)
2. **Verify permissions**: Browser may block file operations
3. **Check console** for errors
4. **Try different browser**

## Browser Console

### Accessing Developer Tools

**Chrome/Edge**:
- Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
- Press `Cmd+Option+I` (Mac)

**Firefox**:
- Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
- Press `Cmd+Option+I` (Mac)

**Safari**:
- Enable Developer menu: Preferences → Advanced → Show Develop menu
- Press `Cmd+Option+I`

### What to Look For

1. **Console Tab**: JavaScript errors and warnings
2. **Network Tab**: Failed API requests and response codes
3. **Application Tab**: localStorage data

### Common Error Messages

**CORS Error**:
- **Cause**: Opening file directly (file://) or Yahoo Finance in static mode
- **Solution**: Use a local web server or switch to server mode

**404 Not Found**:
- **Cause**: Missing config file or wrong path
- **Solution**: Verify `config/stocks.json` exists and path is correct

**401 Unauthorized**:
- **Cause**: Invalid or expired API key
- **Solution**: Verify API key in `.env` or `config/stocks.json`

**429 Too Many Requests**:
- **Cause**: Rate limit exceeded
- **Solution**: Wait a few minutes or adjust rate limiting settings

## Performance Issues

### Slow Rendering

**Solutions**:
1. Reduce number of tracked symbols
2. Disable auto-refresh
3. Clear browser cache
4. Close other browser tabs

### High Memory Usage

**Solutions**:
1. Clear cache regularly
2. Reduce number of symbols
3. Close unused browser tabs

## Getting Help

### Before Reporting Issues

1. Check this troubleshooting guide
2. Review the [Configuration](./configuration.md) documentation
3. Test with example symbols first
4. Check browser console for errors
5. Verify API keys are correct

### Reporting Issues

When reporting issues, please include:

- **Browser and version**: e.g., Chrome 120, Firefox 121
- **Operating system**: e.g., Windows 11, macOS 14, Linux
- **Error messages**: Copy exact error from browser console
- **Steps to reproduce**: Detailed steps to trigger the issue
- **Configuration**: Share config structure (without API keys)
- **Screenshots**: If applicable, include screenshots

### Additional Resources

- [Getting Started Guide](./getting-started.md)
- [API Configuration](./api-configuration.md)
- [Configuration Guide](./configuration.md)
- [Main README](../README.md)

---

[← Back to Documentation Index](./README.md) | [Main README →](../README.md)
