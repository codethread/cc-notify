#!/usr/bin/env bun
import { log, readStdin, getPort, httpPost } from "./lib.js";

const TAG = "activity";
const port = getPort();
if (!port) {
  log(TAG, "no port found, exiting");
  process.exit(0);
}

const input = readStdin();
const code = await httpPost(port, "/activity", {
  session_id: input.session_id,
});
log(TAG, `cancelled — session=${input.session_id} http=${code}`);
