// CommonJS shim exposing shared utilities for tests and legacy imports.
// Re-export the server-side implementations of RateLimiter and EnhancedCache.
const { RateLimiter, EnhancedCache: ServerCache } = require('../server/services/api-clients');

class EnhancedCache extends ServerCache {
    getStats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;
        for (const item of this.cache.values()) {
            if (now < item.expiry) {
                valid++;
            } else {
                expired++;
            }
        }
        return { valid, expired, total: this.cache.size };
    }
}

module.exports = { RateLimiter, EnhancedCache };
