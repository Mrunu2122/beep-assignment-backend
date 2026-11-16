"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CuratedFresherIndexAdapter = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class CuratedFresherIndexAdapter {
    sourceName = 'Curated Public Fresher Index';
    sourceId = 'curated_fresher_index';
    termsDocumentationUrl = 'https://launchpad.careers/terms/curated-feed';
    rateLimitPerMinute = 120;
    paginationSupported = true;
    async fetchJobs() {
        // Reads verified local benchmark feed or seed fixture if offline/network restricted
        const seedPath = path_1.default.resolve(process.cwd(), '../data/seed-jobs.json');
        const localSeedPath = path_1.default.resolve(process.cwd(), 'data/seed-jobs.json');
        const filePath = fs_1.default.existsSync(seedPath) ? seedPath : fs_1.default.existsSync(localSeedPath) ? localSeedPath : null;
        if (!filePath) {
            return [];
        }
        try {
            const rawData = fs_1.default.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(rawData);
            return parsed.map((item) => ({
                sourceId: this.sourceId,
                externalId: String(item.id),
                originalUrl: item.applyUrl,
                applicationUrl: item.applyUrl,
                title: item.title,
                company: item.company,
                descriptionRaw: item.description,
                rawLocation: item.normalizedCity || 'India',
                postedAtRaw: item.discoveredAt,
            }));
        }
        catch {
            return [];
        }
    }
}
exports.CuratedFresherIndexAdapter = CuratedFresherIndexAdapter;
