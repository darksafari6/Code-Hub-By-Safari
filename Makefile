# Convenience targets for the Linux-native runtime.
SHELL := /bin/bash
VENV  := .venv
PY    := $(VENV)/bin/python

.PHONY: help install dev run build test test-python test-ui typecheck lint clean desktop package

help:
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Create .venv and install Python + frontend dependencies
	./scripts/install.sh

dev: ## Run the Python API and the Vite dev server together
	./scripts/dev.sh

run: ## Build the UI and serve everything from the Python server
	./scripts/run.sh

build: ## Build the static frontend bundle
	npm run build

test: ## All tests (pytest + vitest + typecheck)
	./scripts/test.sh

test-python: ## Python tests only
	PYTHONPATH=python $(PY) -m pytest python/tests

test-ui: ## Frontend tests only
	npm run test

typecheck: ## TypeScript type check
	npm run typecheck

lint: ## Python lint (ruff)
	$(VENV)/bin/pip install -q ruff && $(VENV)/bin/ruff check python

package: ## Build the portable Linux bundle in dist-linux/
	./scripts/package-linux.sh

clean: ## Remove build output and caches
	rm -rf dist dist-server release dist-linux build .pytest_cache python/.pytest_cache
