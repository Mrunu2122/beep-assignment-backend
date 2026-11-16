-- =============================================================================
-- Project Launchpad - Supabase PostgreSQL Database Schema
-- Architecture: Normalized Job Opportunities, Deduplication Clusters & Ingestion Runs
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Table: jobs
-- Stores primary canonical job opportunities as well as historical records.
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_hash VARCHAR(64) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    company_slug VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    description_snippet VARCHAR(500) NOT NULL,
    apply_url TEXT NOT NULL,
    
    -- Source Traceability
    source_name VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL DEFAULT 'public_feed',
    source_original_id VARCHAR(255),
    
    -- AI Classification Attributes
    standard_role VARCHAR(100) NOT NULL,
    normalized_city VARCHAR(100) NOT NULL,
    work_mode VARCHAR(20) NOT NULL CHECK (work_mode IN ('remote', 'onsite', 'hybrid')),
    employment_type VARCHAR(30) NOT NULL CHECK (employment_type IN ('internship', 'full_time', 'contract')),
    is_fresher_eligible BOOLEAN NOT NULL DEFAULT true,
    min_experience_years NUMERIC(3, 1) NOT NULL DEFAULT 0.0,
    max_experience_years NUMERIC(3, 1),
    target_graduation_years INTEGER[] DEFAULT '{}',
    required_skills TEXT[] DEFAULT '{}',
    
    -- Compensation (if disclosed)
    salary_range_min NUMERIC(12, 2),
    salary_range_max NUMERIC(12, 2),
    salary_currency VARCHAR(10) DEFAULT 'INR',
    salary_period VARCHAR(20) CHECK (salary_period IN ('month', 'year', 'lpa', NULL)),
    stipend_or_salary_raw VARCHAR(255),
    
    -- AI Metadata & Reliability
    ai_confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.950,
    ai_reasoning TEXT,
    prompt_version VARCHAR(50) NOT NULL DEFAULT 'v1.2.0',
    
    -- Deduplication tracking
    is_duplicate BOOLEAN NOT NULL DEFAULT false,
    canonical_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    duplicate_cluster_id VARCHAR(64),
    duplicate_reason VARCHAR(255),
    
    -- Operational Status & Timestamps
    is_active BOOLEAN NOT NULL DEFAULT true,
    posted_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning fast multi-facet querying
CREATE INDEX IF NOT EXISTS idx_jobs_canonical_hash ON jobs(canonical_hash);
CREATE INDEX IF NOT EXISTS idx_jobs_standard_role ON jobs(standard_role);
CREATE INDEX IF NOT EXISTS idx_jobs_normalized_city ON jobs(normalized_city);
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON jobs(employment_type);
CREATE INDEX IF NOT EXISTS idx_jobs_is_fresher ON jobs(is_fresher_eligible);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_is_duplicate ON jobs(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company_slug ON jobs(company_slug);

-- Full text search and trigram indexes
CREATE INDEX IF NOT EXISTS idx_jobs_search_title ON jobs USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_search_company ON jobs USING gin(company gin_trgm_ops);

-- 2. Table: ingestion_runs
-- Tracks daily automated pipeline runs, execution latency, and token / dollar costs.
CREATE TABLE IF NOT EXISTS ingestion_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
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

-- 3. Table: evaluation_records
-- Stores the 50-sample human verified benchmark data
CREATE TABLE IF NOT EXISTS evaluation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
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
