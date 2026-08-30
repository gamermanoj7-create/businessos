import type { Env } from "../types";

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends a due-payment reminder via the WhatsApp Cloud API using an
 * approved message template (required for business-initiated messages
 * outside the 24-hour customer service window).
 *
 * IMPORTANT: this function NEVER returns success:true unless Meta's API
 * response actually contains a message id. Network errors, 4xx/5xx
 * responses, and malformed responses are all treated as failure so the
 * app can never falsely claim a message was delivered.
 */
export async function sendDueReminder(
  env: Env,
  toPhoneE164: string,
  customerName: string,
  dueAmount: number,
  currency: string,
  phoneNumberIdOverride?: string
): Promise<WhatsAppSendResult> {
  const phoneNumberId = phoneNumberIdOverride || env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId || !env.WHATSAPP_TOKEN) {
    return { success: false, error: "WhatsApp is not configured for this business" };
  }
  if (!toPhoneE164) {
    return { success: false, error: "Customer has no phone number on file" };
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: toPhoneE164.replace(/[^\d+]/g, ""),
    type: "template",
    template: {
      name: env.WHATSAPP_TEMPLATE_NAME || "due_reminder",
      language: { code: env.WHATSAPP_TEMPLATE_LANG || "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: `${currency} ${dueAmount.toFixed(2)}` },
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json<any>().catch(() => null);

    if (!res.ok || !data) {
      const errMsg = data?.error?.message || `WhatsApp API returned HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    if (!messageId) {
      return { success: false, error: "WhatsApp API did not confirm message acceptance" };
    }

    return { success: true, messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error calling WhatsApp API" };
  }
}
