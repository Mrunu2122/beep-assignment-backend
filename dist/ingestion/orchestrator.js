"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionPipeline = void 0;
const normalize_job_js_1 = require("../normalization/normalize-job.js");
const canonicalize_js_1 = require("../deduplication/canonicalize.js");
const fuzzy_match_js_1 = require("../deduplication/fuzzy-match.js");
const exact_match_js_1 = require("../deduplication/exact-match.js");
const classifier_js_1 = require("../ai/classifier.js");
const crypto_1 = __importDefault(require("crypto"));
class IngestionPipeline {
    classifier;
    constructor() {
        this.classifier = new classifier_js_1.ProductionJobClassifier();
    }
    /**
     * Deduplicates an incoming batch against existing canonical opportunities
     */
    deduplicateBatch(rawJobs, existingCanonicalJobs) {
        const uniqueJobsToProcess = [];
        const duplicatesIdentified = [];
        // Map of canonicalHash -> CanonicalJob
        const hashIndex = new Map();
        for (const job of existingCanonicalJobs) {
            hashIndex.set(job.canonicalHash, job);
        }
        for (const raw of rawJobs) {
            const canonicalHash = (0, canonicalize_js_1.generateCanonicalHash)(raw.company, raw.title, raw.applicationUrl);
            const clusterId = (0, canonicalize_js_1.generateClusterId)(raw.company, raw.title);
            // Layer A: Exact match on Hash
            const exactMatch = hashIndex.get(canonicalHash);
            if (exactMatch) {
                duplicatesIdentified.push({
                    raw,
                    matchedCanonicalId: exactMatch.id,
                    reason: 'Exact canonical hash match (same company, title, and cleaned URL)',
                });
                continue;
            }
            // Layer B: Fuzzy deduplication within the same company partition
            const normCompany = (0, exact_match_js_1.normalizeCompanyName)(raw.company);
            let fuzzyMatchFound = null;
            let matchReason = '';
            for (const canonical of existingCanonicalJobs) {
                if ((0, exact_match_js_1.normalizeCompanyName)(canonical.company) !== normCompany) {
                    // Guardrail: NEVER merge jobs from different companies
                    continue;
                }
                // Check location compatibility
                if (!(0, exact_match_js_1.areLocationsCompatible)(raw.rawLocation || '', canonical.rawLocation || '')) {
                    continue;
                }
                const fuzzyCheck = (0, fuzzy_match_js_1.areJobsFuzzyDuplicates)(raw.title, raw.descriptionRaw.slice(0, 300), canonical.title, canonical.description.slice(0, 300), 0.85);
                if (fuzzyCheck.isDuplicate) {
                    fuzzyMatchFound = canonical;
                    matchReason = `Fuzzy match on title and description (score: ${(fuzzyCheck.score * 100).toFixed(1)}%)`;
                    break;
                }
            }
            if (fuzzyMatchFound) {
                duplicatesIdentified.push({
                    raw,
                    matchedCanonicalId: fuzzyMatchFound.id,
                    reason: matchReason,
                });
            }
            else {
                uniqueJobsToProcess.push({ raw, canonicalHash, clusterId });
            }
        }
        return { uniqueJobsToProcess, duplicatesIdentified };
    }
    /**
     * Processes a validated unique job through classification and creates a CanonicalJob
     */
    async processJob(item) {
        const { raw, canonicalHash, clusterId } = item;
        // AI Classification
        const { result, telemetry } = await this.classifier.classify(raw.title, raw.company, raw.rawLocation || '', raw.descriptionRaw);
        const salary = (0, normalize_job_js_1.parseStipendOrSalary)(raw.salaryRaw);
        const jobId = crypto_1.default.randomUUID();
        const slug = `${(0, normalize_job_js_1.slugify)(raw.company)}-${(0, normalize_job_js_1.slugify)(raw.title)}-${jobId.substring(0, 8)}`;
        const canonicalJob = {
            id: jobId,
            sourceId: raw.sourceId,
            externalId: raw.externalId,
            originalUrl: (0, normalize_job_js_1.cleanUrl)(raw.originalUrl),
            applicationUrl: (0, normalize_job_js_1.cleanUrl)(raw.applicationUrl),
            title: raw.title,
            company: raw.company,
            description: raw.descriptionRaw,
            rawLocation: raw.rawLocation || '',
            normalizedCity: result.normalizedCity,
            normalizedState: result.normalizedState,
            country: result.country,
            employmentType: result.employmentType,
            experienceLevel: result.experienceLevel,
            isGenuinelyFresher: result.isGenuinelyFresher,
            roleCategory: result.roleCategory,
            roleSubcategory: result.roleSubcategory,
            skills: result.skills,
            salaryInformation: {
                min: salary.min,
                max: salary.max,
                currency: salary.currency,
                period: salary.period,
                raw: raw.salaryRaw,
            },
            postedAt: raw.postedAtRaw,
            discoveredAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            status: 'active',
            classificationConfidence: result.confidenceScore,
            classificationModel: telemetry.modelName,
            classificationPromptVersion: telemetry.promptVersion,
            canonicalHash,
            isDuplicate: false,
            canonicalJobId: null,
            duplicateClusterId: clusterId,
            duplicateReason: null,
            slug,
        };
        const sourceRecord = {
            id: crypto_1.default.randomUUID(),
            canonicalJobId: jobId,
            sourceId: raw.sourceId,
            externalId: raw.externalId,
            originalUrl: raw.originalUrl,
            applicationUrl: raw.applicationUrl,
            rawPayload: raw,
            fetchedAt: new Date().toISOString(),
        };
        return {
            canonicalJob,
            sourceRecord,
            costUsd: telemetry.estimatedCostUsd,
            inTokens: telemetry.inputTokens,
            outTokens: telemetry.outputTokens,
        };
    }
}
exports.IngestionPipeline = IngestionPipeline;
