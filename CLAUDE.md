# cc-notify

Local notification filter service. Bun + Effect.ts.

## Quick Reference

- **Run**: `bun run src/main.ts`
- **Type check**: `bunx tsc --noEmit`
- **Port**: auto-selected from 7777+, written to `$XDG_RUNTIME_DIR/cc-notify.port`
- **Logs**: `.logs/cc-notify.jsonl` (JSONL, append)
- **Config**: `PUSHOVER_CC_KEY`, `PUSHOVER_DEV_KEY` (env or `.env`)

## Claude Code Plugin

This repo is also a Claude Code plugin (marketplace + plugin in one repo).

- `.claude-plugin/plugin.json` — plugin manifest
- `.claude-plugin/marketplace.json` — marketplace catalog
- `hooks/hooks.json` — hook definitions (SessionStart, Stop, PermissionRequest, UserPromptSubmit, SessionEnd)
- `scripts/lib.js` — shared helpers (logging, HTTP, port/state discovery)
- `scripts/notify.js` — sends notification (skips if terminal pane is focused)
- `scripts/activity.js` — cancels pending notification on user activity
- `scripts/session-start.js` — copies focus scripts to plugin data dir, writes pane mapping
- `scripts/session-end.js` — cancels notification + cleans up focus state file
- `scripts/tmux-focus.js` — cancels notification on tmux pane focus
- Hook debug logs: `$XDG_STATE_HOME/cc-notify/debug.log`

Consumers reference via `extraKnownMarketplaces` pointing to `codethread/cc-notify`.

## Docs

- [specs/notification-server.md](specs/notification-server.md) — server architecture, API, services
- [docs/focus-tracking.md](docs/focus-tracking.md) — focus-aware notification suppression
