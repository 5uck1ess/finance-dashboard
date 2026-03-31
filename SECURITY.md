# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Finance Dashboard, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please email the maintainer directly or use GitHub's private vulnerability reporting feature:

1. Go to the repository's **Security** tab
2. Click **Report a vulnerability**
3. Provide a detailed description of the issue

## What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix**: As soon as possible, depending on severity

## Scope

The following are in scope:

- Server-side vulnerabilities (Express routes, middleware)
- API key exposure risks
- Cross-site scripting (XSS)
- Injection vulnerabilities
- Authentication/authorization bypasses (e.g., ADMIN_TOKEN)

The following are out of scope:

- Vulnerabilities in third-party API providers (Finnhub, CoinGecko, etc.)
- Issues requiring physical access to the deployment machine
- Social engineering attacks

## Best Practices for Users

- **Never commit `.env` files** to version control
- **Rotate API keys** if you suspect they've been exposed
- **Use HTTPS** in production deployments
- **Set `ADMIN_TOKEN`** to protect the cache clear endpoint
- **Keep dependencies updated** with `npm audit`
