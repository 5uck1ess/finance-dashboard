export class StorageService {
    constructor() {
        this.CONFIG_KEY = 'finance_dashboard_config';
        this.PORTFOLIO_KEY = 'portfolio';
        this.MINIMIZED_SECTIONS_KEY = 'minimizedSections';
        this.LAST_UPDATED_KEY = 'lastUpdated';
        this.AUTO_REFRESH_KEY = 'autoRefreshSeconds';
        this.CACHED_DATA_KEY = 'cachedDashboardData';
    }

    getConfig() {
        try {
            return JSON.parse(localStorage.getItem(this.CONFIG_KEY) || '{}');
        } catch (e) {
            console.error('Error parsing config:', e);
            return {};
        }
    }

    saveConfig(config) {
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    }

    getPortfolio() {
        try {
            return JSON.parse(localStorage.getItem(this.PORTFOLIO_KEY) || '{}');
        } catch (e) {
            console.error('Error parsing portfolio:', e);
            return {};
        }
    }

    savePortfolio(portfolio) {
        localStorage.setItem(this.PORTFOLIO_KEY, JSON.stringify(portfolio));
    }

    getMinimizedSections() {
        try {
            return JSON.parse(localStorage.getItem(this.MINIMIZED_SECTIONS_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    saveMinimizedSections(sections) {
        localStorage.setItem(this.MINIMIZED_SECTIONS_KEY, JSON.stringify(sections));
    }

    getLastUpdated() {
        return localStorage.getItem(this.LAST_UPDATED_KEY);
    }

    saveLastUpdated(date) {
        const value = date instanceof Date ? date.toISOString() : date;
        localStorage.setItem(this.LAST_UPDATED_KEY, value);
    }

    getAutoRefresh() {
        return localStorage.getItem(this.AUTO_REFRESH_KEY);
    }

    saveAutoRefresh(value) {
        localStorage.setItem(this.AUTO_REFRESH_KEY, value);
    }

    getCachedData() {
        try {
            return JSON.parse(localStorage.getItem(this.CACHED_DATA_KEY) || 'null');
        } catch (e) {
            console.error('Error parsing cached dashboard data:', e);
            return null;
        }
    }

    saveCachedData(data) {
        try {
            localStorage.setItem(this.CACHED_DATA_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Unable to persist cached dashboard data:', e);
        }
    }
}
