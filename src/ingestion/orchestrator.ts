import { RawJobInput, CanonicalJob, JobSourceRecord } from '@launchpad/shared';
import { cleanUrl, slugify, parseStipendOrSalary } from '../normalization/normalize-job.js';
import { generateCanonicalHash, generateClusterId } from '../deduplication/canonicalize.js';
import { areJobsFuzzyDuplicates } from '../deduplication/fuzzy-match.js';
import { areLocationsCompatible, normalizeCompanyName } from '../deduplication/exact-match.js';
import { ProductionJobClassifier } from '../ai/classifier.js';
import { logger } from '../monitoring/logger.js';
import crypto from 'crypto';

export class IngestionPipeline {
  private classifier: ProductionJobClassifier;

  constructor() {
    this.classifier = new ProductionJobClassifier();
  }

  /**
   * Deduplicates an incoming batch against existing canonical opportunities
   */
  deduplicateBatch(
    rawJobs: RawJobInput[],
    existingCanonicalJobs: CanonicalJob[]
  ): {
    uniqueJobsToProcess: Array<{ raw: RawJobInput; canonicalHash: string; clusterId: string }>;
    duplicatesIdentified: Array<{ raw: RawJobInput; matchedCanonicalId: string; reason: string }>;
  } {
    const uniqueJobsToProcess: Array<{ raw: RawJobInput; canonicalHash: string; clusterId: string }> = [];
    const duplicatesIdentified: Array<{ raw: RawJobInput; matchedCanonicalId: string; reason: string }> = [];

    // Map of canonicalHash -> CanonicalJob
    const hashIndex = new Map<string, CanonicalJob>();
    for (const job of existingCanonicalJobs) {
      hashIndex.set(job.canonicalHash, job);
    }

    for (const raw of rawJobs) {
      const canonicalHash = generateCanonicalHash(raw.company, raw.title, raw.applicationUrl);
      const clusterId = generateClusterId(raw.company, raw.title);

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
      const normCompany = normalizeCompanyName(raw.company);
      let fuzzyMatchFound: CanonicalJob | null = null;
      let matchReason = '';

      for (const canonical of existingCanonicalJobs) {
        if (normalizeCompanyName(canonical.company) !== normCompany) {
          // Guardrail: NEVER merge jobs from different companies
          continue;
        }

        // Check location compatibility
        if (!areLocationsCompatible(raw.rawLocation || '', canonical.rawLocation || '')) {
          continue;
        }

        const fuzzyCheck = areJobsFuzzyDuplicates(
          raw.title,
          raw.descriptionRaw.slice(0, 300),
          canonical.title,
          canonical.description.slice(0, 300),
          0.85
        );

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
      } else {
        uniqueJobsToProcess.push({ raw, canonicalHash, clusterId });
      }
    }

    return { uniqueJobsToProcess, duplicatesIdentified };
  }

  /**
   * Processes a validated unique job through classification and creates a CanonicalJob
   */
  async processJob(
    item: { raw: RawJobInput; canonicalHash: string; clusterId: string }
  ): Promise<{ canonicalJob: CanonicalJob; sourceRecord: JobSourceRecord; costUsd: number; inTokens: number; outTokens: number }> {
    const { raw, canonicalHash, clusterId } = item;

    // AI Classification
    const { result, telemetry } = await this.classifier.classify(
      raw.title,
      raw.company,
      raw.rawLocation || '',
      raw.descriptionRaw
    );

    const salary = parseStipendOrSalary(raw.salaryRaw);
    const jobId = crypto.randomUUID();
    const slug = `${slugify(raw.company)}-${slugify(raw.title)}-${jobId.substring(0, 8)}`;

    const canonicalJob: CanonicalJob = {
      id: jobId,
      sourceId: raw.sourceId,
      externalId: raw.externalId,
      originalUrl: cleanUrl(raw.originalUrl),
      applicationUrl: cleanUrl(raw.applicationUrl),
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

    const sourceRecord: JobSourceRecord = {
      id: crypto.randomUUID(),
      canonicalJobId: jobId,
      sourceId: raw.sourceId,
      externalId: raw.externalId,
      originalUrl: raw.originalUrl,
      applicationUrl: raw.applicationUrl,
      rawPayload: raw as unknown as Record<string, unknown>,
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
