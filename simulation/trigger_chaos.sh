#!/usr/bin/env bash
set -e

SCENARIO=${1:-oom}
CORE_URL=${CORE_URL:-"http://localhost:8000/api/v1"}

echo "⚡ [KINTSUGI CHAOS ENGINE] Triggering scenario: $SCENARIO"

case "$SCENARIO" in
  oom)
    echo "Spawning OOM container (64MB cgroup memory limit)..."
    if command -v docker &> /dev/null && docker info &> /dev/null; then
      docker build -t kintsugi/chaos-oom -f simulation/Dockerfile.oom simulation/
      docker run --rm -m 64m --name chaos-oom-worker kintsugi/chaos-oom || true
    else
      echo "Docker daemon not running in local subshell. Triggering via Kintsugi Core API..."
      curl -s -X POST "$CORE_URL/actions/simulate" \
        -H "Content-Type: application/json" \
        -d '{"scenario": "oom", "container_name": "prod-analytics-engine"}' | jq . || true
    fi
    ;;
  panic)
    echo "Spawning Unhandled Panic container..."
    if command -v docker &> /dev/null && docker info &> /dev/null; then
      docker build -t kintsugi/chaos-panic -f simulation/Dockerfile.panic simulation/
      docker run --rm --name chaos-panic-worker kintsugi/chaos-panic || true
    else
      echo "Triggering via Kintsugi Core API..."
      curl -s -X POST "$CORE_URL/actions/simulate" \
        -H "Content-Type: application/json" \
        -d '{"scenario": "panic", "container_name": "prod-auth-service"}' | jq . || true
    fi
    ;;
  flapping)
    echo "Simulating flapping crash loop (4 crashes in 15s)..."
    curl -s -X POST "$CORE_URL/actions/simulate" \
      -H "Content-Type: application/json" \
      -d '{"scenario": "flapping", "container_name": "prod-payment-worker"}' | jq . || true
    ;;
  segfault)
    echo "Simulating native segfault..."
    curl -s -X POST "$CORE_URL/actions/simulate" \
      -H "Content-Type: application/json" \
      -d '{"scenario": "segfault", "container_name": "prod-image-processor"}' | jq . || true
    ;;
  *)
    echo "Usage: $0 [oom | panic | flapping | segfault]"
    exit 1
    ;;
esac

echo "✅ Chaos event dispatched. Check Kintsugi Console for real-time recovery telemetry."
