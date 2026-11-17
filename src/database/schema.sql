-- =============================================================================
-- Project Launchpad - Production Normalized Multi-Source Relational Schema
-- Version: 5.1.0 (Hardened Security, Nullable Descriptions, Zero Data Leaks)
-- Target: Supabase PostgreSQL
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- -----------------------------------------------------------------------------
-- 1. Table: jobs (Canonical Opportunities - BASE STORAGE TABLE)
-- Direct access to this table is RESTRICTED to service_role.
-- Public clients query the secure public_jobs view instead.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Routing & Identification
    slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    company_slug VARCHAR(255) NOT NULL,
    
    -- Content & Display (Description is nullable so unknown descriptions are preserved as NULL)
    description TEXT,
    description_snippet VARCHAR(500),
    
    -- Standardized Classification
    standard_role VARCHAR(100) NOT NULL DEFAULT 'Software Engineering',
    role_category VARCHAR(100) DEFAULT 'Software Engineering',
    role_subcategory VARCHAR(100),
    employment_type VARCHAR(30) CHECK (employment_type IN ('internship', 'full_time', 'contract', 'part_time', 'unspecified')),
    
    -- Explicit Fresher & Experience Classification (Nullable/Explicit Enum, No Assumptions)
    experience_level VARCHAR(50) NOT NULL DEFAULT 'Unspecified',
    fresher_eligibility_status VARCHAR(50) NOT NULL DEFAULT 'Eligibility Uncertain',
    is_fresher_eligible BOOLEAN, -- NULL represents unknown/uncertain, NOT assumed true
    is_genuinely_fresher BOOLEAN, -- NULL represents unverified
    min_experience_years NUMERIC(3, 1),
    max_experience_years NUMERIC(3, 1),
    target_graduation_years INTEGER[] DEFAULT '{}',
    required_skills TEXT[] DEFAULT '{}',
    responsibilities TEXT[] DEFAULT '{}',
    qualifications TEXT[] DEFAULT '{}',
    
    -- Location & Work Mode
    raw_location VARCHAR(255) DEFAULT '',
    normalized_city VARCHAR(100),
    normalized_state VARCHAR(100),
    country VARCHAR(100),
    work_mode VARCHAR(20) CHECK (work_mode IN ('remote', 'onsite', 'hybrid', 'unspecified')),
    
    -- Compensation (if disclosed)
    salary_range_min NUMERIC(12, 2),
    salary_range_max NUMERIC(12, 2),
    salary_currency VARCHAR(10),
    salary_period VARCHAR(20) CHECK (salary_period IN ('month', 'year', 'lpa', NULL)),
    stipend_or_salary_raw VARCHAR(255),
    
    -- AI Evaluation & Confidence Audit (INTERNAL - NEVER EXPOSED PUBLICLY)
    ai_confidence NUMERIC(4, 3),
    ai_reasoning TEXT,
    ai_summary TEXT,
    prompt_version VARCHAR(50) DEFAULT 'v2.2.0',
    
    -- Primary Canonical Application Action
    primary_apply_url TEXT NOT NULL,
    
    -- Conservative Deduplication Cluster Tracking
    canonical_fingerprint VARCHAR(128) NOT NULL,
    is_duplicate BOOLEAN NOT NULL DEFAULT false,
    canonical_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    duplicate_cluster_id VARCHAR(64),
    duplicate_reason VARCHAR(255),
    
    -- Lifecycle & Operational Status
    is_active BOOLEAN NOT NULL DEFAULT false,
    listing_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (listing_status IN ('ACTIVE', 'EXPIRED', 'REMOVED', 'PENDING')),
    status_reason TEXT,
    consecutive_missing_checks INTEGER NOT NULL DEFAULT 0,
    first_missing_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    
    -- Timestamps
    posted_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes on jobs
CREATE INDEX IF NOT EXISTS idx_jobs_slug ON public.jobs(slug);
CREATE INDEX IF NOT EXISTS idx_jobs_canonical_fingerprint ON public.jobs(canonical_fingerprint);
CREATE INDEX IF NOT EXISTS idx_jobs_company_slug ON public.jobs(company_slug);
CREATE INDEX IF NOT EXISTS idx_jobs_standard_role ON public.jobs(standard_role);
CREATE INDEX IF NOT EXISTS idx_jobs_normalized_city ON public.jobs(normalized_city);
CREATE INDEX IF NOT EXISTS idx_jobs_fresher_status ON public.jobs(fresher_eligibility_status);
CREATE INDEX IF NOT EXISTS idx_jobs_is_fresher ON public.jobs(is_fresher_eligible);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON public.jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_listing_status ON public.jobs(listing_status);
CREATE INDEX IF NOT EXISTS idx_jobs_is_duplicate ON public.jobs(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_jobs_canonical_job_id ON public.jobs(canonical_job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON public.jobs(posted_at DESC);

-- Trigram fuzzy text search
CREATE INDEX IF NOT EXISTS idx_jobs_search_title ON public.jobs USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_search_company ON public.jobs USING gin(company gin_trgm_ops);


-- -----------------------------------------------------------------------------
-- 2. Table: job_sources (Multi-ATS Raw & Sourced Postings - PROTECTED BASE TABLE)
-- Stores full source evidence, raw JSON payloads, and internal scraping state.
-- Access is strictly limited to backend service_role.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    
    -- ATS Provenance
    source_name VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'public_feed',
    source_original_id VARCHAR(255) NOT NULL,
    source_board_token VARCHAR(100),
    source_posting_id VARCHAR(255),
    
    -- Sourced URLs
    original_url TEXT NOT NULL,
    apply_url TEXT NOT NULL,
    final_destination_url TEXT,
    application_url_status VARCHAR(30) NOT NULL DEFAULT 'UNVERIFIED' CHECK (application_url_status IN ('VERIFIED', 'UNVERIFIED', 'BROKEN', 'EXPIRED', 'FLAGGED', 'INVALID')),
    
    -- Raw Payload & Description (SENSITIVE INTERNAL AUDIT EVIDENCE)
    raw_title VARCHAR(255) NOT NULL,
    raw_company VARCHAR(255) NOT NULL,
    raw_location VARCHAR(255) DEFAULT '',
    raw_description TEXT,
    raw_payload JSONB,
    
    -- Scraping Heartbeats & Verification
    is_live_on_source BOOLEAN NOT NULL DEFAULT false,
    last_http_status INTEGER,
    source_last_verified_at TIMESTAMPTZ,
    last_successful_source_check TIMESTAMPTZ,
    consecutive_missing_checks INTEGER NOT NULL DEFAULT 0,
    first_missing_at TIMESTAMPTZ,
    
    -- Timestamps
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_job_sources_origin UNIQUE (source_name, source_original_id)
);

CREATE INDEX IF NOT EXISTS idx_job_sources_job_id ON public.job_sources(job_id);
CREATE INDEX IF NOT EXISTS idx_job_sources_composite ON public.job_sources(source_name, source_original_id);
CREATE INDEX IF NOT EXISTS idx_job_sources_url_status ON public.job_sources(application_url_status);
CREATE INDEX IF NOT EXISTS idx_job_sources_is_live ON public.job_sources(is_live_on_source);


-- -----------------------------------------------------------------------------
-- 3. Table: ingestion_runs (Pipeline Audit & LLM Cost Log - STRICTLY PRIVATE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingestion_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    raw_discovered_count INTEGER NOT NULL DEFAULT 0,
    duplicates_detected INTEGER NOT NULL DEFAULT 0,
    canonical_inserted INTEGER NOT NULL DEFAULT 0,
    llm_tokens_input INTEGER NOT NULL DEFAULT 0,
    llm_tokens_output INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(8, 5) NOT NULL DEFAULT 0.0,
    duration_ms INTEGER,
    error_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_date ON public.ingestion_runs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status ON public.ingestion_runs(status);


-- -----------------------------------------------------------------------------
-- 4. Table: evaluation_records (Human Ground-Truth Benchmark History - STRICTLY PRIVATE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evaluation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    company VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    source_url TEXT NOT NULL,
    ai_predicted_role VARCHAR(100) NOT NULL,
    ground_truth_role VARCHAR(100) NOT NULL,
    role_match BOOLEAN NOT NULL,
    ai_predicted_city VARCHAR(100) NOT NULL,
    ground_truth_city VARCHAR(100) NOT NULL,
    city_match BOOLEAN NOT NULL,
    ai_predicted_fresher BOOLEAN NOT NULL,
    ground_truth_fresher BOOLEAN NOT NULL,
    fresher_match BOOLEAN NOT NULL,
    manual_notes TEXT,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eval_records_job_id ON public.evaluation_records(job_id);


-- -----------------------------------------------------------------------------
-- 5. SECURE PUBLIC VIEWS (Clean Public Interface with Zero Internal Data Leaks)
-- -----------------------------------------------------------------------------

-- View A: public_jobs
-- Exposes ONLY the exact public fields required by the frontend job cards, search, and detail pages.
-- Completely conceals ai_reasoning, prompt_version, canonical_fingerprint, consecutive_missing_checks, first_missing_at.
DROP VIEW IF EXISTS public.public_jobs;
CREATE VIEW public.public_jobs WITH (security_invoker = false) AS
SELECT 
    j.id,
    j.slug,
    j.title,
    j.company,
    j.company_slug,
    j.description,
    j.description_snippet,
    j.standard_role,
    j.role_category,
    j.role_subcategory,
    j.employment_type,
    j.experience_level,
    j.fresher_eligibility_status,
    j.is_fresher_eligible,
    j.min_experience_years,
    j.max_experience_years,
    j.target_graduation_years,
    j.required_skills,
    j.responsibilities,
    j.qualifications,
    j.raw_location,
    j.normalized_city,
    j.normalized_state,
    j.country,
    j.work_mode,
    j.salary_range_min,
    j.salary_range_max,
    j.salary_currency,
    j.salary_period,
    j.stipend_or_salary_raw,
    j.primary_apply_url,
    j.is_active,
    j.listing_status,
    j.posted_at,
    j.discovered_at
FROM public.jobs j
WHERE j.is_active = true 
  AND j.is_duplicate = false 
  AND j.listing_status = 'ACTIVE';

-- View B: public_job_sources
-- Exposes ONLY verified public provenance.
-- Completely conceals raw_payload, raw_description, last_http_status, and scrape heartbeat telemetry.
DROP VIEW IF EXISTS public.public_job_sources;
CREATE VIEW public.public_job_sources WITH (security_invoker = false) AS
SELECT 
    js.id,
    js.job_id,
    js.source_name,
    js.source_type,
    js.source_board_token,
    js.apply_url,
    js.application_url_status,
    js.is_live_on_source,
    js.discovered_at
FROM public.job_sources js
JOIN public.jobs j ON j.id = js.job_id
WHERE js.is_live_on_source = true
  AND j.is_active = true
  AND j.is_duplicate = false
  AND j.listing_status = 'ACTIVE';


-- -----------------------------------------------------------------------------
-- 6. STRICT PERMISSIONS & ROW LEVEL SECURITY DEFENSE-IN-DEPTH
-- -----------------------------------------------------------------------------

-- Step 1: Revoke all default public permissions across all tables and views
REVOKE ALL ON public.jobs FROM PUBLIC;
REVOKE ALL ON public.job_sources FROM PUBLIC;
REVOKE ALL ON public.ingestion_runs FROM PUBLIC;
REVOKE ALL ON public.evaluation_records FROM PUBLIC;
REVOKE ALL ON public.public_jobs FROM PUBLIC;
REVOKE ALL ON public.public_job_sources FROM PUBLIC;

-- Step 2: Grant SELECT strictly to the sanitized public views for anon and authenticated users
GRANT SELECT ON public.public_jobs TO anon, authenticated;
GRANT SELECT ON public.public_job_sources TO anon, authenticated;

-- Step 3: Grant full administrative privileges exclusively to service_role (backend worker)
GRANT ALL ON public.jobs TO service_role;
GRANT ALL ON public.job_sources TO service_role;
GRANT ALL ON public.ingestion_runs TO service_role;
GRANT ALL ON public.evaluation_records TO service_role;
GRANT ALL ON public.public_jobs TO service_role;
GRANT ALL ON public.public_job_sources TO service_role;

-- Step 4: Enable RLS on all underlying base tables
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_records ENABLE ROW LEVEL SECURITY;

-- Step 5: Base Table Policies
DROP POLICY IF EXISTS "Service role has full access to jobs" ON public.jobs;
CREATE POLICY "Service role has full access to jobs"
    ON public.jobs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to job_sources" ON public.job_sources;
CREATE POLICY "Service role has full access to job_sources"
    ON public.job_sources FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to ingestion_runs" ON public.ingestion_runs;
CREATE POLICY "Service role has full access to ingestion_runs"
    ON public.ingestion_runs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to evaluation_records" ON public.evaluation_records;
CREATE POLICY "Service role has full access to evaluation_records"
    ON public.evaluation_records FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
