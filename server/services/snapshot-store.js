const fs = require('fs');
const path = require('path');

function mergeStockSnapshotResults(incomingResults = [], existingResults = []) {
    if (!Array.isArray(incomingResults) || incomingResults.length === 0) {
        return incomingResults;
    }

    const existingBySymbol = new Map(
        (existingResults || [])
            .filter((entry) => entry?.data?.symbol)
            .map((entry) => [entry.data.symbol, entry])
    );

    return incomingResults.map((entry) => {
        const symbol = entry?.data?.symbol;
        const existing = symbol ? existingBySymbol.get(symbol) : null;
        if (!existing?.data) {
            return entry;
        }

        const recommendation = entry.data.recommendation;
        const normalizedRecommendation = typeof recommendation === 'string'
            ? recommendation.trim().toUpperCase()
            : recommendation;
        const hasIncomingRecommendation = recommendation != null
            && normalizedRecommendation !== ''
            && normalizedRecommendation !== 'N/A';

        return {
            ...entry,
            data: {
                ...existing.data,
                ...entry.data,
                recommendation: hasIncomingRecommendation ? entry.data.recommendation : existing.data.recommendation,
                recommendationDetails: entry.data.recommendationDetails ?? existing.data.recommendationDetails ?? null
            }
        };
    });
}

class SnapshotStore {
    constructor(filePath) {
        if (!filePath) {
            throw new Error('SnapshotStore requires a file path');
        }

        this.filePath = filePath;
        this.dir = path.dirname(filePath);
    }

    async ensureDirectory() {
        await fs.promises.mkdir(this.dir, { recursive: true });
    }

    async readSnapshot() {
        try {
            const raw = await fs.promises.readFile(this.filePath, 'utf-8');
            return JSON.parse(raw);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }

            console.warn(`SnapshotStore: unable to read snapshot (${this.filePath}):`, error.message);
            return null;
        }
    }

    async writeSnapshot(data) {
        await this.ensureDirectory();
        const payload = JSON.stringify(data, null, 2);
        await fs.promises.writeFile(this.filePath, payload, 'utf-8');
        return data;
    }

    async updateSection(sectionKey, sectionData = {}, metadata = {}) {
        if (!sectionKey) {
            throw new Error('SnapshotStore.updateSection requires a section key');
        }

        const now = new Date().toISOString();
        const snapshot = (await this.readSnapshot()) || {};
        const mergedSectionData = sectionKey === 'stocks'
            ? {
                ...sectionData,
                results: mergeStockSnapshotResults(sectionData.results, snapshot.stocks?.results)
            }
            : sectionData;
        snapshot[sectionKey] = {
            ...mergedSectionData,
            fetchedAt: mergedSectionData?.fetchedAt || now
        };

        snapshot.metadata = {
            ...(snapshot.metadata || {}),
            ...metadata,
            updatedAt: metadata.updatedAt || now
        };

        return this.writeSnapshot(snapshot);
    }

    async clearSnapshot() {
        try {
            await fs.promises.unlink(this.filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
}

module.exports = { SnapshotStore };
