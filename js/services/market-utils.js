export function getMarketStatus(date = new Date()) {
    const d = new Date(date);
    const day = d.getUTCDay();
    const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();

    if (day === 0 || day === 6) {
        return { status: 'closed', text: 'Market Closed (Weekend)' };
    }

    const PRE_START = 9 * 60;
    const OPEN_START = 14 * 60 + 30;
    const OPEN_END = 21 * 60;
    const AFTER_END = 25 * 60;

    if (minutes >= OPEN_START && minutes < OPEN_END) {
        return { status: 'open', text: 'Market Open' };
    }

    if (minutes >= PRE_START && minutes < OPEN_START) {
        return { status: 'pre-post', text: 'Pre-Market' };
    }

    if ((minutes >= OPEN_END && minutes < 24 * 60) || minutes < AFTER_END - 24 * 60) {
        return { status: 'pre-post', text: 'After-Hours' };
    }

    return { status: 'closed', text: 'Market Closed' };
}

export function getLastUpdatedText(timestamp, now = new Date()) {
    if (!timestamp) return 'Last updated: Never';
    const ts = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const diffMs = now - ts;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 45) return 'Last updated: just now';
    if (diffMin < 60) return `Last updated: ${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `Last updated: ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    return `Last updated: ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

