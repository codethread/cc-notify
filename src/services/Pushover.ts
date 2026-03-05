import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform"
import { Context, Effect, Layer, Redacted, Schema } from "effect"
import { PushoverConfig } from "../config.ts"

export interface PushoverMessage {
  readonly title: string
  readonly message: string
}

const PushoverResponse = Schema.Struct({
  status: Schema.Number,
  request: Schema.String,
})

export class PushoverError extends Schema.TaggedError<PushoverError>()(
  "PushoverError",
  { reason: Schema.String },
) {}

export class Pushover extends Context.Tag("Pushover")<
  Pushover,
  {
    readonly send: (
      msg: PushoverMessage,
    ) => Effect.Effect<void, PushoverError>
  }
>() {}

export const PushoverLive = Layer.effect(
  Pushover,
  Effect.gen(function* () {
    const config = yield* PushoverConfig
    const client = yield* HttpClient.HttpClient

    const send = (msg: PushoverMessage): Effect.Effect<void, PushoverError> =>
      Effect.gen(function* () {
        const response = yield* HttpClientRequest.post(
          "https://api.pushover.net/1/messages.json",
        ).pipe(
          HttpClientRequest.bodyUrlParams({
            token: Redacted.value(config.token),
            user: Redacted.value(config.user),
            title: msg.title,
            message: msg.message,
          }),
          client.execute,
          Effect.flatMap(HttpClientResponse.schemaBodyJson(PushoverResponse)),
          Effect.scoped,
        )

        if (response.status !== 1) {
          return yield* new PushoverError({
            reason: `Pushover API returned status ${response.status}`,
          })
        }

        yield* Effect.log("Pushover notification sent", {
          title: msg.title,
        })
      }).pipe(
        Effect.catchAllDefect((defect) =>
          new PushoverError({
            reason: `Unexpected error: ${String(defect)}`,
          }),
        ),
        Effect.catchAll((e) =>
          e._tag === "PushoverError"
            ? Effect.fail(e)
            : new PushoverError({ reason: `Request failed: ${e.message}` }),
        ),
      )

    return { send }
  }),
)
