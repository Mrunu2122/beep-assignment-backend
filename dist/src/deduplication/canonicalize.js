"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCanonicalHash = generateCanonicalHash;
exports.generateClusterId = generateClusterId;
const crypto_1 = __importDefault(require("crypto"));
const normalize_job_js_1 = require("../normalization/normalize-job.js");
function generateCanonicalHash(company, title, applyUrl) {
    const normCompany = (0, normalize_job_js_1.slugify)(company);
    const normTitle = (0, normalize_job_js_1.slugify)(title);
    const cleanedUrl = (0, normalize_job_js_1.cleanUrl)(applyUrl);
    let hostAndPath = '';
    try {
        const parsed = new URL(cleanedUrl);
        hostAndPath = `${parsed.hostname}${parsed.pathname}`;
    }
    catch {
        hostAndPath = cleanedUrl;
    }
    const rawKey = `${normCompany}::${normTitle}::${hostAndPath}`.toLowerCase();
    return crypto_1.default.createHash('sha256').update(rawKey).digest('hex').substring(0, 32);
}
function generateClusterId(company, title) {
    const normCompany = (0, normalize_job_js_1.slugify)(company);
    // Remove common noise words like 'trainee', 'intern', 'graduate' for clustering
    const baseTitle = (0, normalize_job_js_1.slugify)(title)
        .replace(/(intern|trainee|fresher|associate|junior|campus|batch-2024|batch-2025|batch-2026)/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    return crypto_1.default.createHash('sha256').update(`${normCompany}::${baseTitle}`).digest('hex').substring(0, 16);
}
