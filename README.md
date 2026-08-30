# BusinessOS Cloud AI

A simple, cloud-based business management app for shop and small business
owners: sales (POS), customers with due tracking, stock, expenses, reports,
an AI assistant grounded in your real data, and automatic WhatsApp due
reminders.

The cloud database (Supabase Postgres) is the single source of truth.
Nothing important is stored in the browser — there is no `localStorage`
data model and no `data.json`. Every business's data is isolated by
`business_id` and enforced by Postgres Row Level Security, not just app
code.

---

## 1. Architecture

```
businessos/
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql        Tables, RLS policies, create_sale/receive_payment
│       ├── 0002_reports.sql     Dashboard + report aggregate functions
│       └── 0003_signup.sql      Auto-create a business on signup
├── worker/                       Cloudflare Worker — the API
│   └── src/
│       ├── index.ts              Hono app, routing, cron export
│       ├── lib/                  auth, supabase clients, whatsapp, ai, date-range
│       ├── routes/                customers, products, sales, expenses,
│       │                          dashboard, reports, ai, whatsapp
│       └── cron/dueReminders.ts  Hourly scheduled reminder job
└── web/                           Next.js 14 (App Router) — the frontend
    └── app/                       dashboard, sales, customers, products,
                                    expenses, reports, ai, login
```

**Frontend (Next.js + TypeScript + Tailwind, PWA, mobile-first)** never talks
to Postgres directly except for authentication. All business data reads and
writes go through the Cloudflare Worker API, over HTTPS, with the user's
Supabase access token in the `Authorization` header.

**Backend (Cloudflare Worker, Hono)** verifies that token, resolves which
`business_id` the user belongs to from the `business_users` table, and uses
a **user-scoped Supabase client** for almost everything — meaning Postgres
Row Level Security is the real enforcement layer, not application code. The
worker cannot accidentally leak another business's data because the
database itself refuses to return it.

**Database (Supabase Postgres)** holds every table, all RLS policies, and
the two most safety-critical operations — `create_sale()` and
`receive_payment()` — as single atomic Postgres functions, so stock levels,
customer due, and invoice totals can never drift out of sync, even under
concurrent sales.

**AI (Cloudflare Workers AI)** is only ever shown a JSON snapshot of the
business's real numbers (pulled with the same SQL functions the dashboard
uses) plus a system prompt that explicitly forbids inventing numbers. Every
question/answer/snapshot triple is logged to `ai_query_log` for audit.

**WhatsApp (Cloud API)** reminders are scheduled by an hourly Cloudflare Cron
Trigger. A message is only ever marked `sent` when Meta's API returns a real
message id in the response; anything else (network error, API error,
missing phone number) is recorded as `failed` with the real error message
and retried on the next run. A unique database constraint on
`(business_id, customer_id, scheduled_for)` makes duplicate reminders on the
same day structurally impossible, not just unlikely.

---

## 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the three migration files **in order**:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_reports.sql`
   - `supabase/migrations/0003_signup.sql`
3. Go to **Project Settings → API** and copy:
   - `Project URL` → used as `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (worker only — **never**
     put this in the frontend)
4. Go to **Project Settings → API → JWT Settings** and copy the **JWT
   Secret** → `SUPABASE_JWT_SECRET` (worker only).
5. In **Authentication → Providers**, email/password sign-up is enabled by
   default — that's all this app uses ("Keep authentication simple").
6. Optional: In **Authentication → URL Configuration**, set your deployed
   web app URL as a Redirect URL if you plan to use email confirmation
   links.

There is no manual step to create a business — the `0003_signup.sql`
trigger creates one automatically the first time someone signs up, named
from the "Business Name" field on the sign-up form.

---

## 3. Cloudflare Worker Setup

```bash
cd worker
npm install
npx wrangler login

# Secrets (you'll be prompted to paste each value)
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SUPABASE_JWT_SECRET
npx wrangler secret put WHATSAPP_TOKEN
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
npx wrangler secret put WHATSAPP_VERIFY_TOKEN
npx wrangler secret put WHATSAPP_TEMPLATE_NAME
npx wrangler secret put WHATSAPP_TEMPLATE_LANG

# Enable Workers AI for your account (Cloudflare dashboard → Workers AI),
# no separate API key needed — it's bound via wrangler.toml's [ai] binding.

npm run deploy
```

For local development, copy `worker/.dev.vars.example` to `worker/.dev.vars`,
fill in the same values, then run `npm run dev`.

The cron schedule (`0 * * * *` — hourly) is defined in `wrangler.toml` and
takes effect automatically on deploy.

---

## 4. WhatsApp Cloud API Setup

1. Create a Meta developer app and add the **WhatsApp** product
   ([developers.facebook.com](https://developers.facebook.com)).
2. From **WhatsApp → API Setup**, note your **Phone number ID** and generate
   a **permanent access token** (System User token recommended for
   production, not the 24-hour test token).
3. Create and get approval for a message template named `due_reminder`
   (or your own name — set `WHATSAPP_TEMPLATE_NAME` to match) with a body
   like:
   > Hello {{1}}, you have an outstanding balance of {{2}} with us. Please
   > pay at your earliest convenience. Thank you!
   Business-initiated messages **require an approved template** — Meta will
   reject a plain text message sent outside a 24-hour customer conversation
   window.
4. Under **Configuration → Webhook**, set the callback URL to:
   `https://businessos-api.YOUR-SUBDOMAIN.workers.dev/whatsapp/webhook`
   and the verify token to the same value you set as `WHATSAPP_VERIFY_TOKEN`.
   Subscribe to the `messages` field to receive delivery status callbacks.
5. If you run multiple businesses on one deployment and want each business
   to send from its own WhatsApp number, set `whatsapp_phone_number_id` on
   that business's row in the `businesses` table — it overrides the
   worker-wide default.

---

## 5. AI Setup

No separate API key is required. Cloudflare Workers AI is enabled via the
`[ai]` binding in `worker/wrangler.toml` and billed through your Cloudflare
account. Enable **Workers AI** for your account in the Cloudflare dashboard
if you haven't already. The model used is `@cf/meta/llama-3.1-8b-instruct`
at low temperature, and it is only ever given real numbers pulled live from
Postgres — see `worker/src/lib/ai.ts`.

---

## 6. Frontend Setup

```bash
cd web
cp .env.example .env.local   # fill in the three NEXT_PUBLIC_ values
npm install
npm run dev                   # local dev
npm run build && npm run start   # production build/run locally
```

Deploy `web/` to any Next.js-compatible host (Cloudflare Pages, Vercel,
etc.). Set the same three `NEXT_PUBLIC_*` variables as environment
variables in your hosting provider's dashboard.

---

## 7. Run / Test Commands

```bash
# Worker
cd worker && npm install
npm run typecheck
npm run dev            # local API at http://localhost:8787
npm run deploy         # deploy to Cloudflare

# Frontend
cd web && npm install
npm run lint
npm run typecheck
npm run build
npm run dev             # local UI at http://localhost:3000
```

---

## 8. Financial Safety Notes

- Every sale is written through the `create_sale()` Postgres function,
  which locks each product row, checks stock, computes totals server-side,
  and reduces stock — all inside one transaction. A sale can never
  partially apply.
- Every payment is written through `receive_payment()`, which applies the
  amount to the customer's oldest outstanding invoices first (FIFO), also
  inside one transaction.
- Tax is always calculated server-side from the business's own stored GST
  settings — the frontend can suggest a total, but the worker recomputes it
  before saving.
- `due_amount`, `current_due`, and profit are always derived live from
  `sales` / `payments` / `sale_items` — the app never stores a
  denormalized "customer balance" number that could silently drift.
- The AI assistant is only shown data pulled by the same SQL functions the
  Dashboard and Reports pages use, with an explicit system-prompt
  instruction never to invent figures, and every exchange is logged for
  audit in `ai_query_log`.
- A WhatsApp reminder is recorded as `sent` **only** when Meta's API
  response includes a message id. Everything else — timeouts, 4xx/5xx
  responses, missing phone numbers — is stored as `failed` with the actual
  error and retried automatically on the next hourly run, up to 5 attempts.

## 9. Known Limitations / Honest Notes

- Date-range filters (Today / 7 days / This month) currently use UTC day
  boundaries server-side. For a business that wants exact local-timezone
  "today", pass explicit `start`/`end` dates via the `custom` range instead.
- Multi-user businesses are supported at the schema level (`business_users`,
  `owner`/`staff` roles), but the current UI doesn't yet expose an "invite
  staff" screen — that's a natural next feature to add.
- WhatsApp reminders send once per calendar day per customer at the
  scheduled reminder day of the month; there's no "remind again after N
  days if still unpaid" recurrence yet, since the spec asked for a single
  reminder date per customer.
