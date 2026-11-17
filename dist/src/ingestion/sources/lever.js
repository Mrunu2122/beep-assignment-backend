"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeverSourceAdapter = void 0;
const LEVER_COMPANIES = [
    { name: 'BrowserStack', token: 'browserstack' },
    { name: 'Hasura', token: 'hasura' },
    { name: 'CleverTap', token: 'clevertap' },
];
class LeverSourceAdapter {
    sourceName = 'Lever Public Postings API';
    sourceId = 'lever_public_api';
    termsDocumentationUrl = 'https://api.lever.co/v0/postings/{site}';
    rateLimitPerMinute = 60;
    paginationSupported = false;
    async fetchJobs() {
        const rawJobs = [];
        for (const company of LEVER_COMPANIES) {
            try {
                const url = `https://api.lever.co/v0/postings/${company.token}?mode=json`;
                const res = await fetch(url, {
                    headers: { 'User-Agent': 'LaunchpadFresherBot/1.0 (+https://launchpad.careers/bot)' },
                    signal: AbortSignal.timeout(6000),
                });
                if (!res.ok) {
                    continue;
                }
                const data = (await res.json());
                if (Array.isArray(data)) {
                    for (const item of data) {
                        const loc = item.categories?.location || '';
                        const isIndiaRelevant = loc.toLowerCase().includes('india') ||
                            loc.toLowerCase().includes('mumbai') ||
                            loc.toLowerCase().includes('remote') ||
                            loc.toLowerCase().includes('bengaluru');
                        if (!isIndiaRelevant)
                            continue;
                        rawJobs.push({
                            sourceId: this.sourceId,
                            externalId: item.id,
                            originalUrl: item.hostedUrl,
                            applicationUrl: item.applyUrl || item.hostedUrl,
                            title: item.text,
                            company: company.name,
                            descriptionRaw: item.descriptionPlain || `${item.text} at ${company.name}`,
                            rawLocation: loc,
                            postedAtRaw: item.createdAt ? new Date(item.createdAt).toISOString() : undefined,
                        });
                    }
                }
            }
            catch {
                // Individual site isolation
            }
        }
        return rawJobs;
    }
}
exports.LeverSourceAdapter = LeverSourceAdapter;
