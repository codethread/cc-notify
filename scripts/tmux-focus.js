#!/usr/bin/env bun
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { log, getPort, getStateDir, httpPost, exec } from "./lib.js";

const TAG = "tmux-focus";

const paneId = exec('tmux display-message -p "#{pane_id}"');
if (!paneId) {
  log(TAG, "no pane_id, exiting");
  process.exit(0);
}

const stateFile = join(getStateDir(), `tmux-pane_${paneId}.json`);
if (!existsSync(stateFile)) {
  log(TAG, `no state file for pane ${paneId}`);
  process.exit(0);
}

const sessionId = readFileSync(stateFile, "utf8").trim();
if (!sessionId) {
  log(TAG, `empty session_id in ${stateFile}`);
  process.exit(0);
}

const port = getPort();
if (!port) {
  log(TAG, "no port found, exiting");
  process.exit(0);
}

const code = await httpPost(port, "/activity", { session_id: sessionId });
log(TAG, `focus cancel — pane=${paneId} session=${sessionId} http=${code}`);
