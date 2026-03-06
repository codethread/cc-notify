import { Context, Duration, Effect, Fiber, HashMap, Layer, Ref } from "effect"
import { Pushover, type PushoverError } from "./Pushover.ts"

export class TimerDelay extends Context.Tag("TimerDelay")<
  TimerDelay,
  Duration.Duration
>() {}

export class NotificationManager extends Context.Tag("NotificationManager")<
  NotificationManager,
  {
    readonly schedule: (
      sessionId: string,
      title: string,
      message: string,
    ) => Effect.Effect<void, PushoverError>
    readonly cancel: (sessionId: string) => Effect.Effect<void>
    readonly toggle: () => Effect.Effect<boolean, PushoverError>
  }
>() {}

export const NotificationManagerLive = Layer.effect(
  NotificationManager,
  Effect.gen(function* () {
    const pushover = yield* Pushover
    const delay = yield* TimerDelay
    const timers = yield* Ref.make(HashMap.empty<string, Fiber.RuntimeFiber<void, PushoverError>>())
    const enabled = yield* Ref.make(true)

    return {
      schedule: (sessionId, title, message) =>
        Effect.gen(function* () {
          const fiber = yield* Effect.sleep(delay).pipe(
            Effect.andThen(
              Effect.gen(function* () {
                const isEnabled = yield* Ref.get(enabled)
                if (!isEnabled) {
                  yield* Effect.log("Notifications disabled, skipping", { sessionId, title })
                  return
                }
                yield* Effect.log("Timer expired, sending notification", {
                  sessionId,
                  title,
                })
                yield* pushover.send({ title, message })
              }),
            ),
            Effect.catchAll((error) =>
              Effect.logError("Notification failed", {
                sessionId,
                error: error.reason,
              }),
            ),
            Effect.ensuring(
              Ref.update(timers, HashMap.remove(sessionId)),
            ),
            Effect.forkDaemon,
          )

          // Atomically swap in the new fiber and retrieve the old one
          const previous = yield* Ref.modify(timers, (map) => {
            const existing = HashMap.get(map, sessionId)
            return [existing, HashMap.set(map, sessionId, fiber)] as const
          })

          if (previous._tag === "Some") {
            yield* Fiber.interrupt(previous.value)
            yield* Effect.log("Previous timer replaced", { sessionId })
          }

          yield* Effect.log("Timer started", { sessionId, title })
        }),

      cancel: (sessionId) =>
        Effect.gen(function* () {
          const existing = yield* Ref.modify(timers, (map) => {
            const fiber = HashMap.get(map, sessionId)
            return [fiber, HashMap.remove(map, sessionId)] as const
          })

          if (existing._tag === "Some") {
            yield* Fiber.interrupt(existing.value)
            yield* Effect.log("Timer cancelled", { sessionId })
          }
        }),

      toggle: () =>
        Effect.gen(function* () {
          const next = yield* Ref.updateAndGet(enabled, (v) => !v)
          const status = next ? "enabled" : "disabled"
          yield* pushover.send({
            title: "cc-notify",
            message: `Notifications ${status}`,
          }).pipe(
            Effect.tapError(() => Ref.set(enabled, !next)),
          )
          yield* Effect.log("Notifications toggled", { enabled: next })
          return next
        }),
    }
  }),
)
