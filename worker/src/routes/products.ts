import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { createUserClient } from "../lib/supabase";

export const products = new Hono<{ Bindings: Env; Variables: Variables }>();

products.get("/", async (c) => {
  const { businessId } = c.get("auth");
  const supabase = createUserClient(c.env, c.get("accessToken"));
  const lowOnly = c.req.query("low_stock") === "true";

  let query = supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .order("name", { ascending: true });

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 400);

  const result = lowOnly ? (data || []).filter((p) => p.stock_qty <= p.low_stock_threshold) : data;
  return c.json({ products: result });
});

products.post("/", async (c) => {
  const { businessId } = c.get("auth");
  const body = await c.req.json<{
    name: string; unit?: string; purchase_price: number; selling_price: number;
    stock_qty: number; low_stock_threshold?: number;
  }>();

  if (!body.name?.trim()) return c.json({ error: "Product name is required" }, 400);
  if (body.purchase_price == null || body.selling_price == null) {
    return c.json({ error: "Purchase price and selling price are required" }, 400);
  }

  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase
    .from("products")
    .insert({
      business_id: businessId,
      name: body.name.trim(),
      unit: body.unit || "pcs",
      purchase_price: body.purchase_price,
      selling_price: body.selling_price,
      stock_qty: body.stock_qty ?? 0,
      low_stock_threshold: body.low_stock_threshold ?? 5,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ product: data }, 201);
});

products.put("/:id", async (c) => {
  const { businessId } = c.get("auth");
  const id = c.req.param("id");
  const body = await c.req.json<Partial<{
    name: string; unit: string; purchase_price: number; selling_price: number;
    stock_qty: number; low_stock_threshold: number;
  }>>();

  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase
    .from("products")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ product: data });
});

products.delete("/:id", async (c) => {
  const { businessId } = c.get("auth");
  const id = c.req.param("id");
  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { error } = await supabase.from("products").delete().eq("id", id).eq("business_id", businessId);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ ok: true });
});
