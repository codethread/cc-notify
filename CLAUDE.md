# cc-notify

Local notification filter service. Bun + Effect.ts.

## Quick Reference

- **Run**: `bun run src/main.ts`
- **Type check**: `bunx tsc --noEmit`
- **Port**: auto-selected from 7777+, written to `$XDG_RUNTIME_DIR/cc-notify.port`
- **Logs**: `.logs/cc-notify.jsonl` (JSONL, append)
- **Config**: `PUSHOVER_CC_KEY`, `PUSHOVER_DEV_KEY` (env or `.env`)

## Architecture

- Uses Effect.ts throughout — services, layers, config, logging
- `src/main.ts` — entry point, layer composition
- `src/server.ts` — HTTP routes (`/notify`, `/activity`, `/health`)
- `src/services/` — `Pushover`, `NotificationManager`, `PortFinder`
- `src/config.ts` — config schema

## Docs

- [docs/overview.md](docs/overview.md) — project purpose and usage
- [docs/api-design.md](docs/api-design.md) — endpoint specs
