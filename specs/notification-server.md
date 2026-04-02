# Notification Server Specification

**Status:** Implemented
**Last Updated:** 2026-04-02

## 1. Overview

### Purpose

Local HTTP server that debounces notifications from AI coding tools. When a tool finishes work, it posts to `/notify`; the server starts a 60-second timer. If the user shows activity before the timer fires, the notification is cancelled. Otherwise, it sends a push notification via Pushover. This prevents notification spam when the user is already watching.

### Goals

- Debounce notifications per session with configurable delay
- Deliver via Pushover with credential redaction
- Auto-discover an available port and advertise it via sentinel file
- Structured dual logging (JSONL file + logfmt stderr)
- Pure Effect.ts dependency injection for all services

### Non-Goals

- No awareness of terminal focus or pane state — that is the plugin's responsibility
- No notification routing to providers other than Pushover
- No persistent storage — all state is in-memory (timers lost on restart)
- No authentication on HTTP endpoints (local-only service)
- No multi-user support — single Pushover credential pair

## 2. Architecture

Layer composition in `src/main.ts` builds the full app as a single Effect Layer stack:

```
ConfigLive            .env loading (PUSHOVER_CC_KEY, PUSHOVER_DEV_KEY)
  └─ LoggerLive       Dual: JSONL file + logfmt stderr
       └─ BunFileSystem
            └─ PortFinderLive    Probes 7777–7800, writes sentinel
                 └─ FetchHttpClient
                      └─ PushoverLive       HTTP client for pushover.net
                           └─ TimerDelayLive    60s (or 3s with --fast)
                                └─ NotificationManagerLive   Timer lifecycle
                                     └─ ServerLive           HTTP router
```

Each layer is an Effect Context.Tag. Dependencies flow downward — `ServerLive` (outermost) depends on everything below it.

### Components

| File | Responsibility |
|---|---|
| `src/main.ts` | Entry point, layer wiring, logger setup, CLI flag |
| `src/server.ts` | HTTP router with 4 routes |
| `src/config.ts` | PushoverConfig schema (redacted env vars) |
| `src/services/NotificationManager.ts` | Timer lifecycle via fibers + HashMap |
| `src/services/Pushover.ts` | Pushover API HTTP client |
| `src/services/PortFinder.ts` | Port probing + sentinel file |

### Data Flow

1. Client reads port from `$XDG_RUNTIME_DIR/cc-notify.port`
2. `POST /notify` → `NotificationManager.schedule()` → daemon fiber sleeps for delay
3. `POST /activity` → `NotificationManager.cancel()` → fiber interrupted
4. Timer expires → checks `enabled` ref → `Pushover.send()` → pushover.net API
5. `GET /toggle` → flips enabled state, sends test notification to verify Pushover

## 3. Data Model

### Configuration

```typescript
// src/config.ts
PushoverConfig = {
  token: Config.redacted("PUSHOVER_CC_KEY"),  // Redacted<string>
  user: Config.redacted("PUSHOVER_DEV_KEY"),  // Redacted<string>
}
```

### Request Schemas

```typescript
// src/server.ts
NotifyBody   = Schema.Struct({ title: Schema.String, session_id: Schema.String, message: Schema.String })
ActivityBody = Schema.Struct({ session_id: Schema.String })
```

### Internal State

```typescript
// src/services/NotificationManager.ts
timers:  Ref<HashMap<string, Fiber.RuntimeFiber<void, PushoverError>>>
enabled: Ref<boolean>  // starts true
```

### Context Tags

| Tag | Type | Source |
|---|---|---|
| `TimerDelay` | `Duration.Duration` | `Layer.succeed` (60s or 3s) |
| `NotificationManager` | `{ schedule, cancel, toggle }` | `NotificationManagerLive` |
| `Pushover` | `{ send }` | `PushoverLive` |
| `PortInfo` | `{ port: number }` | `PortFinderLive` |

### Error Types

| Error | Origin | HTTP Status |
|---|---|---|
| `ParseError` | Schema validation | 400 |
| `PushoverError` | Pushover API / network | 502 |

## 4. Interfaces

### HTTP API

| Route | Method | Request | Success Response | Error Response |
|---|---|---|---|---|
| `/notify` | POST | `{ title, session_id, message }` | 200 `{ status: "scheduled", session_id }` | 400 `{ status: "error", message }` |
| `/activity` | POST | `{ session_id }` | 200 `{ status: "cancelled", session_id }` | 400 `{ status: "error", message }` |
| `/toggle` | GET | — | 200 `{ status: "enabled" \| "disabled" }` | 502 `{ status: "error", message }` |
| `/health` | GET | — | 200 `"ok"` (text/plain) | — |

### Service Discovery

Port written to `$XDG_RUNTIME_DIR/cc-notify.port` (fallback: `/tmp/cc-notify.port`). File removed on shutdown via Effect finalizer.

### CLI

```
bun run src/main.ts          # 60s timer delay
bun run src/main.ts --fast   # 3s timer delay (development)
```

### Logging

- **File:** `.logs/cc-notify.jsonl` (JSON Lines via `Logger.jsonLogger`)
- **Stderr:** logfmt via `Logger.logfmtLogger`
- Log directory created on startup at `path.join(import.meta.dirname, "..", ".logs")`

## 5. Design Decisions

- **Fiber-per-timer:** Each scheduled notification is a daemon fiber stored in a HashMap keyed by session ID. Rescheduling the same session interrupts the previous fiber atomically via `Ref.modify`. This avoids race conditions without explicit locks.
- **Toggle sends test notification:** `toggle()` sends a Pushover message to verify credentials work. If the send fails, the toggle reverts — ensuring `enabled=true` always means "Pushover is reachable."
- **Port probing via Bun.serve:** PortFinder tests availability by actually starting and immediately stopping a Bun server on each candidate port. This is more reliable than socket probing because it matches the runtime's actual binding behavior.
- **Redacted credentials:** Config uses `Config.redacted()` so tokens never appear in logs or error messages, even if Effect's logger serializes the config.
- **Dual logging:** JSONL for machine consumption (log aggregation, debugging), logfmt to stderr for human observation during development. Both are added via scoped loggers so they clean up with the app.

## 6. Testing

No automated tests exist. The service is manually tested via curl against a running instance. The Effect.ts Context.Tag architecture makes unit testing straightforward — each service can be provided with test implementations.

## 7. Open Questions

- Should the server support notification channels beyond Pushover?
- Should timer state survive restarts (e.g. via SQLite)?
- Should there be rate limiting or max-timers-per-session guards?
