import type { Context, Next } from "hono";
import type { Env, Variables } from "../types";
import { createUserClient } from "./supabase";

export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const supabase = createUserClient(c.env, token);

  // Let Supabase Auth validate the access token.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.error("Supabase authentication failed:", authError);
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const { data, error } = await supabase
    .from("business_users")
    .select("business_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error("Business membership lookup failed:", error);
    return c.json(
      { error: "No business is linked to this account yet" },
      403
    );
  }

  c.set("auth", {
    userId: user.id,
    businessId: data.business_id,
    role: data.role as "owner" | "staff",
  });

  c.set("accessToken", token);

  await next();
}
