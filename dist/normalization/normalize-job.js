"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanUrl = cleanUrl;
exports.slugify = slugify;
exports.stripHtml = stripHtml;
exports.parseStipendOrSalary = parseStipendOrSalary;
function cleanUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        // Strip common tracking and marketing params
        const trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'ref', 'gh_jid', 'lever-source', 'ashby_source', 'trk', 'trackingId',
            'source', 'src', 'fbclid', 'gclid'
        ];
        for (const param of trackingParams) {
            parsed.searchParams.delete(param);
        }
        // Remove trailing slash for consistency
        let clean = parsed.toString();
        if (clean.endsWith('/') && parsed.pathname !== '/') {
            clean = clean.slice(0, -1);
        }
        return clean;
    }
    catch {
        return rawUrl.trim();
    }
}
function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function stripHtml(rawHtml) {
    return rawHtml
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}
function parseStipendOrSalary(rawText) {
    if (!rawText)
        return { currency: 'INR' };
    const text = rawText.toLowerCase();
    // LPA check (e.g. "6-8 LPA", "10 LPA")
    const lpaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(?:lpa|lakh|lac)/);
    if (lpaMatch) {
        const min = parseFloat(lpaMatch[1]);
        const max = lpaMatch[2] ? parseFloat(lpaMatch[2]) : min;
        return { min, max, currency: 'INR', period: 'lpa' };
    }
    // Monthly check (e.g. "₹25,000 - ₹35,000 / month", "20k/month")
    const kMatch = text.match(/(\d+)\s*k?\s*(?:-|to)?\s*(\d+)?\s*k?\s*(?:\/|\s*per\s*)?(?:month|pm)/);
    if (kMatch) {
        let min = parseInt(kMatch[1], 10);
        if (min < 100)
            min *= 1000;
        let max = kMatch[2] ? parseInt(kMatch[2], 10) : min;
        if (max < 100)
            max *= 1000;
        return { min, max, currency: 'INR', period: 'month' };
    }
    return { currency: 'INR' };
}
