# BusinessOS ERP — Integrated Phase 1–13

Single-project ERP foundation integrating backend, PostgreSQL/Prisma, Android app foundation, offline sync foundation, reporting/finance, and AI assistant foundation.

## Phases
- 1–4: Architecture, PostgreSQL/Prisma, authentication, JWT, RBAC, tenant isolation, audit
- 5: Products + Categories
- 6: Inventory + Stock
- 7: Customers + Suppliers
- 8: Sales + GST Invoice + Payments
- 9: Expenses + Cash Flow + Profit
- 10: Dashboard + Reports
- 11: Android Jetpack Compose application foundation
- 12: Room/offline sync + cloud sync foundation
- 13: AI Business Assistant foundation

## Structure
- `backend/` — NestJS + Prisma API and database schema
- `android/` — Android application foundation
- `docker-compose.yml` — local PostgreSQL support

## Important
This archive is an integrated source bundle. It has not been fully production-verified in this environment. Install dependencies, configure `.env`, run migrations/tests, and build the Android project before deployment.
