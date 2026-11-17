import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { config } from '../../config/index.js';
import { logger } from '../../monitoring/logger.js';
import { CanonicalJob, IngestionRunSummary } from '@launchpad/shared';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = config.supabase.url;
  const key = config.supabase.serviceRoleKey || config.supabase.anonKey;

  if (!url || !key) {
    logger.warn('Supabase URL or Key missing.');
    return null;
  }

  supabaseInstance = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any }
  });

  return supabaseInstance;
}

export class SupabaseIngestionStore {
  /**
   * Fetch all active canonical jobs from Supabase
   */
  async getAllJobs(): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('public_jobs')
      .select('*')
      .order('posted_at', { ascending: false, nullsFirst: false });

    if (error) {
      logger.error('Failed to query public_jobs:', { error: error.message });
      return [];
    }
    return data || [];
  }

  /**
   * Persist a batch of newly discovered/classified jobs non-destructively
   */
  async upsertJobs(jobs: CanonicalJob[]): Promise<{ inserted: number; skipped: number }> {
    const supabase = getSupabaseClient();
    if (!supabase || jobs.length === 0) return { inserted: 0, skipped: 0 };

    let inserted = 0;
    let skipped = 0;

    for (const job of jobs) {
      try {
        const jobAny = job as any;
        // Step 1: Check if canonical job already exists by slug or canonical_fingerprint
        const { data: existingJob } = await supabase
          .from('jobs')
          .select('id')
          .or(`slug.eq.${job.slug},canonical_fingerprint.eq.${job.canonicalHash}`)
          .maybeSingle();

        let jobId = existingJob?.id;

        if (!jobId) {
          // Insert new canonical job
          const { data: newJob, error: insJobErr } = await supabase
            .from('jobs')
            .insert({
              slug: job.slug,
              title: job.title,
              company: job.company,
              company_slug: job.companySlug,
              description: job.description,
              description_snippet: job.descriptionSnippet || job.description?.slice(0, 150),
              standard_role: jobAny.standardRole || job.roleSubcategory || 'Engineering',
              role_category: job.roleCategory,
              role_subcategory: job.roleSubcategory,
              employment_type: job.employmentType,
              experience_level: job.experienceLevel,
              fresher_eligibility_status: job.fresherEligibilityStatus || 'Explicit fresher eligible',
              is_fresher_eligible: jobAny.isFresherEligible ?? job.isGenuinelyFresher ?? true,
              is_genuinely_fresher: job.isGenuinelyFresher ?? true,
              min_experience_years: jobAny.minExperienceYears || null,
              max_experience_years: jobAny.maxExperienceYears || null,
              target_graduation_years: jobAny.targetGraduationYears || [],
              required_skills: jobAny.requiredSkills || job.skills || [],
              responsibilities: job.responsibilities || [],
              qualifications: job.qualifications || [],
              raw_location: job.rawLocation || '',
              normalized_city: job.normalizedCity,
              normalized_state: job.normalizedState || null,
              country: job.country || 'India',
              work_mode: job.workMode || 'unspecified',
              primary_apply_url: job.applicationUrl || job.originalUrl,
              canonical_fingerprint: job.canonicalHash,
              is_duplicate: false,
              is_active: true,
              listing_status: 'ACTIVE',
              posted_at: job.postedAt || new Date().toISOString(),
              discovered_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (insJobErr) {
            logger.warn(`Could not insert canonical job ${job.slug}: ${insJobErr.message}`);
          } else if (newJob) {
            jobId = newJob.id;
            inserted++;
          }
        } else {
          skipped++;
        }

        // Step 2: Insert into job_sources if source posting does not exist
        if (jobId) {
          const sourceName = job.sourceName || job.sourceId || 'Greenhouse Public Board API';
          const sourceOriginalId = job.externalId || job.sourcePostingId || job.id;

          const { data: existingSource } = await supabase
            .from('job_sources')
            .select('id')
            .eq('source_name', sourceName)
            .eq('source_original_id', sourceOriginalId)
            .maybeSingle();

          if (!existingSource) {
            await supabase.from('job_sources').insert({
              job_id: jobId,
              source_name: sourceName,
              source_type: 'public_feed',
              source_original_id: sourceOriginalId,
              source_board_token: job.sourceBoardToken || job.companySlug,
              source_posting_id: sourceOriginalId,
              original_url: job.originalUrl || job.applicationUrl,
              apply_url: job.applicationUrl || job.originalUrl,
              final_destination_url: job.finalDestinationUrl || job.applicationUrl || job.originalUrl,
              application_url_status: 'VERIFIED',
              raw_title: job.title,
              raw_company: job.company,
              raw_location: job.rawLocation || '',
              raw_description: job.description,
              is_live_on_source: true,
              last_http_status: 200,
              discovered_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString()
            });
          }
        }
      } catch (err: any) {
        logger.error(`Error processing job ${job.slug}:`, { error: err?.message });
      }
    }

    return { inserted, skipped };
  }

  /**
   * Record pipeline run execution and cost in ingestion_runs table
   */
  async recordRun(summary: IngestionRunSummary): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { error } = await supabase.from('ingestion_runs').insert({
        status: summary.status,
        raw_discovered_count: summary.totalRecordsFetched,
        duplicates_detected: summary.totalDuplicatesIdentified,
        canonical_inserted: summary.totalCanonicalInsertedOrUpdated,
        llm_tokens_input: summary.llmTokensInput,
        llm_tokens_output: summary.llmTokensOutput,
        estimated_cost_usd: summary.estimatedCostUsd,
        duration_ms: summary.durationMs,
        error_summary: summary.sourceLevelResults ? JSON.stringify(summary.sourceLevelResults) : null
      });

      if (error) {
        logger.error('Failed to record ingestion run to Supabase:', { error: error.message });
      }
    } catch (err: any) {
      logger.error('Exception recording run:', { error: err?.message });
    }
  }

  /**
   * Get recent runs
   */
  async getRuns(limit = 10): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data } = await supabase
      .from('ingestion_runs')
      .select('*')
      .order('run_date', { ascending: false })
      .limit(limit);

    return data || [];
  }

  async getLatestRun(): Promise<any | null> {
    const runs = await this.getRuns(1);
    return runs[0] || null;
  }
}

export const persistentStore = new SupabaseIngestionStore();
