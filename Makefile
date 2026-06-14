.DEFAULT_GOAL := start

HOME_BIN := $(HOME)/.local/bin
CC_NOTIFY_BIN_DIR ?= $(HOME_BIN)

install:
	bun install

build: install
	bunx tsc --noEmit

local: install
	mkdir -p $(HOME_BIN)
	ln -sf $(abspath scripts/cc-notify.js) $(HOME_BIN)/cc-notify

link-bin: install
	mkdir -p $(CC_NOTIFY_BIN_DIR)
	ln -sf $(abspath scripts/cc-notify.js) $(CC_NOTIFY_BIN_DIR)/cc-notify

start: build
	bun run src/main.ts

.PHONY: install build local link-bin start
