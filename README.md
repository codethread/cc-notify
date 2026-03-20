# cc-notify

Local notification filter for AI coding tools. Debounces notifications so you only get pinged when a tool is genuinely waiting for you — not when you're actively working.

## How it works

1. An AI tool (e.g. Claude Code) sends a notification request with a session ID
2. A 60-second timer starts
3. If activity is detected on that session within 60s, the notification is cancelled
4. If the terminal pane is focused (or regains focus), the notification is suppressed
5. If the timer expires with no activity or focus, a push notification is sent via [Pushover](https://pushover.net)

Focus tracking currently supports tmux, with the design open to other terminals. See [docs/focus-tracking.md](docs/focus-tracking.md) for details.

## Claude Code Plugin

This repo doubles as a Claude Code plugin. Once enabled, it automatically hooks into Stop, PermissionRequest, UserPromptSubmit, and SessionEnd events — no manual hook configuration needed.

Add to your `settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "cc-notify-marketplace": {
      "source": { "source": "github", "repo": "codethread/cc-notify" }
    }
  },
  "enabledPlugins": {
    "cc-notify@cc-notify-marketplace": true
  }
}
```

For tmux focus tracking, add this to your `tmux.conf`:

```
set-hook -g pane-focus-in 'run-shell "~/.claude/plugins/data/cc-notify-cc-notify-marketplace/tmux-focus.js"'
```

See [docs/focus-tracking.md](docs/focus-tracking.md) for how this works.

## Server Setup

Requires [Bun](https://bun.sh) and a [Pushover](https://pushover.net) account.

Set your Pushover credentials via environment variables or a `.env` file:

```sh
PUSHOVER_CC_KEY=<your pushover application token>
PUSHOVER_DEV_KEY=<your pushover user key>
```

Start the server:

```sh
bun run src/main.ts
```

The server picks an available port starting at 7777 and writes it to `$XDG_RUNTIME_DIR/cc-notify.port` for service discovery.

## API

All endpoints use `http://localhost:<port>`.

| Endpoint | Method | Description |
|---|---|---|
| `/notify` | POST | Schedule a notification (`title`, `session_id`, `message`) |
| `/activity` | POST | Cancel a pending notification (`session_id`) |
| `/toggle` | GET | Toggle notifications on/off |
| `/health` | GET | Health check |

### Example

```sh
PORT=$(cat "$XDG_RUNTIME_DIR/cc-notify.port")

# schedule a notification
curl -X POST "http://localhost:$PORT/notify" \
  -H 'Content-Type: application/json' \
  -d '{"title": "Task done", "session_id": "abc", "message": "Build complete"}'

# cancel it (user is active)
curl -X POST "http://localhost:$PORT/activity" \
  -H 'Content-Type: application/json' \
  -d '{"session_id": "abc"}'
```
