import { ISourceAdapter } from './base.js';
import { RawJobInput } from '@launchpad/shared';

const LEVER_COMPANIES = [
  { name: 'BrowserStack', token: 'browserstack' },
  { name: 'Hasura', token: 'hasura' },
  { name: 'CleverTap', token: 'clevertap' },
];

export class LeverSourceAdapter implements ISourceAdapter {
  readonly sourceName = 'Lever Public Postings API';
  readonly sourceId = 'lever_public_api';
  readonly termsDocumentationUrl = 'https://api.lever.co/v0/postings/{site}';
  readonly rateLimitPerMinute = 60;
  readonly paginationSupported = false;

  async fetchJobs(): Promise<RawJobInput[]> {
    const rawJobs: RawJobInput[] = [];

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

        const data = (await res.json()) as Array<{
          id: string;
          text: string;
          hostedUrl: string;
          applyUrl: string;
          categories?: { location?: string; commitment?: string };
          descriptionPlain?: string;
          createdAt?: number;
        }>;

        if (Array.isArray(data)) {
          for (const item of data) {
            const loc = item.categories?.location || '';
            const isIndiaRelevant = loc.toLowerCase().includes('india') ||
              loc.toLowerCase().includes('mumbai') ||
              loc.toLowerCase().includes('remote') ||
              loc.toLowerCase().includes('bengaluru');

            if (!isIndiaRelevant) continue;

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
      } catch {
        // Individual site isolation
      }
    }

    return rawJobs;
  }
}
