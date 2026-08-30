import type { Env } from "../types";
import { createServiceClient } from "../lib/supabase";
import { sendDueReminder } from "../lib/whatsapp";

const MAX_ATTEMPTS = 5;

/**
 * Runs hourly (see wrangler.toml). Two phases:
 *
 * 1. SCHEDULE: for every customer with a positive due balance and reminders
 *    enabled, if today matches their reminder day, ensure a `due_notifications`
 *    row exists for today. The (business_id, customer_id, scheduled_for)
 *    unique constraint means calling this twice in the same hour, or on
 *    every hourly tick throughout the day, can never create a duplicate.
 *
 * 2. SEND: pick up every row still `pending` or `failed` (with attempts left)
 *    scheduled for today, and attempt delivery. Only a confirmed WhatsApp
 *    message id flips status to `sent`; anything else is recorded as `failed`
 *    with the real error message and will be retried on the next tick.
 */
export async function runDueReminders(env: Env): Promise<{ scheduled: number; sent: number; failed: number }> {
  const supabase = createServiceClient(env);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDay = new Date().getUTCDate();

  let scheduledCount = 0;

  // ---- Phase 1: schedule ----
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, currency, reminder_default_day, whatsapp_phone_number_id");

  for (const biz of businesses || []) {
    const { data: dueCustomers } = await supabase.rpc("report_customer_due", { p_business_id: biz.id });

    for (const row of dueCustomers || []) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id, reminder_enabled, reminder_day, phone")
        .eq("id", row.customer_id)
        .single();

      if (!customer || !customer.reminder_enabled) continue;
      const effectiveDay = customer.reminder_day || biz.reminder_default_day || 3;
      if (effectiveDay !== todayDay) continue;

      // Upsert-style insert; unique constraint blocks duplicates for today.
      const { error: insertErr } = await supabase.from("due_notifications").insert({
        business_id: biz.id,
        customer_id: customer.id,
        due_amount_snapshot: row.current_due,
        scheduled_for: todayStr,
        status: "pending",
      });
      if (!insertErr) scheduledCount++;
      // If insertErr is a unique-violation, a reminder for today already
      // exists — that's the duplicate-prevention working as intended.
    }
  }

  // ---- Phase 2: send / retry ----
  const { data: toSend } = await supabase
    .from("due_notifications")
    .select("*, customers(name, phone), businesses(currency, whatsapp_phone_number_id)")
    .in("status", ["pending", "failed"])
    .eq("scheduled_for", todayStr)
    .lt("attempt_count", MAX_ATTEMPTS);

  let sentCount = 0;
  let failedCount = 0;

  for (const notif of toSend || []) {
    const customer = (notif as any).customers;
    const business = (notif as any).businesses;

    const result = await sendDueReminder(
      env,
      customer?.phone,
      customer?.name || "Customer",
      notif.due_amount_snapshot,
      business?.currency || "BDT",
      business?.whatsapp_phone_number_id || undefined
    );

    if (result.success) {
      await supabase
        .from("due_notifications")
        .update({
          status: "sent",
          whatsapp_message_id: result.messageId,
          sent_at: new Date().toISOString(),
          attempt_count: notif.attempt_count + 1,
          error: null,
        })
        .eq("id", notif.id);
      sentCount++;
    } else {
      await supabase
        .from("due_notifications")
        .update({
          status: "failed",
          error: result.error,
          attempt_count: notif.attempt_count + 1,
        })
        .eq("id", notif.id);
      failedCount++;
    }
  }

  return { scheduled: scheduledCount, sent: sentCount, failed: failedCount };
}
