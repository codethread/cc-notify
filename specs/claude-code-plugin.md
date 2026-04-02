# Claude Code Plugin Specification

**Status:** Implemented
**Last Updated:** 2026-04-02

## 1. Overview

### Purpose

Claude Code plugin that delivers push notifications when the AI finishes work or needs permission approval. Hook scripts intercept Claude Code lifecycle events, check whether the user is already looking at the terminal, and forward notifications to the local cc-notify server for debounced delivery. A tmux integration cancels pending notifications when the user switches back to the pane.

### Goals

- Notify via Pushover on Stop and PermissionRequest events
- Suppress notifications when the user's terminal pane is focused
- Cancel pending notifications on user activity (prompt submit or pane focus)
- Distribute as a Claude Code plugin via marketplace manifest
- Persist hook scripts to a stable path so external tools (tmux hooks) survive plugin version updates

### Non-Goals

- No notification delivery — that is the server's responsibility (see `specs/notification-server.md`)
- No support for terminal multiplexers other than tmux
- No persistent state beyond the current session — state files are ephemeral
- No configuration UI — env vars and `tmux.conf` are the only configuration surfaces
- No hook payload transformation or filtering beyond what the scripts implement

## 2. Architecture

### Plugin Distribution

Two manifests define the plugin for Claude Code's package system:

| File | Purpose |
|---|---|
| `.claude-plugin/plugin.json` | Plugin identity: name (`cc-notify`), version (`1.3.0`), author, repo, license |
| `.claude-plugin/marketplace.json` | Marketplace catalog (`cc-notify-marketplace`) with single local plugin entry |

Consumers enable via `settings.json`:
```json
{
  "extraKnownMarketplaces": {
    "cc-notify-marketplace": {
      "source": { "source": "github", "repo": "codethread/cc-notify" }
    }
  },
  "enabledPlugins": { "cc-notify@cc-notify-marketplace": true }
}
```

### Hook Event Map

`hooks/hooks.json` maps Claude Code lifecycle events to scripts:

| Event | Script | Purpose |
|---|---|---|
| `SessionStart` | `session-start.js` | Install scripts to persistent data dir, write tmux pane→session mapping |
| `Stop` | `notify.js` | Check focus, schedule notification if user is away |
| `PermissionRequest` | `notify.js` | Check focus, schedule notification for tool approval |
| `UserPromptSubmit` | `activity.js` | Cancel pending notification (user is active) |
| `SessionEnd` | `session-end.js` | Cancel pending notification, remove pane state file |

All hooks invoke scripts via `bun "${CLAUDE_PLUGIN_ROOT}/scripts/<script>"`. Hook payloads arrive as JSON on stdin.

### Components

| File | Responsibility |
|---|---|
| `scripts/lib.js` | Shared helpers: logging, stdin parsing, port discovery, HTTP POST, shell exec, state dir |
| `scripts/notify.js` | Focus check + notification scheduling on Stop/PermissionRequest |
| `scripts/activity.js` | Notification cancellation on UserPromptSubmit |
| `scripts/session-start.js` | Script installation to persistent data dir + tmux pane mapping |
| `scripts/session-end.js` | Timer cancellation + state file cleanup |
| `scripts/tmux-focus.js` | Pane focus handler — cancels timers for all Claude sessions visible in current window |
| `scripts/package.json` | Package metadata (`cc-notify-hooks`, v1.3.0, ES module); `bin` entry exposes `cc-notify__tmux-focus` |

### Data Flow

```
Claude Code Event
  ↓
hooks/hooks.json → bun scripts/<handler>.js (stdin = JSON payload)
  ↓
scripts/lib.js::getPort() → reads $XDG_RUNTIME_DIR/cc-notify.port
  ↓
scripts/lib.js::httpPost(port, path, body) → POST to cc-notify server
```

## 3. Data Model

### Hook Payload (stdin)

Scripts receive JSON on stdin with fields varying by event:

```
Common:        { session_id, hook_event_name }
Stop:          + { cwd, last_assistant_message }
Permission:    + { cwd, tool_name, tool_input }
UserPrompt:    + { session_id }
SessionStart:  + { session_id }
SessionEnd:    + { session_id }
```

### HTTP Requests to Server

| Endpoint | Body | Sent by |
|---|---|---|
| `POST /notify` | `{ title, message, session_id }` | `notify.js` |
| `POST /activity` | `{ session_id }` | `activity.js`, `session-end.js`, `tmux-focus.js` |

### State Files

| Path | Content | Lifecycle |
|---|---|---|
| `$XDG_STATE_HOME/cc-notify/tmux-pane_${TMUX_PANE}.json` | Session ID (plain text + newline) | Created on SessionStart, deleted on SessionEnd |
| `$XDG_STATE_HOME/cc-notify/debug.log` | Append-only `[ISO_TIMESTAMP] [tag] msg` | Persists across sessions |

### Installed Scripts

| Path | Content | Lifecycle |
|---|---|---|
| `~/.claude/plugins/data/<plugin>-<marketplace>/package.json` | Package metadata | Copied on version change |
| `~/.claude/plugins/data/<plugin>-<marketplace>/lib.js` | Shared helpers | Copied on version change |
| `~/.claude/plugins/data/<plugin>-<marketplace>/tmux-focus.js` | Focus handler | Copied on version change |

Data dir is derived from `CLAUDE_PLUGIN_ROOT`: given `.../cache/<marketplace>/<plugin>/<version>`, the data dir is `.../data/<plugin>-<marketplace>`. This path is stable across plugin version updates.

### Environment Variables

| Variable | Source | Purpose |
|---|---|---|
| `CLAUDE_PLUGIN_ROOT` | Claude Code | Plugin version directory (changes per update) |
| `CLAUDE_PLUGIN_DATA` | Claude Code (optional) | Override for data dir derivation |
| `TMUX_PANE` | tmux | Current pane ID (e.g. `%0`) |
| `XDG_STATE_HOME` | System | State dir base (fallback: `~/.local/state`) |
| `XDG_RUNTIME_DIR` | System | Runtime dir for port sentinel (fallback: `/tmp`) |
| `CC_NOTIFY_PORT` | User (testing) | Override port discovery |
| `CC_NOTIFY_HOST` | User (testing) | Override HTTP host (default: `localhost`) |

## 4. Interfaces

### Shared Library (`scripts/lib.js`)

```
log(tag, msg)           → void        Append to debug.log
readStdin()             → object      Parse JSON from stdin, {} on failure
getPort()               → string|null Read port from sentinel or CC_NOTIFY_PORT
httpPost(port,path,body)→ Promise<number|null>  POST JSON, resolve status or null
exec(cmd)               → string|null execSync with UTF-8, null on failure
getStateDir()           → string      $XDG_STATE_HOME/cc-notify (creates if needed)
ensureDir(dir)          → void        Recursive mkdir
```

### Notification Messages (`notify.js`)

| Event | Title | Message |
|---|---|---|
| Stop | `Done · <project>` | First 120 chars of assistant message (ellipsis if truncated), or `"Claude has finished responding"` |
| PermissionRequest | `Permission · <project>` | Tool-specific: Bash→command preview, Write/Edit→filename, Read→filename, other→tool name; falls back to `"Claude is waiting for approval"` if tool name is empty |
| Default | `Attention · <project>` | `"Claude Code needs you"` |

Project name is `basename(cwd)` from hook payload.

### Focus Check (`notify.js`)

Runs before stdin is parsed. If `TMUX_PANE` is set:
```
tmux display-message -p -t "<pane>" "#{window_active}"
```
If result is `"1"` (window containing pane is active), skip notification entirely.

### Tmux Focus Handler (`tmux-focus.js`)

Triggered by tmux `pane-focus-in` hook. Lists all panes in the current window:
```
tmux list-panes -F "#{pane_id}"
```
For each pane with a state file, reads session ID and POSTs `/activity` to cancel.

User setup in `tmux.conf`:
```
set-hook -g pane-focus-in 'run-shell "~/.claude/plugins/data/cc-notify-cc-notify-marketplace/tmux-focus.js"'
```

## 5. Design Decisions

- **Two-layer focus suppression:** Notifications are suppressed at schedule time (is the pane focused right now?) and on focus gain (user returned within the timer window). This handles both "never left" and "left but came back" without polling.
- **Persistent data dir for external tools:** `CLAUDE_PLUGIN_ROOT` changes on every plugin version update. Scripts that external tools reference (tmux hooks) are copied to `~/.claude/plugins/data/` which survives updates. Version comparison avoids unnecessary copies.
- **Window-level cancellation on focus:** `tmux-focus.js` cancels timers for all Claude sessions visible in the focused window, not just the focused pane. This matches user intent — if you can see it, you don't need a notification about it.
- **Graceful degradation without tmux:** All tmux-specific logic is gated on `TMUX_PANE`. Without tmux, scripts skip focus checks and pane mapping. Notifications still work via the server's timer-based debounce.
- **Silent error handling:** All scripts exit 0 on errors (no port, no server, parse failures). Hook scripts must never block Claude Code's event loop. Errors are logged to the debug log for investigation.
- **Stdin-based payload:** Hook payloads arrive as JSON on stdin rather than CLI arguments. This avoids shell escaping issues with message content and keeps the hook definitions simple.

## 6. Testing

No automated tests. Manual testing via:
- Running the server (`bun run src/main.ts --fast`) and triggering hooks in a Claude Code session
- Inspecting `$XDG_STATE_HOME/cc-notify/debug.log` for script execution traces
- Verifying state file creation/cleanup in `$XDG_STATE_HOME/cc-notify/`

## 7. Open Questions

- Should focus tracking support other terminal multiplexers (Zellij, screen)?
- Should the plugin report health/version back to Claude Code via a standard mechanism?
- Should state file format be structured JSON instead of plain session ID text?
