#!/usr/bin/env bun
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { dirname, basename, join } from "path";
import { homedir } from "os";
import { log, readStdin, getStateDir, ensureDir } from "./lib.js";

const TAG = "session-start";
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

if (!pluginRoot) {
  log(TAG, "ERROR: CLAUDE_PLUGIN_ROOT not set");
  process.exit(0);
}

// Derive CLAUDE_PLUGIN_DATA from plugin root structure:
// ROOT = ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>
// DATA = ~/.claude/plugins/data/<plugin>-<marketplace>
let dataDir = process.env.CLAUDE_PLUGIN_DATA;
if (!dataDir) {
  const versionDir = pluginRoot;
  const pluginName = basename(dirname(versionDir));
  const marketplace = basename(dirname(dirname(versionDir)));
  dataDir = join(homedir(), ".claude", "plugins", "data", `${pluginName}-${marketplace}`);
}

log(TAG, `hook fired — root=${pluginRoot} data=${dataDir} TMUX_PANE=${process.env.TMUX_PANE || "<unset>"}`);

// --- Install scripts to data dir + npm link ---
try {
  ensureDir(dataDir);
  const srcPkg = join(pluginRoot, "scripts", "package.json");
  const dstPkg = join(dataDir, "package.json");

  let needsInstall = true;
  if (existsSync(dstPkg)) {
    const srcVersion = JSON.parse(readFileSync(srcPkg, "utf8")).version;
    const dstVersion = JSON.parse(readFileSync(dstPkg, "utf8")).version;
    needsInstall = srcVersion !== dstVersion;
    if (!needsInstall) log(TAG, `versions match (${srcVersion}), skipping install`);
  }

  if (needsInstall) {
    for (const file of ["package.json", "lib.js", "tmux-focus.js"]) {
      copyFileSync(join(pluginRoot, "scripts", file), join(dataDir, file));
    }
    log(TAG, "copied scripts to data dir");
  }
} catch (e) {
  log(TAG, `ERROR during install: ${e.message}`);
}

// --- Write tmux pane mapping ---
const tmuxPane = process.env.TMUX_PANE;
if (!tmuxPane) {
  log(TAG, "not in tmux, skipping pane mapping");
  process.exit(0);
}

const input = readStdin();
const sessionId = input.session_id;
if (!sessionId) {
  log(TAG, "ERROR: no session_id in stdin");
  process.exit(0);
}

const stateDir = getStateDir();
const stateFile = join(stateDir, `tmux-pane_${tmuxPane}.json`);
writeFileSync(stateFile, sessionId + "\n");
log(TAG, `wrote pane mapping ${tmuxPane} → ${sessionId}`);
