"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LifecycleRevalidationEngine = void 0;
class LifecycleRevalidationEngine {
    /**
     * Revalidates an individual Greenhouse listing against its official board API
     */
    static async validateGreenhouseJob(boardToken, jobId, timeoutMs = 6000) {
        try {
            const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Launchpad-JobLifecycleBot/2.0 (+https://launchpad.careers/bot)' },
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (res.status === 200) {
                return { status: 'ACTIVE', reason: 'Official Greenhouse API confirms job is currently open', httpStatusCode: 200 };
            }
            if (res.status === 404) {
                return { status: 'EXPIRED', reason: 'Greenhouse API returned 404: The job you are looking for is no longer open', httpStatusCode: 404 };
            }
            if (res.status === 429) {
                return { status: 'SOURCE_UNAVAILABLE', reason: 'Greenhouse API rate limit exceeded (HTTP 429)', httpStatusCode: 429 };
            }
            return { status: 'UNVERIFIED', reason: `Unexpected Greenhouse API status: ${res.status}`, httpStatusCode: res.status };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('timeout') || msg.includes('aborted')) {
                return { status: 'SOURCE_UNAVAILABLE', reason: 'Greenhouse API request timed out' };
            }
            return { status: 'SOURCE_UNAVAILABLE', reason: `Greenhouse network error: ${msg}` };
        }
    }
    /**
     * Revalidates an individual Lever listing against its official Postings API
     */
    static async validateLeverJob(siteToken, postingId, timeoutMs = 6000) {
        try {
            const url = `https://api.lever.co/v0/postings/${encodeURIComponent(siteToken)}/${encodeURIComponent(postingId)}`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Launchpad-JobLifecycleBot/2.0 (+https://launchpad.careers/bot)' },
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (res.status === 200) {
                return { status: 'ACTIVE', reason: 'Official Lever API confirms posting is currently open', httpStatusCode: 200 };
            }
            if (res.status === 404) {
                return { status: 'REMOVED', reason: 'Lever API returned 404: Posting has been removed or closed', httpStatusCode: 404 };
            }
            if (res.status === 429) {
                return { status: 'SOURCE_UNAVAILABLE', reason: 'Lever API rate limit reached (HTTP 429)', httpStatusCode: 429 };
            }
            return { status: 'UNVERIFIED', reason: `Unexpected Lever API status: ${res.status}`, httpStatusCode: res.status };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('timeout') || msg.includes('aborted')) {
                return { status: 'SOURCE_UNAVAILABLE', reason: 'Lever API request timed out' };
            }
            return { status: 'SOURCE_UNAVAILABLE', reason: `Lever network error: ${msg}` };
        }
    }
    /**
     * Universal revalidation parser for any stored job
     */
    static async revalidateStoredJob(job) {
        const checkedAt = new Date().toISOString();
        const prev = job.listingStatus || 'ACTIVE';
        const url = job.applyUrl;
        // Detect Greenhouse
        const ghMatch = url.match(/job-boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i) ||
            url.match(/boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i);
        if (ghMatch) {
            const board = ghMatch[1];
            const jobId = ghMatch[2];
            const res = await this.validateGreenhouseJob(board, jobId);
            return {
                jobId: job.id,
                sourcePostingId: jobId,
                sourceBoardToken: board,
                sourceType: 'greenhouse',
                previousStatus: prev,
                newStatus: res.status,
                reason: res.reason,
                checkedAt,
                httpStatusCode: res.httpStatusCode,
            };
        }
        // Detect Lever
        const leverMatch = url.match(/jobs\.lever\.co\/([^/]+)\/([a-f0-9-]+)/i);
        if (leverMatch) {
            const site = leverMatch[1];
            const postingId = leverMatch[2];
            const res = await this.validateLeverJob(site, postingId);
            return {
                jobId: job.id,
                sourcePostingId: postingId,
                sourceBoardToken: site,
                sourceType: 'lever',
                previousStatus: prev,
                newStatus: res.status,
                reason: res.reason,
                checkedAt,
                httpStatusCode: res.httpStatusCode,
            };
        }
        // Default for direct enterprise ATS (Workday, Oracle, etc.)
        return {
            jobId: job.id,
            sourceType: 'other',
            previousStatus: prev,
            newStatus: prev,
            reason: 'Authoritative ATS listing preserved',
            checkedAt,
        };
    }
}
exports.LifecycleRevalidationEngine = LifecycleRevalidationEngine;
