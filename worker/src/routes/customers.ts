import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { createUserClient } from "../lib/supabase";

export const customers = new Hono<{ Bindings: Env; Variables: Variables }>();

// List customers, each with live current_due (derived, not stored)
customers.get("/", async (c) => {
  const { businessId } = c.get("auth");
  const supabase = createUserClient(c.env, c.get("accessToken"));

  const { data: rows, error } = await supabase
    .from("customers")
    .select("id, name, phone, address, reminder_enabled, reminder_day, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 400);

  // Attach balances in one shot via the report_customer_due function, then merge.
  const { data: dues } = await supabase.rpc("report_customer_due", { p_business_id: businessId });
  const dueMap = new Map((dues || []).map((d: any) => [d.customer_id, d.current_due]));

  const result = (rows || []).map((r) => ({ ...r, current_due: dueMap.get(r.id) || 0 }));
  return c.json({ customers: result });
});

customers.post("/", async (c) => {
  const { businessId } = c.get("auth");
  const body = await c.req.json<{ name: string; phone?: string; address?: string; reminder_enabled?: boolean; reminder_day?: number }>();
  if (!body.name?.trim()) return c.json({ error: "Name is required" }, 400);

  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: businessId,
      name: body.name.trim(),
      phone: body.phone || null,
      address: body.address || null,
      reminder_enabled: body.reminder_enabled ?? true,
      reminder_day: body.reminder_day ?? null,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ customer: data }, 201);
});

customers.put("/:id", async (c) => {
  const { businessId } = c.get("auth");
  const id = c.req.param("id");
  const body = await c.req.json<Partial<{ name: string; phone: string; address: string; reminder_enabled: boolean; reminder_day: number }>>();

  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase
    .from("customers")
    .update(body)
    .eq("id", id)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ customer: data });
});

// Customer detail: profile + full sale/payment history + balances
customers.get("/:id", async (c) => {
  const { businessId } = c.get("auth");
  const id = c.req.param("id");
  const supabase = createUserClient(c.env, c.get("accessToken"));

  const { data: customer, error: cErr } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();
  if (cErr || !customer) return c.json({ error: "Customer not found" }, 404);

  const { data: balance } = await supabase.rpc("customer_balance", { p_customer_id: id }).maybeSingle();

  const { data: sales } = await supabase
    .from("sales")
    .select("id, invoice_no, total, paid_amount, due_amount, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, method, note, sale_id, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  return c.json({
    customer,
    total_sales: balance?.total_sales || 0,
    total_paid: balance?.total_paid || 0,
    current_due: balance?.current_due || 0,
    sales: sales || [],
    payments: payments || [],
  });
});

// Receive a payment against a customer's outstanding due (FIFO, transactional)
customers.post("/:id/payments", async (c) => {
  const { businessId, userId } = c.get("auth");
  const id = c.req.param("id");
  const body = await c.req.json<{ amount: number; method?: string; note?: string }>();

  if (!body.amount || body.amount <= 0) {
    return c.json({ error: "Amount must be greater than zero" }, 400);
  }

  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase.rpc("receive_payment", {
    p_business_id: businessId,
    p_customer_id: id,
    p_amount: body.amount,
    p_method: body.method || "cash",
    p_note: body.note || null,
    p_created_by: userId,
  });

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ payment: data }, 201);
});
