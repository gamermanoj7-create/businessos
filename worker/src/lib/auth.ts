import { jwtVerify } from "jose";
import type { Context, Next } from "hono";
import type { Env, Variables } from "../types";
import { createUserClient } from "./supabase";

/**
 * Verifies the Supabase-issued JWT from the Authorization header, resolves
 * which business the user belongs to via business_users, and stores both
 * on the request context. Every downstream route reads business_id from
 * here — never from a client-supplied field — so a user can never pass a
 * different business_id and read someone else's data.
 */
export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  let userId: string;
  try {
    const secret = new TextEncoder().encode(c.env.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.sub) throw new Error("no sub claim");
    userId = payload.sub;
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Resolve business membership via the user's own token (RLS-safe: a user
  // can only ever select their own business_users row).
  const supabase = createUserClient(c.env, token);
  const { data, error } = await supabase
    .from("business_users")
    .select("business_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return c.json({ error: "No business is linked to this account yet" }, 403);
  }

  c.set("auth", {
    userId,
    businessId: data.business_id,
    role: data.role as "owner" | "staff",
  });
  c.set("accessToken", token);

  await next();
}
