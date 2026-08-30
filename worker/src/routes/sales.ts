import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { createUserClient } from "../lib/supabase";

export const sales = new Hono<{ Bindings: Env; Variables: Variables }>();

interface SaleItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
}

// Create a sale — the ONLY write path for stock reduction + due creation.
// Runs through the create_sale() Postgres function so items, stock, and
// customer due are all updated in a single atomic transaction.
sales.post("/", async (c) => {
  const { businessId, userId } = c.get("auth");
  const body = await c.req.json<{
    customer_id?: string | null;
    items: SaleItemInput[];
    discount?: number;
    tax_enabled?: boolean;
    paid_amount: number;
  }>();

  if (!body.items?.length) return c.json({ error: "Add at least one product" }, 400);
  for (const item of body.items) {
    if (!item.product_id || item.quantity <= 0 || item.unit_price < 0) {
      return c.json({ error: "Invalid item in sale" }, 400);
    }
  }

  const supabase = createUserClient(c.env, c.get("accessToken"));

  // Compute tax server-side from the business's own gst settings — never
  // trust a tax amount sent from the client.
  let taxAmount = 0;
  if (body.tax_enabled) {
    const { data: biz } = await supabase
      .from("businesses")
      .select("gst_enabled, gst_percent")
      .eq("id", businessId)
      .single();
    if (biz?.gst_enabled) {
      const subtotal = body.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
      const afterDiscount = subtotal - (body.discount || 0);
      taxAmount = Math.round((afterDiscount * (biz.gst_percent / 100)) * 100) / 100;
    }
  }

  const { data, error } = await supabase.rpc("create_sale", {
    p_business_id: businessId,
    p_customer_id: body.customer_id || null,
    p_items: body.items,
    p_discount: body.discount || 0,
    p_tax_amount: taxAmount,
    p_paid_amount: body.paid_amount ?? 0,
    p_created_by: userId,
  });

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ sale: data }, 201);
});

sales.get("/", async (c) => {
  const { businessId } = c.get("auth");
  const supabase = createUserClient(c.env, c.get("accessToken"));
  const start = c.req.query("start");
  const end = c.req.query("end");

  let query = supabase
    .from("sales")
    .select("id, invoice_no, customer_id, total, paid_amount, due_amount, created_at, customers(name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (start) query = query.gte("created_at", start);
  if (end) query = query.lte("created_at", end);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ sales: data });
});

sales.get("/:id", async (c) => {
  const { businessId } = c.get("auth");
  const id = c.req.param("id");
  const supabase = createUserClient(c.env, c.get("accessToken"));

  const { data: sale, error } = await supabase
    .from("sales")
    .select("*, customers(name, phone)")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();
  if (error || !sale) return c.json({ error: "Invoice not found" }, 404);

  const { data: items } = await supabase
    .from("sale_items")
    .select("id, quantity, unit_price, line_total, products(name, unit)")
    .eq("sale_id", id);

  return c.json({ sale, items: items || [] });
});
