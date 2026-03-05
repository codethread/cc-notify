# API Design

Base URL: `http://localhost:<port>` (port from `$XDG_RUNTIME_DIR/cc-notify.port`)

## POST /notify

Schedule a notification. Starts a 60-second timer for the given session.

**Request body** (JSON):

```json
{
  "title": "string (required)",
  "session_id": "string (required)",
  "message": "string (required)"
}
```

**Response** (200):

```json
{
  "status": "scheduled",
  "session_id": "abc123"
}
```

If a timer already exists for the session, it is replaced.

## POST /activity

Cancel a pending notification. Clears the timer for the given session.

**Request body** (JSON):

```json
{
  "session_id": "string (required)"
}
```

**Response** (200):

```json
{
  "status": "cancelled",
  "session_id": "abc123"
}
```

No-op if no timer exists for the session.

## GET /health

Health check endpoint.

**Response** (200): `ok`
