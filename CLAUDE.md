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

## Claude Code Plugin

This repo is also a Claude Code plugin (marketplace + plugin in one repo).

- `.claude-plugin/plugin.json` — plugin manifest
- `.claude-plugin/marketplace.json` — marketplace catalog
- `hooks/hooks.json` — hook definitions (Stop, PermissionRequest, UserPromptSubmit, SessionEnd)
- `scripts/notify.sh` — sends notification to cc-notify server
- `scripts/activity.sh` — cancels pending notification on user activity

Consumers reference via `extraKnownMarketplaces` pointing to `codethread/cc-notify`.

## Docs

- [docs/overview.md](docs/overview.md) — project purpose and usage
- [docs/api-design.md](docs/api-design.md) — endpoint specs
