import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { createUserClient } from "../lib/supabase";
import { resolveRange } from "../lib/dateRange";

export const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

dashboard.get("/", async (c) => {
  const { businessId } = c.get("auth");
  const { start, end } = resolveRange(c);
  const supabase = createUserClient(c.env, c.get("accessToken"));

  const { data: summary, error } = await supabase
    .rpc("dashboard_summary", { p_business_id: businessId, p_start: start, p_end: end })
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 400);

  const { data: lowStock } = await supabase
    .from("products")
    .select("id, name, stock_qty, low_stock_threshold, unit")
    .eq("business_id", businessId);

  const lowStockList = (lowStock || []).filter((p) => p.stock_qty <= p.low_stock_threshold);

  const { data: topDue } = await supabase.rpc("report_customer_due", { p_business_id: businessId });

  return c.json({
    range: { start, end },
    sales_total: summary?.sales_total || 0,
    collected_total: summary?.collected_total || 0,
    due_total: summary?.due_total || 0,
    expenses_total: summary?.expenses_total || 0,
    profit_total: summary?.profit_total || 0,
    low_stock: lowStockList,
    top_due_customers: (topDue || []).slice(0, 5),
  });
});
