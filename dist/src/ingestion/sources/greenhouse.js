"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GreenhouseSourceAdapter = void 0;
// Top Indian companies using Greenhouse public job boards
const GREENHOUSE_COMPANIES = [
    { name: 'Razorpay', token: 'razorpay' },
    { name: 'Swiggy', token: 'swiggy' },
    { name: 'CRED', token: 'cred' },
    { name: 'Postman', token: 'postman' },
    { name: 'Meesho', token: 'meesho' },
];
class GreenhouseSourceAdapter {
    sourceName = 'Greenhouse Public Board API';
    sourceId = 'greenhouse_public_api';
    termsDocumentationUrl = 'https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs';
    rateLimitPerMinute = 60;
    paginationSupported = false;
    async fetchJobs() {
        const rawJobs = [];
        for (const company of GREENHOUSE_COMPANIES) {
            try {
                const url = `https://boards-api.greenhouse.io/v1/boards/${company.token}/jobs?content=true`;
                const res = await fetch(url, {
                    headers: { 'User-Agent': 'LaunchpadFresherBot/1.0 (+https://launchpad.careers/bot)' },
                    signal: AbortSignal.timeout(6000),
                });
                if (!res.ok) {
                    continue;
                }
                const data = (await res.json());
                if (data.jobs && Array.isArray(data.jobs)) {
                    for (const item of data.jobs) {
                        const loc = item.location?.name || '';
                        const title = item.title;
                        // Filter relevant to India or remote
                        const isIndiaRelevant = loc.toLowerCase().includes('india') ||
                            loc.toLowerCase().includes('bengaluru') ||
                            loc.toLowerCase().includes('bangalore') ||
                            loc.toLowerCase().includes('remote') ||
                            loc.toLowerCase().includes('hyderabad') ||
                            loc.toLowerCase().includes('pune');
                        if (!isIndiaRelevant)
                            continue;
                        rawJobs.push({
                            sourceId: this.sourceId,
                            externalId: String(item.id),
                            originalUrl: item.absolute_url,
                            applicationUrl: item.absolute_url,
                            title: title,
                            company: company.name,
                            descriptionRaw: item.content || `Open engineering position at ${company.name}`,
                            rawLocation: loc,
                            postedAtRaw: item.updated_at,
                        });
                    }
                }
            }
            catch {
                // Source isolation: individual company board timeouts shouldn't fail entire adapter
            }
        }
        return rawJobs;
    }
}
exports.GreenhouseSourceAdapter = GreenhouseSourceAdapter;
