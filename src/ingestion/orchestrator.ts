import { RawJobInput, CanonicalJob } from '@launchpad/shared';
import { cleanUrl, slugify, parseStipendOrSalary } from '../normalization/normalize-job.js';
import { generateCanonicalHash, generateClusterId } from '../deduplication/canonicalize.js';
import { areJobsFuzzyDuplicates } from '../deduplication/fuzzy-match.js';
import { areLocationsCompatible, normalizeCompanyName } from '../deduplication/exact-match.js';
import { ProductionJobClassifier } from '../ai/classifier.js';
import crypto from 'crypto';

export class IngestionPipeline {
  private classifier: ProductionJobClassifier;

  constructor() {
    this.classifier = new ProductionJobClassifier();
  }

  deduplicateBatch(
    rawJobs: RawJobInput[],
    existingCanonicalJobs: CanonicalJob[]
  ): {
    uniqueJobsToProcess: Array<{ raw: RawJobInput; canonicalHash: string; clusterId: string }>;
    duplicatesIdentified: Array<{ raw: RawJobInput; matchedCanonicalId: string; reason: string }>;
  } {
    const uniqueJobsToProcess: Array<{ raw: RawJobInput; canonicalHash: string; clusterId: string }> = [];
    const duplicatesIdentified: Array<{ raw: RawJobInput; matchedCanonicalId: string; reason: string }> = [];

    const hashIndex = new Map<string, CanonicalJob>();
    for (const job of existingCanonicalJobs) {
      hashIndex.set(job.canonicalHash, job);
    }

    for (const raw of rawJobs) {
      const canonicalHash = generateCanonicalHash(raw.company, raw.title, raw.applicationUrl);
      const clusterId = generateClusterId(raw.company, raw.title);

      const exactMatch = hashIndex.get(canonicalHash);
      if (exactMatch) {
        duplicatesIdentified.push({
          raw,
          matchedCanonicalId: exactMatch.id,
          reason: 'Exact canonical hash match (same company, title, and cleaned URL)',
        });
        continue;
      }

      const normCompany = normalizeCompanyName(raw.company);
      let fuzzyMatchFound: CanonicalJob | null = null;
      let matchReason = '';

      for (const canonical of existingCanonicalJobs) {
        if (normalizeCompanyName(canonical.company) !== normCompany) {
          continue;
        }

        if (!areLocationsCompatible(raw.rawLocation || '', canonical.rawLocation || '')) {
          continue;
        }

        const fuzzyCheck = areJobsFuzzyDuplicates(
          raw.title,
          raw.descriptionRaw.slice(0, 300),
          canonical.title,
          canonical.description.slice(0, 300),
          0.65
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

  async processJob(
    item: { raw: RawJobInput; canonicalHash: string; clusterId: string }
  ): Promise<{ canonicalJob: CanonicalJob; costUsd: number; inTokens: number; outTokens: number }> {
    const { raw, canonicalHash, clusterId } = item;

    const { result, telemetry } = await this.classifier.classify(
      raw.title,
      raw.company,
      raw.rawLocation || '',
      raw.descriptionRaw
    );

    const salary = parseStipendOrSalary(raw.salaryRaw);
    const jobId = crypto.randomUUID();
    const companySlug = slugify(raw.company);
    const slug = `${companySlug}-${slugify(raw.title)}-${jobId.substring(0, 8)}`;

    const canonicalJob: CanonicalJob = {
      id: jobId,
      sourceId: raw.sourceId,
      sourceName: raw.sourceId === 'curated_public_ats_index' ? 'Public ATS Index' : 'Company ATS Feed',
      externalId: raw.externalId,
      originalUrl: cleanUrl(raw.originalUrl),
      applicationUrl: cleanUrl(raw.applicationUrl),
      finalDestinationUrl: cleanUrl(raw.applicationUrl),
      listingStatus: 'ACTIVE',
      sourceLastVerifiedAt: new Date().toISOString(),
      lastSuccessfulSourceCheck: new Date().toISOString(),
      consecutiveMissingChecks: 0,
      firstMissingAt: null,
      expiredAt: null,
      statusReason: 'Initial ingestion from verified ATS source',
      sourcePostingId: raw.sourcePostingId || raw.externalId,
      sourceBoardToken: raw.sourceBoardToken || null,
      applicationUrlStatus: 'VERIFIED',
      title: raw.title,
      company: raw.company,
      companySlug,
      description: raw.descriptionRaw,
      descriptionSnippet: raw.descriptionRaw.slice(0, 200) + '...',
      responsibilities: raw.responsibilitiesRaw || ['Collaborate with engineering teams to ship production-ready services.'],
      qualifications: raw.qualificationsRaw || ['Bachelor\'s degree in Computer Science, Engineering, or equivalent experience.'],
      aiSummary: result.aiSummary,
      rawLocation: raw.rawLocation || '',
      normalizedCity: result.normalizedCity,
      normalizedState: result.normalizedState,
      country: result.country,
      workMode: raw.rawLocation?.toLowerCase().includes('remote') ? 'remote' : 'onsite',
      employmentType: result.employmentType,
      experienceLevel: result.experienceLevel,
      fresherEligibilityStatus: result.fresherEligibilityStatus,
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

    return {
      canonicalJob,
      costUsd: telemetry.estimatedCostUsd,
      inTokens: telemetry.inputTokens,
      outTokens: telemetry.outputTokens,
    };
  }
}
