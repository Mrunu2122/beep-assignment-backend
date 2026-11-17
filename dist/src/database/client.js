"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseClient = getSupabaseClient;
const supabase_js_1 = require("@supabase/supabase-js");
const ws_1 = __importDefault(require("ws"));
const index_js_1 = require("../config/index.js");
const logger_js_1 = require("../monitoring/logger.js");
let supabaseInstance = null;
function getSupabaseClient() {
    if (supabaseInstance)
        return supabaseInstance;
    const url = index_js_1.config.supabase.url;
    const key = index_js_1.config.supabase.serviceRoleKey || index_js_1.config.supabase.anonKey;
    if (!url || !key) {
        logger_js_1.logger.warn('Supabase URL or Key missing. Running in local in-memory mock mode for database operations.');
        return null;
    }
    supabaseInstance = (0, supabase_js_1.createClient)(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { transport: ws_1.default }
    });
    return supabaseInstance;
}
