# Finance Dashboard Test Suite

Comprehensive test suite for the Finance Dashboard application using Jest.

## Test Structure

- **cache.test.js** - Cache management and expiry logic
- **portfolio.test.js** - Portfolio calculations and P/L metrics
- **app-logic.test.js** - Application logic (categorization, formatting, market status)
- **rate-limiter.test.js** - API rate limiting functionality
- **integration.test.js** - End-to-end flows and component interactions

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

## Test Coverage

The test suite covers:
- ✅ Cache management (get, set, expiry, statistics)
- ✅ Portfolio calculations (P/L, percentages, edge cases)
- ✅ Stock categorization (stocks, crypto, ETFs)
- ✅ Market status detection (open, closed, pre/post)
- ✅ Number formatting (K, M, B suffixes)
- ✅ Rate limiting logic
- ✅ Integration flows
- ✅ Error handling

## Test Environment

Tests run in a jsdom environment with mocked:
- `localStorage`
- `fetch` API
- DOM methods
- `navigator.clipboard`
- `URL.createObjectURL`

## Adding New Tests

When adding new functionality:
1. Add tests to the appropriate test file
2. Test happy paths and edge cases
3. Test error scenarios
4. Update this README if adding new test files

## Coverage Goals

- Critical paths: 80%+ coverage
- API clients: Comprehensive error handling tests
- Portfolio calculations: All edge cases covered
- Integration flows: Main user journeys tested


