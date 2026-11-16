import http from 'http';
import { URL } from 'url';
import { config } from './config/index.js';
import { logger } from './monitoring/logger.js';
import { sourceRegistry } from './ingestion/sources/base.js';
import { GreenhouseSourceAdapter } from './ingestion/sources/greenhouse.js';
import { LeverSourceAdapter } from './ingestion/sources/lever.js';
import { CuratedFresherIndexAdapter } from './ingestion/sources/curated-index.js';
import { IngestionPipeline } from './ingestion/orchestrator.js';
import { ingestionStore } from './database/repositories/job-repository.js';
import { JobListQuerySchema, IngestionRunSummary } from '@launchpad/shared';
import crypto from 'crypto';

sourceRegistry.register(new GreenhouseSourceAdapter());
sourceRegistry.register(new LeverSourceAdapter());
sourceRegistry.register(new CuratedFresherIndexAdapter());

const pipeline = new IngestionPipeline();

function sendJson(res: http.ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-secret',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-cron-secret',
    });
    res.end();
    return;
  }

  const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const method = req.method;

  try {
    if (method === 'GET' && pathname === '/api/jobs') {
      const searchParams = Object.fromEntries(reqUrl.searchParams.entries());
      const queryValidation = JobListQuerySchema.safeParse(searchParams);

      if (!queryValidation.success) {
        return sendJson(res, 400, {
          error: 'Invalid query parameters',
          details: queryValidation.error.errors,
        });
      }

      const q = queryValidation.data;
      let allJobs = ingestionStore.getAllJobs();

      if (q.q) {
        const queryTerm = q.q.toLowerCase();
        allJobs = allJobs.filter(j =>
          j.title.toLowerCase().includes(queryTerm) ||
          j.company.toLowerCase().includes(queryTerm) ||
          j.skills.some(s => s.toLowerCase().includes(queryTerm))
        );
      }
      if (q.roleCategory && q.roleCategory !== 'All') {
        allJobs = allJobs.filter(j => j.roleCategory === q.roleCategory);
      }
      if (q.city && q.city !== 'All') {
        allJobs = allJobs.filter(j => j.normalizedCity.toLowerCase() === q.city!.toLowerCase());
      }
      if (q.employmentType && q.employmentType !== 'All') {
        allJobs = allJobs.filter(j => j.employmentType === q.employmentType);
      }
      if (q.workMode && q.workMode !== 'All') {
        allJobs = allJobs.filter(j => j.workMode === q.workMode);
      }
      if (q.fresherOnly) {
        allJobs = allJobs.filter(j => j.isGenuinelyFresher);
      }

      if (q.sortBy === 'newest') {
        allJobs.sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime());
      } else if (q.sortBy === 'confidence') {
        allJobs.sort((a, b) => b.classificationConfidence - a.classificationConfidence);
      } else if (q.sortBy === 'company') {
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

    if (method === 'GET' && pathname.startsWith('/api/jobs/')) {
      const idOrSlug = pathname.replace('/api/jobs/', '');
      const job = ingestionStore.getJobById(idOrSlug) || ingestionStore.getJobBySlug(idOrSlug);
      if (!job) {
        return sendJson(res, 404, { error: 'Job opportunity not found' });
      }
      return sendJson(res, 200, { data: job });
    }

    if (method === 'GET' && pathname === '/api/sources') {
      return sendJson(res, 200, { data: sourceRegistry.listMetadata() });
    }

    if (method === 'GET' && pathname === '/api/analytics') {
      const jobs = ingestionStore.getAllJobs();
      const uniqueCompanies = new Set(jobs.map(j => j.company)).size;
      const uniqueCities = new Set(jobs.map(j => j.normalizedCity)).size;
      const freshCount = jobs.filter(j => j.isGenuinelyFresher).length;

      const sourceMap: Record<string, number> = {};
      for (const j of jobs) {
        sourceMap[j.sourceId] = (sourceMap[j.sourceId] || 0) + 1;
      }
      const sourceDistribution = Object.entries(sourceMap).map(([source, count]) => ({
        source,
        count,
        percentage: Number(((count / jobs.length) * 100).toFixed(1)),
      }));

      const cityMap: Record<string, number> = {};
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
        latestRun: ingestionStore.getLatestRun() || null,
      });
    }

    if (method === 'GET' && pathname === '/api/ingestion/status') {
      return sendJson(res, 200, {
        latestRun: ingestionStore.getLatestRun() || null,
        recentRuns: ingestionStore.getRuns(),
      });
    }

    if (method === 'POST' && pathname === '/api/cron/ingest') {
      const authHeader = req.headers['authorization'];
      const cronSecretHeader = req.headers['x-cron-secret'];
      const secret = cronSecretHeader || (authHeader ? authHeader.replace('Bearer ', '') : '');

      if (secret !== config.cronSecret && process.env.NODE_ENV === 'production') {
        return sendJson(res, 401, { error: 'Unauthorized: Invalid cron or admin secret' });
      }

      const runId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const startTimeMs = Date.now();

      logger.info(`Starting pipeline ingestion run: ${runId}`);

      const adapters = sourceRegistry.getAll();
      const sourceLevelResults: IngestionRunSummary['sourceLevelResults'] = {};
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

          const existingJobs = ingestionStore.getAllJobs();
          const { uniqueJobsToProcess, duplicatesIdentified } = pipeline.deduplicateBatch(raw, existingJobs);

          totalDuplicates += duplicatesIdentified.length;

          const boundedBatch = uniqueJobsToProcess.slice(0, 10);

          let insertedForSource = 0;
          for (const item of boundedBatch) {
            const { canonicalJob, costUsd, inTokens, outTokens } = await pipeline.processJob(item);
            ingestionStore.upsertJob(canonicalJob);
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
        } catch (err: unknown) {
          logger.error(`Adapter failed: ${adapter.sourceId}`, { error: String(err) });
          sourceLevelResults[adapter.sourceId] = {
            recordsFetched: 0,
            recordsRejected: 0,
            duplicatesFound: 0,
            canonicalInserted: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      const summary: IngestionRunSummary = {
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

      ingestionStore.recordRun(summary);

      return sendJson(res, 200, {
        message: 'Ingestion pipeline execution completed',
        summary,
      });
    }

    return sendJson(res, 404, { error: 'Route not found' });
  } catch (err: unknown) {
    logger.error('Unhandled API exception', { error: String(err) });
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
});

const PORT = config.port;
server.listen(PORT, () => {
  logger.info(`Project Launchpad Backend API running on port ${PORT}`);
});

export { server };
