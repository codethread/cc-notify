import { FileSystem } from "@effect/platform"
import { Context, Effect, Layer } from "effect"
import * as path from "node:path"

const SENTINEL_PATH = path.join(
  process.env["XDG_RUNTIME_DIR"] ?? "/tmp",
  "cc-notify.port",
)

const PORT_START = 7777
const PORT_END = 7800

export class PortInfo extends Context.Tag("PortInfo")<
  PortInfo,
  { readonly port: number }
>() {}

export const PortFinderLive = Layer.scoped(
  PortInfo,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    let port = PORT_START
    while (port <= PORT_END) {
      const available = yield* Effect.sync(() => {
        try {
          const server = Bun.serve({
            port,
            fetch: () => new Response("probe"),
          })
          server.stop(true)
          return true
        } catch {
          return false
        }
      })

      if (available) {
        yield* fs.writeFileString(SENTINEL_PATH, String(port))
        yield* Effect.log(`Port sentinel written to ${SENTINEL_PATH}`, { port })

        yield* Effect.addFinalizer(() =>
          fs.remove(SENTINEL_PATH).pipe(
            Effect.tap(Effect.log(`Port sentinel removed: ${SENTINEL_PATH}`)),
            Effect.catchAll(() => Effect.void),
          ),
        )

        return { port }
      }

      port++
    }

    return yield* Effect.die(
      new Error(`No available port found in range ${PORT_START}-${PORT_END}`),
    )
  }),
)
