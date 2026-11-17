import { runDatasetMigration } from '../../scripts/import-to-supabase.js';

async function executeLiveImport() {
  console.log('=== RUNNING LIVE MIGRATION 1 (INITIAL IMPORT) ===');
  const r1 = await runDatasetMigration(false);
  console.log('R1 Results:', {
    insertedJobs: r1.newCanonicalJobsInserted,
    skippedJobs: r1.existingCanonicalJobsSkipped,
    insertedSources: r1.newSourceRecordsInserted,
    skippedSources: r1.existingSourceRecordsSkipped
  });

  console.log('\n=== RUNNING LIVE MIGRATION 2 (IDEMPOTENCY & SKIP CHECK) ===');
  const r2 = await runDatasetMigration(false);
  console.log('R2 Results:', {
    insertedJobs: r2.newCanonicalJobsInserted,
    skippedJobs: r2.existingCanonicalJobsSkipped,
    insertedSources: r2.newSourceRecordsInserted,
    skippedSources: r2.existingSourceRecordsSkipped
  });

  if (r2.newCanonicalJobsInserted !== 0 || r2.newSourceRecordsInserted !== 0) {
    throw new Error('Idempotency violation: Second run inserted records instead of skipping all!');
  }

  console.log('\n>>> LIVE IMPORT & CONFLICT-SAFE IDEMPOTENCY: 100% PASS <<<');
}

executeLiveImport().catch(err => {
  console.error('Live Import Failed:', err);
  process.exit(1);
});
