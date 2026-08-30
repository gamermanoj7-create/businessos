import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { createUserClient } from "../lib/supabase";
import { resolveRange } from "../lib/dateRange";

export const reports = new Hono<{ Bindings: Env; Variables: Variables }>();

reports.get("/sales", async (c) => {
  const { businessId } = c.get("auth");
  const { start, end } = resolveRange(c);
  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase.rpc("report_sales", { p_business_id: businessId, p_start: start, p_end: end });
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ range: { start, end }, rows: data });
});

reports.get("/profit", async (c) => {
  const { businessId } = c.get("auth");
  const { start, end } = resolveRange(c);
  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase.rpc("report_profit", { p_business_id: businessId, p_start: start, p_end: end });
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ range: { start, end }, rows: data });
});

reports.get("/expenses", async (c) => {
  const { businessId } = c.get("auth");
  const { start, end } = resolveRange(c);
  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase.rpc("report_expenses", { p_business_id: businessId, p_start: start, p_end: end });
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ range: { start, end }, rows: data });
});

reports.get("/customer-due", async (c) => {
  const { businessId } = c.get("auth");
  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase.rpc("report_customer_due", { p_business_id: businessId });
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ rows: data });
});

reports.get("/stock", async (c) => {
  const { businessId } = c.get("auth");
  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase.rpc("report_stock", { p_business_id: businessId });
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ rows: data });
});
