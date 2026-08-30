import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../types";

/**
 * User-scoped client. Forwards the caller's own Supabase access token so
 * Postgres RLS (is_business_member / auth.uid()) enforces tenant isolation
 * at the database layer — the worker never has to "trust itself" to filter
 * by business_id correctly.
 */
export function createUserClient(env: Env, accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Service-role client. Bypasses RLS entirely. ONLY used by:
 *  - the cron scheduler (no end-user session exists)
 *  - the WhatsApp webhook (Meta calls us, not a logged-in user)
 * Every query made with this client MUST explicitly filter by business_id.
 */
export function createServiceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
