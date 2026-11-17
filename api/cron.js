"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maxDuration = void 0;
exports.default = handler;
const index_js_1 = require("../src/config/index.js");
const logger_js_1 = require("../src/monitoring/logger.js");
const base_js_1 = require("../src/ingestion/sources/base.js");
const greenhouse_js_1 = require("../src/ingestion/sources/greenhouse.js");
const lever_js_1 = require("../src/ingestion/sources/lever.js");
const orchestrator_js_1 = require("../src/ingestion/orchestrator.js");
const persistent_store_js_1 = require("../src/database/repositories/persistent-store.js");
const crypto_1 = __importDefault(require("crypto"));
// Register active live sources
base_js_1.sourceRegistry.register(new greenhouse_js_1.GreenhouseSourceAdapter());
base_js_1.sourceRegistry.register(new lever_js_1.LeverSourceAdapter());
const pipeline = new orchestrator_js_1.IngestionPipeline();
exports.maxDuration = 60; // Max duration for Vercel functions if supported by plan
async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    // Authorize request strictly via CRON_SECRET (never trust spoofable User-Agent header)
    const authHeader = req.headers['authorization'];
    const cronSecretHeader = req.headers['x-cron-secret'];
    const secret = cronSecretHeader || (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '');
    // Require matching CRON_SECRET in production. In development, allow testing if no secret configured.
    const isAuthorized = Boolean(index_js_1.config.cronSecret && secret && secret === index_js_1.config.cronSecret) || (process.env.NODE_ENV !== 'production' && !secret);
    if (!isAuthorized) {
        logger_js_1.logger.warn('Unauthorized cron execution attempt: missing or invalid authorization secret');
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing cron secret' });
    }
    const runId = crypto_1.default.randomUUID();
    const startedAt = new Date().toISOString();
    const startTimeMs = Date.now();
    logger_js_1.logger.info(`Starting serverless ingestion run: ${runId}`);
    try {
        const adapters = base_js_1.sourceRegistry.getAll();
        const sourceLevelResults = {};
        let totalFetched = 0;
        let totalDuplicates = 0;
        let totalInserted = 0;
        let totalCostUsd = 0;
        let totalInTokens = 0;
        let totalOutTokens = 0;
        // Fetch existing canonical jobs from Supabase to prevent duplicates
        const existingJobs = await persistent_store_js_1.persistentStore.getAllJobs();
        for (const adapter of adapters) {
            try {
                const raw = await adapter.fetchJobs();
                totalFetched += raw.length;
                // Deduplicate against existing jobs in Supabase
                const { uniqueJobsToProcess, duplicatesIdentified } = pipeline.deduplicateBatch(raw, existingJobs);
                totalDuplicates += duplicatesIdentified.length;
                // Bounded batch to respect Vercel function timeout (process up to 10 new per run)
                const batch = uniqueJobsToProcess.slice(0, 10);
                const canonicalToInsert = [];
                for (const item of batch) {
                    const { canonicalJob, costUsd, inTokens, outTokens } = await pipeline.processJob(item);
                    canonicalToInsert.push(canonicalJob);
                    totalCostUsd += costUsd;
                    totalInTokens += inTokens;
                    totalOutTokens += outTokens;
                }
                // Persist to Supabase
                const { inserted } = await persistent_store_js_1.persistentStore.upsertJobs(canonicalToInsert);
                totalInserted += inserted;
                sourceLevelResults[adapter.sourceId] = {
                    recordsFetched: raw.length,
                    recordsRejected: 0,
                    duplicatesFound: duplicatesIdentified.length,
                    canonicalInserted: inserted,
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
        // Record execution telemetry to Supabase ingestion_runs
        await persistent_store_js_1.persistentStore.recordRun(summary);
        return res.status(200).json({
            message: 'Ingestion pipeline execution completed successfully',
            summary,
        });
    }
    catch (err) {
        logger_js_1.logger.error('Unhandled cron exception', { error: String(err) });
        return res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
}
