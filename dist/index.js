"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = void 0;
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
const index_js_1 = require("./config/index.js");
const logger_js_1 = require("./monitoring/logger.js");
const base_js_1 = require("./ingestion/sources/base.js");
const greenhouse_js_1 = require("./ingestion/sources/greenhouse.js");
const lever_js_1 = require("./ingestion/sources/lever.js");
const curated_index_js_1 = require("./ingestion/sources/curated-index.js");
const orchestrator_js_1 = require("./ingestion/orchestrator.js");
const job_repository_js_1 = require("./database/repositories/job-repository.js");
const shared_1 = require("@launchpad/shared");
const crypto_1 = __importDefault(require("crypto"));
// Register public adapters
base_js_1.sourceRegistry.register(new greenhouse_js_1.GreenhouseSourceAdapter());
base_js_1.sourceRegistry.register(new lever_js_1.LeverSourceAdapter());
base_js_1.sourceRegistry.register(new curated_index_js_1.CuratedFresherIndexAdapter());
const pipeline = new orchestrator_js_1.IngestionPipeline();
// Helper to send JSON responses
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-secret',
    });
    res.end(JSON.stringify(data));
}
const server = http_1.default.createServer(async (req, res) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-secret',
        });
        res.end();
        return;
    }
    const reqUrl = new url_1.URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;
    const method = req.method;
    try {
        // 1. GET /api/jobs
        if (method === 'GET' && pathname === '/api/jobs') {
            const searchParams = Object.fromEntries(reqUrl.searchParams.entries());
            const queryValidation = shared_1.JobListQuerySchema.safeParse(searchParams);
            if (!queryValidation.success) {
                return sendJson(res, 400, {
                    error: 'Invalid query parameters',
                    details: queryValidation.error.errors,
                });
            }
            const q = queryValidation.data;
            let allJobs = job_repository_js_1.ingestionStore.getAllJobs();
            // Search & Filters
            if (q.q) {
                const queryTerm = q.q.toLowerCase();
                allJobs = allJobs.filter(j => j.title.toLowerCase().includes(queryTerm) ||
                    j.company.toLowerCase().includes(queryTerm) ||
                    j.skills.some(s => s.toLowerCase().includes(queryTerm)));
            }
            if (q.roleCategory) {
                allJobs = allJobs.filter(j => j.roleCategory === q.roleCategory);
            }
            if (q.city) {
                allJobs = allJobs.filter(j => j.normalizedCity.toLowerCase() === q.city.toLowerCase());
            }
            if (q.employmentType) {
                allJobs = allJobs.filter(j => j.employmentType === q.employmentType);
            }
            if (q.experienceLevel) {
                allJobs = allJobs.filter(j => j.experienceLevel === q.experienceLevel);
            }
            if (q.fresherOnly) {
                allJobs = allJobs.filter(j => j.isGenuinelyFresher);
            }
            // Sorting
            if (q.sortBy === 'newest') {
                allJobs.sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime());
            }
            else if (q.sortBy === 'confidence') {
                allJobs.sort((a, b) => b.classificationConfidence - a.classificationConfidence);
            }
            else if (q.sortBy === 'company') {
                allJobs.sort((a, b) => a.company.localeCompare(b.company));
            }
            const total = allJobs.length;
            const startIndex = (q.page - 1) * q.limit;
            const paginatedJobs = allJobs.slice(startIndex, startIndex + q.limit);
            return sendJson(res, 200, {
                data: paginatedJobs,
                pagination: {
                    page: q.page,
                    limit: q.limit,
                    total,
                    totalPages: Math.ceil(total / q.limit),
                },
            });
        }
        // 2. GET /api/jobs/:id
        if (method === 'GET' && pathname.startsWith('/api/jobs/')) {
            const idOrSlug = pathname.replace('/api/jobs/', '');
            const job = job_repository_js_1.ingestionStore.getJobById(idOrSlug) || job_repository_js_1.ingestionStore.getJobBySlug(idOrSlug);
            if (!job) {
                return sendJson(res, 404, { error: 'Job opportunity not found' });
            }
            return sendJson(res, 200, { data: job });
        }
        // 3. GET /api/sources
        if (method === 'GET' && pathname === '/api/sources') {
            return sendJson(res, 200, { data: base_js_1.sourceRegistry.listMetadata() });
        }
        // 4. GET /api/analytics
        if (method === 'GET' && pathname === '/api/analytics') {
            const jobs = job_repository_js_1.ingestionStore.getAllJobs();
            const uniqueCompanies = new Set(jobs.map(j => j.company)).size;
            const uniqueCities = new Set(jobs.map(j => j.normalizedCity)).size;
            const freshCount = jobs.filter(j => j.isGenuinelyFresher).length;
            // Source distribution
            const sourceMap = {};
            for (const j of jobs) {
                sourceMap[j.sourceId] = (sourceMap[j.sourceId] || 0) + 1;
            }
            const sourceDistribution = Object.entries(sourceMap).map(([source, count]) => ({
                source,
                count,
                percentage: Number(((count / jobs.length) * 100).toFixed(1)),
            }));
            // City distribution
            const cityMap = {};
            for (const j of jobs) {
                cityMap[j.normalizedCity] = (cityMap[j.normalizedCity] || 0) + 1;
            }
            const cityDistribution = Object.entries(cityMap).map(([city, count]) => ({
                city,
                count,
                percentage: Number(((count / jobs.length) * 100).toFixed(1)),
            }));
            return sendJson(res, 200, {
                totalActiveOpportunities: jobs.length,
                freshOpportunitiesCount: freshCount,
                uniqueCompaniesCount: uniqueCompanies,
                citiesCoveredCount: uniqueCities,
                sourceDistribution,
                cityDistribution,
                latestRun: job_repository_js_1.ingestionStore.getLatestRun() || null,
            });
        }
        // 5. GET /api/ingestion/status
        if (method === 'GET' && pathname === '/api/ingestion/status') {
            return sendJson(res, 200, {
                latestRun: job_repository_js_1.ingestionStore.getLatestRun() || null,
                recentRuns: job_repository_js_1.ingestionStore.getRuns(),
            });
        }
        // 6. POST /api/cron/ingest (Protected by CRON_SECRET or Admin Token)
        if (method === 'POST' && pathname === '/api/cron/ingest') {
            const authHeader = req.headers['authorization'];
            const cronSecretHeader = req.headers['x-cron-secret'];
            const secret = cronSecretHeader || (authHeader ? authHeader.replace('Bearer ', '') : '');
            if (secret !== index_js_1.config.cronSecret && process.env.NODE_ENV === 'production') {
                return sendJson(res, 401, { error: 'Unauthorized: Invalid cron or admin secret' });
            }
            const runId = crypto_1.default.randomUUID();
            const startedAt = new Date().toISOString();
            const startTimeMs = Date.now();
            logger_js_1.logger.info(`Starting pipeline ingestion run: ${runId}`);
            const adapters = base_js_1.sourceRegistry.getAll();
            const sourceLevelResults = {};
            let totalFetched = 0;
            let totalDuplicates = 0;
            let totalInserted = 0;
            let totalCostUsd = 0;
            let totalInTokens = 0;
            let totalOutTokens = 0;
            for (const adapter of adapters) {
                try {
                    const raw = await adapter.fetchJobs();
                    totalFetched += raw.length;
                    const existingJobs = job_repository_js_1.ingestionStore.getAllJobs();
                    const { uniqueJobsToProcess, duplicatesIdentified } = pipeline.deduplicateBatch(raw, existingJobs);
                    totalDuplicates += duplicatesIdentified.length;
                    // Limit batch processing for serverless bounds (e.g. process up to 10 per source run to respect latency limits)
                    const boundedBatch = uniqueJobsToProcess.slice(0, 10);
                    let insertedForSource = 0;
                    for (const item of boundedBatch) {
                        const { canonicalJob, costUsd, inTokens, outTokens } = await pipeline.processJob(item);
                        job_repository_js_1.ingestionStore.upsertJob(canonicalJob);
                        insertedForSource++;
                        totalCostUsd += costUsd;
                        totalInTokens += inTokens;
                        totalOutTokens += outTokens;
                    }
                    totalInserted += insertedForSource;
                    sourceLevelResults[adapter.sourceId] = {
                        recordsFetched: raw.length,
                        recordsRejected: 0,
                        duplicatesFound: duplicatesIdentified.length,
                        canonicalInserted: insertedForSource,
                    };
                }
                catch (err) {
                    logger_js_1.logger.error(`Adapter failed: ${adapter.sourceId}`, { error: String(err) });
                    sourceLevelResults[adapter.sourceId] = {
                        recordsFetched: 0,
                        recordsRejected: 0,
                        duplicatesFound: 0,
                        canonicalInserted: 0,
                        error: err instanceof Error ? err.message : String(err),
                    };
                }
            }
            const summary = {
                runId,
                startedAt,
                completedAt: new Date().toISOString(),
                status: 'completed',
                sourceLevelResults,
                totalRecordsFetched: totalFetched,
                totalRecordsRejected: 0,
                totalDuplicatesIdentified: totalDuplicates,
                totalCanonicalInsertedOrUpdated: totalInserted,
                aiClassificationSuccesses: totalInserted,
                aiClassificationFailures: 0,
                llmTokensInput: totalInTokens,
                llmTokensOutput: totalOutTokens,
                estimatedCostUsd: Number(totalCostUsd.toFixed(6)),
                durationMs: Date.now() - startTimeMs,
            };
            job_repository_js_1.ingestionStore.recordRun(summary);
            return sendJson(res, 200, {
                message: 'Ingestion pipeline execution completed',
                summary,
            });
        }
        // Default 404
        return sendJson(res, 404, { error: 'Route not found' });
    }
    catch (err) {
        logger_js_1.logger.error('Unhandled API exception', { error: String(err) });
        return sendJson(res, 500, { error: 'Internal Server Error' });
    }
});
exports.server = server;
const PORT = index_js_1.config.port;
server.listen(PORT, () => {
    logger_js_1.logger.info(`Project Launchpad Backend API running on port ${PORT}`);
});
