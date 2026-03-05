import { HttpServer } from "@effect/platform"
import {
  BunHttpServer,
  BunRuntime,
  BunFileSystem,
} from "@effect/platform-bun"
import { FileSystem, PlatformConfigProvider, PlatformLogger } from "@effect/platform"
import { FetchHttpClient } from "@effect/platform"
import { Duration, Effect, Layer, Logger } from "effect"
import { router } from "./server.ts"
import { PushoverLive } from "./services/Pushover.ts"
import { NotificationManagerLive } from "./services/NotificationManager.ts"
import { PortFinderLive, PortInfo } from "./services/PortFinder.ts"
import { TimerDelay } from "./services/NotificationManager.ts"
import * as path from "node:path"

const fast = process.argv.includes("--fast")
const TimerDelayLive = Layer.succeed(TimerDelay, fast ? Duration.seconds(3) : Duration.seconds(60))

const logsDir = path.join(import.meta.dirname ?? ".", "..", ".logs")

const EnsureLogsDir = Layer.scopedDiscard(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(logsDir, { recursive: true })
  }),
)

const FileLoggerLive = Logger.replaceScoped(
  Logger.defaultLogger,
  Logger.jsonLogger.pipe(
    PlatformLogger.toFile(path.join(logsDir, "cc-notify.jsonl")),
  ),
).pipe(
  Layer.provide(EnsureLogsDir),
  Layer.provide(BunFileSystem.layer),
)

const LoggerLive = Layer.mergeAll(
  FileLoggerLive,
  Logger.addScoped(
    Logger.logfmtLogger.pipe(
      PlatformLogger.toFile("/dev/stderr"),
    ),
  ).pipe(Layer.provide(BunFileSystem.layer)),
)

const ConfigLive = PlatformConfigProvider.layerDotEnvAdd(".env").pipe(
  Layer.provide(BunFileSystem.layer),
)

const ServerLive = Layer.unwrapScoped(
  Effect.gen(function* () {
    const { port } = yield* PortInfo
    if (fast) yield* Effect.log("Fast mode enabled (3s timer)")

    return router.pipe(
      HttpServer.serve(),
      HttpServer.withLogAddress,
      Layer.provide(BunHttpServer.layer({ port })),
    )
  }),
)

const AppLive = ServerLive.pipe(
  Layer.provide(NotificationManagerLive),
  Layer.provide(TimerDelayLive),
  Layer.provide(PushoverLive),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(PortFinderLive),
  Layer.provide(BunFileSystem.layer),
  Layer.provide(LoggerLive),
  Layer.provide(ConfigLive),
)

BunRuntime.runMain(Layer.launch(AppLive))
