import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { Effect, Schema } from "effect"
import { NotificationManager } from "./services/NotificationManager.ts"

const NotifyBody = Schema.Struct({
  title: Schema.String,
  session_id: Schema.String,
  message: Schema.String,
})

const ActivityBody = Schema.Struct({
  session_id: Schema.String,
})

const notifyHandler = Effect.gen(function* () {
  const body = yield* HttpServerRequest.schemaBodyJson(NotifyBody)
  const manager = yield* NotificationManager

  yield* manager.schedule(body.session_id, body.title, body.message)

  return yield* HttpServerResponse.json({ status: "scheduled", session_id: body.session_id })
}).pipe(
  Effect.catchTag("ParseError", (e) =>
    Effect.gen(function* () {
      yield* Effect.logWarning("Invalid /notify request", { error: e.message })
      return yield* HttpServerResponse.json(
        { status: "error", message: e.message },
        { status: 400 },
      )
    }),
  ),
)

const activityHandler = Effect.gen(function* () {
  const body = yield* HttpServerRequest.schemaBodyJson(ActivityBody)
  const manager = yield* NotificationManager

  yield* manager.cancel(body.session_id)

  return yield* HttpServerResponse.json({ status: "cancelled", session_id: body.session_id })
}).pipe(
  Effect.catchTag("ParseError", (e) =>
    Effect.gen(function* () {
      yield* Effect.logWarning("Invalid /activity request", { error: e.message })
      return yield* HttpServerResponse.json(
        { status: "error", message: e.message },
        { status: 400 },
      )
    }),
  ),
)

export const router = HttpRouter.empty.pipe(
  HttpRouter.post("/notify", notifyHandler),
  HttpRouter.post("/activity", activityHandler),
  HttpRouter.get("/health", HttpServerResponse.text("ok")),
)
