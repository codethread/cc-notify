# cc-notify

Local notification filter service. Bun + Effect.ts.

## Quick Reference

- **Run**: `bun run src/main.ts`
- **Type check**: `bunx tsc --noEmit`
- **Port**: auto-selected from 7777+, written to `$XDG_RUNTIME_DIR/cc-notify.port`
- **Logs**: `.logs/cc-notify.jsonl` (JSONL, append)
- **Config**: `PUSHOVER_CC_KEY`, `PUSHOVER_DEV_KEY` (env or `.env`)

## Claude Code Plugin

This repo is also a Claude Code plugin. See [specs/claude-code-plugin.md](specs/claude-code-plugin.md) for architecture.

- Hook debug logs: `$XDG_STATE_HOME/cc-notify/debug.log`

## Docs

- [specs/notification-server.md](specs/notification-server.md) — server architecture, API, services
- [specs/claude-code-plugin.md](specs/claude-code-plugin.md) — hook scripts, focus tracking, plugin distribution
