import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const dbUrl = process.env.DATABASE_URL;
console.log('DATABASE_URL present:', !!dbUrl);

if (!dbUrl) {
  console.error('DATABASE_URL missing from backend/.env');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();
  console.log('Direct PostgreSQL connection: SUCCESS');
  const res = await client.query('SELECT current_database(), current_user, version();');
  console.log('Connected to DB:', res.rows[0].current_database, 'as user:', res.rows[0].current_user);

  const tables = await client.query(`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('jobs', 'job_sources', 'ingestion_runs', 'evaluation_records', 'public_jobs', 'public_job_sources');
  `);
  console.log('Existing Launchpad tables in DB:', tables.rows);

  await client.end();
}

check().catch(e => {
  console.error('PG error:', e.message);
  process.exit(1);
});
