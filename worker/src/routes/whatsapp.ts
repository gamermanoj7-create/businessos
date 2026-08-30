import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { createUserClient, createServiceClient } from "../lib/supabase";
import { sendDueReminder } from "../lib/whatsapp";

// Authenticated routes: notification history + manual send. Mounted under
// /api/whatsapp behind the requireAuth middleware.
export const whatsapp = new Hono<{ Bindings: Env; Variables: Variables }>();

// Public routes: Meta's webhook verification + delivery status callbacks
// ONLY. Mounted under /whatsapp with NO auth middleware, since Meta calls
// these directly and cannot present a Supabase session token.
export const whatsappPublic = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---------------------------------------------------------------------------
// Notification history (authenticated, business-scoped)
// ---------------------------------------------------------------------------
whatsapp.get("/notifications", async (c) => {
  const { businessId } = c.get("auth");
  const supabase = createUserClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase
    .from("due_notifications")
    .select("id, customer_id, due_amount_snapshot, scheduled_for, status, attempt_count, error, sent_at, customers(name, phone)")
    .eq("business_id", businessId)
    .order("scheduled_for", { ascending: false })
    .limit(100);

  if (error) return c.json({ error: error.message }, 400);
  return c.json({ notifications: data });
});

// Manual "send now" for a specific customer — still goes through the same
// confirm-or-fail path, and still respects the once-per-day uniqueness.
whatsapp.post("/send-now/:customerId", async (c) => {
  const { businessId, userId } = c.get("auth");
  const customerId = c.req.param("customerId");
  const supabase = createUserClient(c.env, c.get("accessToken"));

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone")
    .eq("id", customerId)
    .eq("business_id", businessId)
    .single();
  if (!customer) return c.json({ error: "Customer not found" }, 404);

  const { data: balance } = await supabase.rpc("customer_balance", { p_customer_id: customerId }).maybeSingle();
  const due = balance?.current_due || 0;
  if (due <= 0) return c.json({ error: "This customer has no outstanding due" }, 400);

  const { data: biz } = await supabase.from("businesses").select("currency, whatsapp_phone_number_id").eq("id", businessId).single();

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: notifRow, error: insertErr } = await supabase
    .from("due_notifications")
    .insert({ business_id: businessId, customer_id: customerId, due_amount_snapshot: due, scheduled_for: todayStr, status: "pending" })
    .select()
    .single();

  if (insertErr) {
    return c.json({ error: "A reminder for this customer was already sent or scheduled today" }, 409);
  }

  const result = await sendDueReminder(c.env, customer.phone, customer.name, due, biz?.currency || "BDT", biz?.whatsapp_phone_number_id || undefined);

  if (result.success) {
    await supabase
      .from("due_notifications")
      .update({ status: "sent", whatsapp_message_id: result.messageId, sent_at: new Date().toISOString(), attempt_count: 1 })
      .eq("id", notifRow.id);
    return c.json({ sent: true, message_id: result.messageId });
  } else {
    await supabase.from("due_notifications").update({ status: "failed", error: result.error, attempt_count: 1 }).eq("id", notifRow.id);
    return c.json({ sent: false, error: result.error }, 502);
  }
});

// ---------------------------------------------------------------------------
// Meta webhook — verification handshake (GET) + delivery status callbacks (POST)
// Unauthenticated by design (Meta calls this directly); uses service role.
// ---------------------------------------------------------------------------
whatsappPublic.get("/webhook", async (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token === c.env.WHATSAPP_VERIFY_TOKEN) {
    return c.text(challenge || "");
  }
  return c.text("Forbidden", 403);
});

whatsappPublic.post("/webhook", async (c) => {
  const body = await c.req.json<any>().catch(() => null);
  if (!body) return c.json({ ok: true }); // Meta only cares about 200 OK

  const supabase = createServiceClient(c.env);

  try {
    const statuses = body?.entry?.[0]?.changes?.[0]?.value?.statuses || [];
    for (const s of statuses) {
      const messageId = s.id;
      const status = s.status; // sent | delivered | read | failed
      if (!messageId) continue;

      if (status === "failed") {
        const errMsg = s.errors?.[0]?.title || "Delivery failed per WhatsApp status callback";
        await supabase.from("due_notifications").update({ status: "failed", error: errMsg }).eq("whatsapp_message_id", messageId);
      }
      // 'sent' / 'delivered' / 'read' — our row is already 'sent' from the
      // send-time confirmation; we don't need to change status further,
      // but this is the place to log richer delivery tracking if needed.
    }
  } catch {
    // Never fail the webhook response — just acknowledge receipt.
  }

  return c.json({ ok: true });
});
