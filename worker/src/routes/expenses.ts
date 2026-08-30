import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { createUserClient } from "../lib/supabase";

export const expenses = new Hono<{ Bindings: Env; Variables: Variables }>();

expenses.get("/", async (c) => {
  const { businessId } = c.get("auth");
  const start = c.req.query("start");
  const end = c.req.query("end");
  const supabase = createUserClient(c.env, c.get("accessToken"));

  let query = supabase
    .from("expenses")
    .select("*")
    .eq("business_id", businessId)
    .order("expense_date", { ascending: false });

  if (start) query = query.gte("expense_date", start);
  if (end) query = query.lte("expense_date", end);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ expenses: data });
});

expenses.post("/", async (c) => {
  const { businessId, userId } = c.get("auth");
  const body = await c.req.json<{ category: string; amount: number; note?: string; expense_date?: string }>();

  if (!body.category?.trim()) return c.json({ error: "Category is required" }, 400);
  if (!body.amount || body.amount <= 0) return c.json({ error: "Amount must be greater than zero" }, 400);

  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      business_id: businessId,
      category: body.category.trim(),
      amount: body.amount,
      note: body.note || null,
      expense_date: body.expense_date || new Date().toISOString().slice(0, 10),
      created_by: userId,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ expense: data }, 201);
});

expenses.delete("/:id", async (c) => {
  const { businessId } = c.get("auth");
  const id = c.req.param("id");
  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("business_id", businessId);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ ok: true });
});
