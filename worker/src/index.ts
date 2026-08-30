import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./types";
import { requireAuth } from "./lib/auth";
import { customers } from "./routes/customers";
import { products } from "./routes/products";
import { sales } from "./routes/sales";
import { expenses } from "./routes/expenses";
import { dashboard } from "./routes/dashboard";
import { reports } from "./routes/reports";
import { ai } from "./routes/ai";
import { whatsapp, whatsappPublic } from "./routes/whatsapp";
import { runDueReminders } from "./cron/dueReminders";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use(
  "*",
  cors({
    origin: (origin) => origin, // restrict this to your deployed web app's origin in production
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.get("/", (c) => c.json({ ok: true, service: "businessos-api" }));

// WhatsApp webhook must stay outside the auth middleware — Meta calls it directly.
app.route("/whatsapp", whatsappPublic);

// Everything below requires a valid Supabase session.
app.use("/api/*", requireAuth);

app.route("/api/customers", customers);
app.route("/api/products", products);
app.route("/api/sales", sales);
app.route("/api/expenses", expenses);
app.route("/api/dashboard", dashboard);
app.route("/api/reports", reports);
app.route("/api/ai", ai);
app.route("/api/whatsapp", whatsapp); // authenticated: notification history + manual send-now

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong. Please try again." }, 500);
});

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runDueReminders(env).then((result) => {
        console.log("due reminder run:", JSON.stringify(result));
      })
    );
  },
};
