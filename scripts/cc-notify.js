#!/usr/bin/env bun

import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { stdin } from "node:process"

const usage = `Usage: cc-notify [--session-id ID] [--at TIMESTAMP | --after DURATION] <title>

Send a notification request to the local cc-notify service.

Examples:
  cc-notify "Build done"
  echo "body message" | cc-notify "Title"
  cc-notify --after 2s "Short timer"
  cc-notify --after 4h "Later today"
  cc-notify --at "2026-06-14 17:30" "At a specific time"
  cc-notify --session-id my-job "Title" < message.txt
`

const durationPattern = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/
const durationUnits = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

function parseDuration(value) {
  const match = durationPattern.exec(value)
  if (!match) {
    throw new Error(`Invalid --after duration: ${value}. Expected formats like 2s, 4h, 1d.`)
  }

  return Number(match[1]) * durationUnits[match[2]]
}

function parseTimestamp(value) {
  if (/^\d+$/.test(value)) {
    const numeric = Number(value)
    return numeric < 10_000_000_000 ? numeric * 1_000 : numeric
  }

  const millis = Date.parse(value)
  if (Number.isNaN(millis)) {
    throw new Error(`Invalid --at timestamp: ${value}`)
  }
  return millis
}

function parseArgs(args) {
  let sessionId
  let notifyAt
  const positionals = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === "-h" || arg === "--help") {
      console.log(usage)
      process.exit(0)
    }

    if (arg === "--session-id") {
      const value = args[++i]
      if (!value) {
        throw new Error("--session-id requires a value")
      }
      sessionId = value
      continue
    }

    if (arg.startsWith("--session-id=")) {
      sessionId = arg.slice("--session-id=".length)
      if (!sessionId) {
        throw new Error("--session-id requires a value")
      }
      continue
    }

    if (arg === "--at") {
      const value = args[++i]
      if (!value) {
        throw new Error("--at requires a value")
      }
      if (notifyAt !== undefined) {
        throw new Error("Use only one of --at or --after")
      }
      notifyAt = parseTimestamp(value)
      continue
    }

    if (arg.startsWith("--at=")) {
      const value = arg.slice("--at=".length)
      if (!value) {
        throw new Error("--at requires a value")
      }
      if (notifyAt !== undefined) {
        throw new Error("Use only one of --at or --after")
      }
      notifyAt = parseTimestamp(value)
      continue
    }

    if (arg === "--after") {
      const value = args[++i]
      if (!value) {
        throw new Error("--after requires a value")
      }
      if (notifyAt !== undefined) {
        throw new Error("Use only one of --at or --after")
      }
      notifyAt = Date.now() + parseDuration(value)
      continue
    }

    if (arg.startsWith("--after=")) {
      const value = arg.slice("--after=".length)
      if (!value) {
        throw new Error("--after requires a value")
      }
      if (notifyAt !== undefined) {
        throw new Error("Use only one of --at or --after")
      }
      notifyAt = Date.now() + parseDuration(value)
      continue
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`)
    }

    positionals.push(arg)
  }

  if (positionals.length !== 1) {
    throw new Error("Expected exactly one title argument")
  }

  return { title: positionals[0], sessionId: sessionId ?? `cli-${randomUUID()}`, notifyAt }
}

async function readStdinMessage() {
  if (stdin.isTTY) {
    return ""
  }

  const chunks = []
  for await (const chunk of stdin) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString("utf8").trimEnd()
}

function readPort() {
  const portPath = join(
    process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"),
    "cc-notify",
    "port",
  )

  if (!existsSync(portPath)) {
    throw new Error(`Could not find cc-notify port file (${portPath})`)
  }

  const port = readFileSync(portPath, "utf8").trim()
  if (!/^\d+$/.test(port)) {
    throw new Error(`Invalid port file contents at ${portPath}: ${JSON.stringify(port)}`)
  }
  return Number(port)
}

try {
  const { title, sessionId, notifyAt } = parseArgs(process.argv.slice(2))
  const stdinMessage = await readStdinMessage()
  const message = stdinMessage === "" ? title : stdinMessage
  const port = readPort()

  const response = await fetch(`http://localhost:${port}/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, session_id: sessionId, message, notify_at: notifyAt }),
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`cc-notify returned HTTP ${response.status}: ${body}`)
  }

  console.log(body)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  console.error(usage)
  process.exit(1)
}
