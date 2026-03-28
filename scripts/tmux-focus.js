#!/usr/bin/env bun
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { log, getPort, getStateDir, httpPost, exec } from "./lib.js";

const TAG = "tmux-focus";

const port = getPort();
if (!port) {
  log(TAG, "no port found, exiting");
  process.exit(0);
}

// Get all pane IDs in the currently active window
const paneList = exec('tmux list-panes -F "#{pane_id}"');
if (!paneList) {
  log(TAG, "no panes found, exiting");
  process.exit(0);
}

const stateDir = getStateDir();
const paneIds = paneList.split("\n").filter(Boolean);

for (const paneId of paneIds) {
  const stateFile = join(stateDir, `tmux-pane_${paneId}.json`);
  if (!existsSync(stateFile)) continue;

  const sessionId = readFileSync(stateFile, "utf8").trim();
  if (!sessionId) continue;

  const code = await httpPost(port, "/activity", { session_id: sessionId });
  log(TAG, `focus cancel — pane=${paneId} session=${sessionId} http=${code}`);
}
