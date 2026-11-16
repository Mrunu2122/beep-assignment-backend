"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sourceRegistry = exports.SourceRegistry = void 0;
class SourceRegistry {
    adapters = new Map();
    register(adapter) {
        if (this.adapters.has(adapter.sourceId)) {
            throw new Error(`Source adapter with ID '${adapter.sourceId}' is already registered.`);
        }
        this.adapters.set(adapter.sourceId, adapter);
    }
    get(sourceId) {
        return this.adapters.get(sourceId);
    }
    getAll() {
        return Array.from(this.adapters.values());
    }
    listMetadata() {
        return this.getAll().map(adapter => ({
            sourceName: adapter.sourceName,
            sourceId: adapter.sourceId,
            termsDocumentationUrl: adapter.termsDocumentationUrl,
            rateLimitPerMinute: adapter.rateLimitPerMinute,
            paginationSupported: adapter.paginationSupported,
        }));
    }
}
exports.SourceRegistry = SourceRegistry;
exports.sourceRegistry = new SourceRegistry();
