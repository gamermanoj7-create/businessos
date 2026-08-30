# BusinessOS ERP — Phases 5–13 delivery manifest

## Backend
- Catalog: categories/products
- Inventory: stock ledger, adjustments, purchase receipts
- Contacts: customers/suppliers
- Commerce: purchases, sales, GST invoice split, payments
- Finance: expenses, cash entries
- Reports: dashboard, profit/loss, cash flow
- Sync: device registration, pull/push change protocol
- AI: persisted conversations and server-side OpenAI Responses integration

## Android
- Jetpack Compose shell
- Room local database
- DataStore auth/business state
- Retrofit API layer
- Sync outbox model + WorkManager worker foundation

## Deployment
- Backend Dockerfile
- PostgreSQL + backend Docker Compose
- Cloud deployment guidance

## Verification limitation
Full dependency installation and platform builds were not completed in this environment. The artifact is source-complete for the listed phases but still requires local/CI dependency installation, database migration, backend tests, and Android SDK compilation before production deployment.
