import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { config } from '../config/index.js';
import { logger } from '../monitoring/logger.js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = config.supabase.url;
  const key = config.supabase.serviceRoleKey || config.supabase.anonKey;

  if (!url || !key) {
    logger.warn('Supabase URL or Key missing. Running in local in-memory mock mode for database operations.');
    return null;
  }

  supabaseInstance = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any }
  });

  return supabaseInstance;
}
