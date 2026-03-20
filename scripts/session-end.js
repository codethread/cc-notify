#!/usr/bin/env node
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { log, readStdin, getPort, getStateDir, httpPost } from "./lib.js";

const TAG = "session-end";
log(TAG, `hook fired — TMUX_PANE=${process.env.TMUX_PANE || "<unset>"}`);

const port = getPort();
if (port) {
  const input = readStdin();
  if (input.session_id) {
    const code = await httpPost(port, "/activity", {
      session_id: input.session_id,
    });
    log(TAG, `cancelled timer — session=${input.session_id} http=${code}`);
  }
} else {
  log(TAG, "no port found, skipping cancel");
}

const tmuxPane = process.env.TMUX_PANE;
if (tmuxPane) {
  const stateFile = join(getStateDir(), `tmux-pane_${tmuxPane}.json`);
  if (existsSync(stateFile)) {
    unlinkSync(stateFile);
    log(TAG, `removed state file ${stateFile}`);
  }
}
