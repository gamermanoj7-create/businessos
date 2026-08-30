import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at build/runtime rather than silently hitting undefined URLs.
  console.warn("Supabase env vars are not set. Check .env.local");
}

// This client is used ONLY for authentication (sign in/up/out, session).
// All business data reads and writes go through the Cloudflare Worker API
// (see lib/api.ts), which enforces business_id isolation server-side.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
