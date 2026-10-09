# cc-notify

Local notification filter for AI coding tools. Debounces notifications so you only get pinged when a tool is genuinely waiting for you — not when you're actively working.

## How it works

1. An AI tool (e.g. Claude Code) sends a notification request with a session ID
2. A 60-second timer starts
3. If activity is detected on that session within 60s, the notification is cancelled
4. If the timer expires with no activity, a push notification is sent via [Pushover](https://pushover.net)

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

The server picks an available port starting at 7777 and writes it to `$XDG_STATE_HOME/cc-notify/port` for service discovery (falling back to `~/.local/state/cc-notify/port`).

## API

All endpoints use `http://localhost:<port>`.

| Endpoint | Method | Description |
|---|---|---|
| `/notify` | POST | Schedule a notification (`title`, `session_id`, `message`, optional `notify_at` epoch milliseconds) |
| `/activity` | POST | Cancel a pending notification (`session_id`) |
| `/toggle` | GET | Toggle notifications on/off |
| `/health` | GET | Health check |

### Example

```sh
PORT=$(cat "${XDG_STATE_HOME:-$HOME/.local/state}/cc-notify/port")

# schedule a notification
curl -X POST "http://localhost:$PORT/notify" \
  -H 'Content-Type: application/json' \
  -d '{"title": "Task done", "session_id": "abc", "message": "Build complete"}'

# schedule for a specific time from the CLI
echo "Build complete" | cc-notify --after 4h "Task done"
echo "Build complete" | cc-notify --at "2026-06-14 17:30" "Task done"

# cancel it (user is active)
curl -X POST "http://localhost:$PORT/activity" \
  -H 'Content-Type: application/json' \
  -d '{"session_id": "abc"}'
```
