import { ApplicationLinkStatus } from '@launchpad/shared';

export interface LinkValidationResult {
  originalUrl: string;
  finalDestinationUrl: string;
  status: ApplicationLinkStatus;
  httpStatusCode?: number;
  error?: string;
  checkedAt: string;
}

export class ApplicationLinkValidator {
  /**
   * Validates an external application link with safe redirect tracking and timeout
   */
  static async validateUrl(url: string, timeoutMs = 5000): Promise<LinkValidationResult> {
    const checkedAt = new Date().toISOString();

    // 1. Structure and scheme validation
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return {
          originalUrl: url,
          finalDestinationUrl: url,
          status: 'INVALID',
          error: `Unsafe URL scheme: ${parsed.protocol}`,
          checkedAt,
        };
      }
      if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local') || parsed.hostname === '127.0.0.1') {
        return {
          originalUrl: url,
          finalDestinationUrl: url,
          status: 'INVALID',
          error: 'Localhost destinations are forbidden in production',
          checkedAt,
        };
      }
    } catch {
      return {
        originalUrl: url,
        finalDestinationUrl: url,
        status: 'INVALID',
        error: 'Malformed URL structure',
        checkedAt,
      };
    }

    // 2. HTTP check with redirect following
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const finalUrl = response.url || url;
      const status = response.status;

      // Handle known job expiration redirect signatures (e.g. greenhouse ?error=true, closed postings)
      if (finalUrl.includes('error=true') || finalUrl.includes('/closed') || finalUrl.includes('/expired')) {
        return {
          originalUrl: url,
          finalDestinationUrl: finalUrl,
          status: 'EXPIRED',
          httpStatusCode: status,
          checkedAt,
        };
      }

      if (status >= 200 && status < 300) {
        const isRedirected = finalUrl !== url;
        return {
          originalUrl: url,
          finalDestinationUrl: finalUrl,
          status: isRedirected ? 'REDIRECTED' : 'VERIFIED',
          httpStatusCode: status,
          checkedAt,
        };
      }

      if (status === 404 || status === 410) {
        return {
          originalUrl: url,
          finalDestinationUrl: finalUrl,
          status: 'EXPIRED',
          httpStatusCode: status,
          checkedAt,
        };
      }

      // 403, 405, 429 often indicate bot-protection (Cloudflare, Akamai) rather than a broken page
      if (status === 403 || status === 405 || status === 429) {
        return {
          originalUrl: url,
          finalDestinationUrl: finalUrl,
          status: 'UNVERIFIED',
          httpStatusCode: status,
          checkedAt,
        };
      }

      return {
        originalUrl: url,
        finalDestinationUrl: finalUrl,
        status: 'TEMPORARILY_UNAVAILABLE',
        httpStatusCode: status,
        checkedAt,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('timeout') || message.includes('aborted')) {
        return {
          originalUrl: url,
          finalDestinationUrl: url,
          status: 'TEMPORARILY_UNAVAILABLE',
          error: 'Connection timed out',
          checkedAt,
        };
      }
      return {
        originalUrl: url,
        finalDestinationUrl: url,
        status: 'INVALID',
        error: message,
        checkedAt,
      };
    }
  }
}
