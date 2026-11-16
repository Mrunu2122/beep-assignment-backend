import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.API_PORT || '4000', 10),
  supabase: {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    promptVersion: process.env.GEMINI_PROMPT_VERSION || 'v1.2.0',
  },
  deduplication: {
    exactMatchEnabled: process.env.EXACT_MATCH_ENABLED !== 'false',
    fuzzyThreshold: parseFloat(process.env.FUZZY_SIMILARITY_THRESHOLD || '0.88'),
  },
  cronSecret: process.env.CRON_SECRET || 'dev-secret-key-123',
};
