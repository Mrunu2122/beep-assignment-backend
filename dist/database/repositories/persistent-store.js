"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistentStore = exports.SupabaseIngestionStore = void 0;
exports.getSupabaseClient = getSupabaseClient;
const supabase_js_1 = require("@supabase/supabase-js");
const ws_1 = __importDefault(require("ws"));
const index_js_1 = require("../../config/index.js");
const logger_js_1 = require("../../monitoring/logger.js");
let supabaseInstance = null;
function getSupabaseClient() {
    if (supabaseInstance)
        return supabaseInstance;
    const url = index_js_1.config.supabase.url;
    const key = index_js_1.config.supabase.serviceRoleKey || index_js_1.config.supabase.anonKey;
    if (!url || !key) {
        logger_js_1.logger.warn('Supabase URL or Key missing.');
        return null;
    }
    supabaseInstance = (0, supabase_js_1.createClient)(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { transport: ws_1.default }
    });
    return supabaseInstance;
}
class SupabaseIngestionStore {
    /**
     * Fetch all active canonical jobs from Supabase
     */
    async getAllJobs() {
        const supabase = getSupabaseClient();
        if (!supabase)
            return [];
        const { data, error } = await supabase
            .from('public_jobs')
            .select('*')
            .order('posted_at', { ascending: false, nullsFirst: false });
        if (error) {
            logger_js_1.logger.error('Failed to query public_jobs:', { error: error.message });
            return [];
        }
        return data || [];
    }
    /**
     * Persist a batch of newly discovered/classified jobs non-destructively
     */
    async upsertJobs(jobs) {
        const supabase = getSupabaseClient();
        if (!supabase || jobs.length === 0)
            return { inserted: 0, skipped: 0 };
        let inserted = 0;
        let skipped = 0;
        for (const job of jobs) {
            try {
                const jobAny = job;
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
                        logger_js_1.logger.warn(`Could not insert canonical job ${job.slug}: ${insJobErr.message}`);
                    }
                    else if (newJob) {
                        jobId = newJob.id;
                        inserted++;
                    }
                }
                else {
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
            }
            catch (err) {
                logger_js_1.logger.error(`Error processing job ${job.slug}:`, { error: err?.message });
            }
        }
        return { inserted, skipped };
    }
    /**
     * Record pipeline run execution and cost in ingestion_runs table
     */
    async recordRun(summary) {
        const supabase = getSupabaseClient();
        if (!supabase)
            return;
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
                logger_js_1.logger.error('Failed to record ingestion run to Supabase:', { error: error.message });
            }
        }
        catch (err) {
            logger_js_1.logger.error('Exception recording run:', { error: err?.message });
        }
    }
    /**
     * Get recent runs
     */
    async getRuns(limit = 10) {
        const supabase = getSupabaseClient();
        if (!supabase)
            return [];
        const { data } = await supabase
            .from('ingestion_runs')
            .select('*')
            .order('run_date', { ascending: false })
            .limit(limit);
        return data || [];
    }
    async getLatestRun() {
        const runs = await this.getRuns(1);
        return runs[0] || null;
    }
}
exports.SupabaseIngestionStore = SupabaseIngestionStore;
exports.persistentStore = new SupabaseIngestionStore();
