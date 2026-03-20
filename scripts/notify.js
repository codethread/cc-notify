#!/usr/bin/env bun
import { basename } from "path";
import { log, readStdin, getPort, httpPost, exec } from "./lib.js";

const TAG = "notify";
const port = getPort();
if (!port) {
  log(TAG, "no port found, exiting");
  process.exit(0);
}

const tmuxPane = process.env.TMUX_PANE;
if (tmuxPane) {
  // pane_active = selected pane in window, window_active = foreground window in client
  const active = exec(
    `tmux display-message -p -t "${tmuxPane}" "#{pane_active}#{window_active}"`,
  );
  if (active === "11") {
    log(TAG, `pane ${tmuxPane} is focused and window active, skipping`);
    process.exit(0);
  }
}

const input = readStdin();
const event = input.hook_event_name || "";
const sessionId = input.session_id || "";
const cwd = input.cwd || "";
const project = cwd ? basename(cwd) : "unknown";

log(TAG, `hook fired — event=${event} session=${sessionId}`);

let title, message;

if (event === "Stop") {
  title = `Done · ${project}`;
  const raw = input.last_assistant_message || "";
  const snippet = raw.replace(/\n/g, " ").replace(/\s+/g, " ").slice(0, 120);
  message = snippet ? (raw.length > 120 ? snippet + "…" : snippet) : "Claude has finished responding";
} else if (event === "PermissionRequest") {
  const tool = input.tool_name || "";
  let detail;
  if (tool === "Bash") {
    detail = `$ ${(input.tool_input?.command || "").slice(0, 100)}`;
  } else if (tool === "Write" || tool === "Edit") {
    detail = `${tool}: ${basename(input.tool_input?.file_path || "")}`;
  } else if (tool === "Read") {
    detail = `Read: ${basename(input.tool_input?.file_path || "")}`;
  } else {
    detail = tool;
  }
  title = `Permission · ${project}`;
  message = detail || "Claude is waiting for approval";
} else {
  title = `Attention · ${project}`;
  message = "Claude Code needs you";
}

const code = await httpPost(port, "/notify", {
  title,
  message,
  session_id: sessionId,
});
log(TAG, `scheduled — title='${title}' http=${code}`);
