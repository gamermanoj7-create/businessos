# BusinessOS ERP — Phases 1–13

A multi-tenant business management ERP foundation with NestJS/PostgreSQL/Prisma backend, Android client foundation, offline-sync protocol, reporting, GST-aware invoicing, and an optional server-side AI assistant.

## Implemented scope

- Phase 1–4: architecture, Prisma/PostgreSQL, authentication, JWT refresh sessions, RBAC, tenant isolation, audit log
- Phase 5: products + categories
- Phase 6: inventory + stock movements + purchases
- Phase 7: customers + suppliers
- Phase 8: sales + GST split (CGST/SGST/IGST) + invoices + payments
- Phase 9: expenses + cash ledger + profit calculation
- Phase 10: dashboard + profit/loss + cash-flow reports
- Phase 11: Android Compose client foundation
- Phase 12: Room local storage + device registration + sync pull/push protocol
- Phase 13: persisted AI conversations + business-context AI assistant using the OpenAI Responses API

## Backend setup

Requirements: Node 20+, PostgreSQL 16+, npm.

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name phases-1-13
npm run prisma:seed
npm run start:dev
```

Swagger: `http://localhost:3000/docs`

All tenant APIs require `X-Business-Id` and a valid access token.

## Docker

From the parent directory:

```bash
docker compose up --build
```

For AI, export `OPENAI_API_KEY` in the environment. The backend keeps the API key server-side and uses the OpenAI Responses API; it is never placed in the Android app.

## Core API groups

- `/auth/*`
- `/categories`, `/products`
- `/inventory/*`
- `/customers`, `/suppliers`
- `/purchases`, `/sales`, `/invoices`, `/payments`
- `/expenses/*`
- `/reports/dashboard`, `/reports/profit-loss`, `/reports/cash-flow`
- `/sync/device`, `/sync/pull`, `/sync/push`
- `/ai/chat`, `/ai/conversations`

## Security

Tenant access is verified against BusinessMember on every tenant request. Client-supplied business IDs in bodies are not trusted. Passwords and refresh tokens are not stored in plaintext. AI keys are server-side only.

## Android

The `../android-app` project is a Compose/Room/Retrofit foundation. Configure the Retrofit base URL and add the Gradle wrapper through Android Studio/Gradle before building on a local Android SDK. The local Room layer is the persistence point for offline-first expansion.

## Verification status

This artifact was assembled and statically reviewed in the build environment. Full npm dependency installation, PostgreSQL migration execution, and Android SDK compilation could not be completed here because external package/SDK installation timed out. Do not treat this ZIP as independently verified production software until those commands pass in your environment.
