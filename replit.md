# SignalX AI

A real-time crypto market scanner that records rule-confirmed signals across Binance markets and explains the indicators behind each one.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/signalx-ai run dev` — run the web dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/signalx-ai/` — scanner dashboard
- `artifacts/api-server/src/lib/signalx-scanner.ts` — market-data fetching, indicator calculations, and scheduled scans
- `artifacts/api-server/src/routes/signalx.ts` — scanner status and manual-scan API
- `lib/db/src/schema/signalx-signals.ts` — persisted signal records
- `lib/api-spec/openapi.yaml` — API contract and generated client source

## Architecture decisions

- Binance public 1-minute candles are aggregated into 2-minute candles for the existing short-timeframe strategy.
- Signals are recorded only when the configured indicator rules pass; never seed or display fabricated BUY/SELL examples.
- Telegram alerts are optional and only sent when a bot token is configured through environment secrets.
- Signal results remain `PENDING`; the app does not imply or calculate historical trading accuracy.

## Product

- The dashboard shows scanner health, configuration, latest persisted signals, indicator confirmations, and a manual scan action.
- The scanner checks nine configured Binance markets on a 60-second schedule by default and keeps recent signals in PostgreSQL.
- SignalX AI provides educational market analysis, not financial advice or profit guarantees.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Telegram is not configured by default; without `TELEGRAM_BOT_TOKEN`, signals still appear in the dashboard but no alerts are sent.
- Do not change the scanner to seed sample signals or present pending results as wins/losses.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
