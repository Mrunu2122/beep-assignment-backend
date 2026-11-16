import { RawJobInput } from '@launchpad/shared';

export interface ISourceAdapter {
  readonly sourceName: string;
  readonly sourceId: string;
  readonly termsDocumentationUrl: string;
  readonly rateLimitPerMinute: number;
  readonly paginationSupported: boolean;

  fetchJobs(options?: { page?: number; limit?: number }): Promise<RawJobInput[]>;
}

export class SourceRegistry {
  private adapters: Map<string, ISourceAdapter> = new Map();

  register(adapter: ISourceAdapter): void {
    if (this.adapters.has(adapter.sourceId)) {
      throw new Error(`Source adapter with ID '${adapter.sourceId}' is already registered.`);
    }
    this.adapters.set(adapter.sourceId, adapter);
  }

  get(sourceId: string): ISourceAdapter | undefined {
    return this.adapters.get(sourceId);
  }

  getAll(): ISourceAdapter[] {
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

export const sourceRegistry = new SourceRegistry();
