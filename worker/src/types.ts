export interface Env {
  // Bindings
  AI: Ai;

  // Secrets (set via `wrangler secret put`)
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  WHATSAPP_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_VERIFY_TOKEN: string;
  WHATSAPP_TEMPLATE_NAME: string;
  WHATSAPP_TEMPLATE_LANG: string;

  // Vars
  APP_ENV: string;
}

/** Populated by the auth middleware on every authenticated request. */
export interface AuthContext {
  userId: string;
  businessId: string;
  role: "owner" | "staff";
}

export type Variables = {
  auth: AuthContext;
  accessToken: string;
};
