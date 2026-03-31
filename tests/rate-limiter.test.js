const { RateLimiter } = require('../js/api-clients');

const createLimiterHarness = (maxRequests = 5, delay = 0) => {
  let currentTime = 0;
  const now = jest.fn(() => currentTime);
  const sleep = jest.fn((ms) => {
    currentTime += ms;
    return Promise.resolve();
  });

  const limiter = new RateLimiter(maxRequests, delay, { now, sleep });

  return {
    limiter,
    now,
    sleep,
    advance: (ms) => {
      currentTime += ms;
    }
  };
};

describe('RateLimiter', () => {
  test('initializes with provided parameters', () => {
    const { limiter } = createLimiterHarness(60, 1000);
    expect(limiter.maxRequests).toBe(60);
    expect(limiter.delay).toBe(1000);
    expect(limiter.requests).toEqual([]);
  });

  test('allows requests within the rate limit without sleeping', async () => {
    const { limiter, sleep } = createLimiterHarness(5, 0);
    await Promise.all(Array.from({ length: 5 }, () => limiter.wait()));
    expect(sleep).not.toHaveBeenCalled();
    expect(limiter.requests.length).toBe(5);
  });

  test('delays when the rate limit is exceeded', async () => {
    const { limiter, sleep } = createLimiterHarness(2, 0);
    await limiter.wait();
    await limiter.wait();
    await limiter.wait();

    expect(sleep).toHaveBeenCalledWith(60000);
    expect(limiter.requests.length).toBe(3);
  });

  test('removes old requests from tracking window', async () => {
    const harness = createLimiterHarness(10, 0);
    await harness.limiter.wait(); // time 0
    harness.advance(61000); // advance clock beyond 60s window
    await harness.limiter.wait();

    expect(harness.limiter.requests).toEqual([61000]);
  });

  test('respects configured inter-request delay', async () => {
    const { limiter, sleep } = createLimiterHarness(10, 200);
    await limiter.wait();

    expect(sleep).toHaveBeenLastCalledWith(200);
    expect(limiter.requests.length).toBe(1);
  });

  test('handles zero delay mode for burst scenarios', async () => {
    const { limiter, sleep } = createLimiterHarness(10, 0);
    await limiter.wait();
    expect(sleep).not.toHaveBeenCalled();
  });
});
