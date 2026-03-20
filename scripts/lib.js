import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { request } from "http";
import { execSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

const stateHome =
  process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
const LOG_DIR = join(stateHome, "cc-notify");
mkdirSync(LOG_DIR, { recursive: true });
const LOG = join(LOG_DIR, "debug.log");

export function log(tag, msg) {
  const ts = new Date().toISOString();
  appendFileSync(LOG, `[${ts}] [${tag}] ${msg}\n`);
}

export function readStdin() {
  try {
    const raw = readFileSync(0, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getPort() {
  if (process.env.CC_NOTIFY_PORT) return process.env.CC_NOTIFY_PORT;
  const runtimeDir = process.env.XDG_RUNTIME_DIR || "/tmp";
  try {
    return readFileSync(join(runtimeDir, "cc-notify.port"), "utf8").trim();
  } catch {
    return null;
  }
}

export function httpPost(port, path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = request(
      {
        hostname: process.env.CC_NOTIFY_HOST || "localhost",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => resolve(res.statusCode),
    );
    req.on("error", () => resolve(null));
    req.write(data);
    req.end();
  });
}

export function exec(cmd) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

export function getStateDir() {
  const stateHome =
    process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  const dir = join(stateHome, "cc-notify");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}
