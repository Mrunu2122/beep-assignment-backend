import { ISourceAdapter } from './base.js';
import { RawJobInput } from '@launchpad/shared';

// Top Indian companies using Greenhouse public job boards
const GREENHOUSE_COMPANIES = [
  { name: 'Razorpay', token: 'razorpay' },
  { name: 'Swiggy', token: 'swiggy' },
  { name: 'CRED', token: 'cred' },
  { name: 'Postman', token: 'postman' },
  { name: 'Meesho', token: 'meesho' },
];

export class GreenhouseSourceAdapter implements ISourceAdapter {
  readonly sourceName = 'Greenhouse Public Board API';
  readonly sourceId = 'greenhouse_public_api';
  readonly termsDocumentationUrl = 'https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs';
  readonly rateLimitPerMinute = 60;
  readonly paginationSupported = false;

  async fetchJobs(): Promise<RawJobInput[]> {
    const rawJobs: RawJobInput[] = [];

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

        const data = (await res.json()) as { jobs?: Array<{ id: number; title: string; absolute_url: string; location?: { name: string }; content: string; updated_at: string }> };
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

            if (!isIndiaRelevant) continue;

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
      } catch {
        // Source isolation: individual company board timeouts shouldn't fail entire adapter
      }
    }

    return rawJobs;
  }
}
