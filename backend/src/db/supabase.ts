import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Service-role client. This bypasses Row-Level Security, so EVERY query in this
 * codebase must explicitly scope by user_id. RLS remains the defense-in-depth
 * layer for the dashboard, which connects with the anon key + Supabase Auth.
 */
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
