# Contributing to Finance Dashboard

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork the repository** and clone your fork locally
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```
4. **Build frontend assets**:
   ```bash
   npm run build
   ```
5. **Start the dev server**:
   ```bash
   npm run dev
   ```

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Run tests:
   ```bash
   npm test
   ```
4. Run the linter:
   ```bash
   npm run lint
   ```
5. Commit your changes (pre-commit hooks will run lint-staged automatically)
6. Push to your fork and open a Pull Request

## Code Style

- **JavaScript**: ES6+ features, no frameworks
- **Formatting**: Prettier handles formatting automatically via pre-commit hooks
- **Linting**: ESLint enforces code quality (see `eslint.config.js`)
- **Server code**: CommonJS modules (`require`/`module.exports`)
- **Frontend code**: ES6 modules (`import`/`export`)

## Project Structure

```
financeDashboard/
├── server/          # Express backend (API proxy + static server)
├── js/              # Frontend JavaScript modules
│   ├── services/    # Client-side services
│   └── ui/          # UI components
├── css/             # Stylesheets
├── config/          # Configuration files
├── tests/           # Jest test suite
├── scripts/         # Build scripts
└── docs/            # Documentation
```

## Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Add tests for new functionality
- Update documentation if applicable
- Ensure all tests pass and linting is clean

## Reporting Bugs

When reporting bugs, please include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/OS/Node.js version
- Console error output (with API keys redacted)

## Security

If you discover a security vulnerability, please see [SECURITY.md](./SECURITY.md) for responsible disclosure instructions. **Do not open a public issue for security vulnerabilities.**

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
