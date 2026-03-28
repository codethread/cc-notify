# Focus Tracking

## Problem

The notification timer is session-based: when Claude stops, a 60s timer starts, and only explicit activity (submitting a prompt, granting permission) cancels it. This misses a common case — the user is already looking at the pane when Claude finishes, or returns to it while composing a response. In both cases the user is present and a notification is noise.

## Design

Focus tracking adds a second cancellation signal: **terminal focus state**. If the user is focused on the pane running Claude, notifications are suppressed.

Two integration points:

1. **At schedule time** — before starting the timer, check if the pane is currently focused. If so, skip scheduling entirely. This handles "I never left."
2. **On focus gain** — when the user focuses the pane, cancel any pending timer for that session. This handles "I left but came back."

Both require a mapping from terminal pane to Claude session ID. This mapping is written to `$XDG_STATE_HOME/cc-notify/` on session start and cleaned up on session end.

### Script installation

The plugin's source scripts live in `CLAUDE_PLUGIN_ROOT`, which changes on every plugin version update. To provide stable paths for external tools (e.g. tmux config), the SessionStart hook copies externally-needed scripts to `~/.claude/plugins/data/cc-notify-cc-notify-marketplace/`, which persists across updates.

### State files

Each running Claude session inside a supported terminal writes a state file:

```
$XDG_STATE_HOME/cc-notify/<tool-prefix>_<pane-id>.json
```

The file contains the session ID (plain text, one line). The file is removed on session end.

### Scenarios

| Scenario | Timer scheduled? | Notification sent? |
|---|---|---|
| Claude stops, user is focused | No (focus check) | No |
| Claude stops, user is away | Yes | Yes (after 60s) |
| Claude stops, user is away, returns within 60s | Yes | No (cancelled on focus) |
| Claude stops, user is away, returns after 60s | Yes | Yes (already sent) |
| No terminal integration available | Yes (fallback) | Yes (current behaviour) |

## Implementations

### tmux

State file prefix: `tmux-pane_`

**SessionStart hook** (`scripts/session-start.js`):
- Copies `tmux-focus.js` and `lib.js` to the plugin data dir (stable path)
- If `$TMUX_PANE` is set, writes session ID to `$XDG_STATE_HOME/cc-notify/tmux-pane_${TMUX_PANE}.json`

**notify.js focus check**:
- If `$TMUX_PANE` is set, queries `#{pane_active}` via `tmux display-message`
- Exits early if the pane is active

**tmux pane-focus-in** (`scripts/tmux-focus.js`):
- Lists all panes in the current window via `tmux list-panes`
- For each pane with a state file, reads the session ID and posts `/activity`
- This ensures switching between splits in the same window cancels notifications for all visible Claude sessions

**SessionEnd hook** (`scripts/session-end.js`):
- Posts `/activity` to cancel any pending timer
- Removes the state file if `$TMUX_PANE` is set

#### Setup

Scripts are copied to the plugin data dir automatically on first session. Add to `tmux.conf`:

```
set-hook -g pane-focus-in 'run-shell "~/.claude/plugins/data/cc-notify-cc-notify-marketplace/tmux-focus.js"'
```
