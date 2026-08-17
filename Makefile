.PHONY: all test test-core test-sentinel build-console dev dev-core dev-sentinel dev-console compose-up compose-down chaos-oom chaos-panic chaos-flapping

all: test

# --- Testing Targets ---
test: test-core test-sentinel build-console

test-core:
	@echo "==> Running Kintsugi Core Tests (Python)..."
	@cd core && .venv/bin/pytest tests -v

test-sentinel:
	@echo "==> Running Kintsugi Sentinel Tests (Go)..."
	@cd sentinel && go test -v ./...

build-console:
	@echo "==> Building Kintsugi Console Bundle (React 19)..."
	@cd console && npm run build

# --- Local Development ---
dev-core:
	@cd core && .venv/bin/uvicorn app.main:app --reload --port 8000

dev-sentinel:
	@cd sentinel && go run cmd/sentinel/main.go

dev-console:
	@cd console && npm run dev

# --- Docker Compose ---
compose-up:
	docker compose up --build -d

compose-down:
	docker compose down

# --- Chaos Injections ---
chaos-oom:
	./simulation/trigger_chaos.sh oom

chaos-panic:
	./simulation/trigger_chaos.sh panic

chaos-flapping:
	./simulation/trigger_chaos.sh flapping

chaos-segfault:
	./simulation/trigger_chaos.sh segfault
