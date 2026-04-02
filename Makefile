.DEFAULT_GOAL := start

install:
	bun install

build: install
	bunx tsc --noEmit

start: build
	bun run src/main.ts

.PHONY: install build start
