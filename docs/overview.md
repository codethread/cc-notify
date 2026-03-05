# cc-notify

Local notification filter service for AI tools. Built with Bun + Effect.ts.

## Purpose

AI tools running locally generate notifications. This service acts as a debounce filter — it delays notifications by 60 seconds and cancels them if activity is detected within that window. Surviving notifications are forwarded via the Pushover API.

## How It Works

1. An AI tool sends a `POST /notify` with a session ID, title, and message
2. A 60-second timer starts for that session
3. If `POST /activity` arrives with the same session ID before the timer expires, the notification is cancelled
4. If the timer expires, a push notification is sent via Pushover

## Running

```sh
bun run src/main.ts
```

The server finds an available port starting at 7777 and writes it to `$XDG_RUNTIME_DIR/cc-notify.port` for service discovery.

## Configuration

Environment variables (via `.env` or global):

- `PUSHOVER_CC_KEY` — Pushover application token
- `PUSHOVER_DEV_KEY` — Pushover user key

## Logs

JSONL logs are appended to `.logs/cc-notify.jsonl`.
