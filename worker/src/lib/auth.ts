import { jwtVerify, createRemoteJWKSet } from "jose";
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

  let userId: string;

  try {
    const supabaseUrl = c.env.SUPABASE_URL.replace(/\/$/, "");

    // Supabase current signing-key endpoint.
    const JWKS = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
    );

    let payload;

    try {
      // Current Supabase asymmetric JWT verification.
      const result = await jwtVerify(token, JWKS, {
        issuer: `${supabaseUrl}/auth/v1`,
      });
      payload = result.payload;
    } catch {
      // Backward compatibility for older HS256 Supabase projects.
      const secret = new TextEncoder().encode(c.env.SUPABASE_JWT_SECRET);

      const result = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
      });

      payload = result.payload;
    }

    if (!payload.sub) {
      throw new Error("JWT has no user id");
    }

    userId = payload.sub;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const supabase = createUserClient(c.env, token);

  const { data, error } = await supabase
    .from("business_users")
    .select("business_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return c.json(
      { error: "No business is linked to this account yet" },
      403
    );
  }

  c.set("auth", {
    userId,
    businessId: data.business_id,
    role: data.role as "owner" | "staff",
  });

  c.set("accessToken", token);

  await next();
}
