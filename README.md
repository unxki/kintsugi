# Kintsugi: Autonomous AIOps & Self-Healing Cloud Runtime

<div align="center">

```
  ██╗  ██╗██╗███╗   ██╗████████╗███████╗██╗   ██╗ ██████╗ ██╗
  ██║ ██╔╝██║████╗  ██║╚══██╔══╝██╔════╝██║   ██║██╔════╝ ██║
  █████═╝ ██║██╔██╗ ██║   ██║   ███████╗██║   ██║██║  ███╗██║
  ██╔═██╗ ██║██║╚██╗██║   ██║   ╚════██║██║   ██║██║   ██║██║
  ██║ ╚██╗██║██║ ╚████║   ██║   ███████║╚██████╔╝╚██████╔╝██║
  ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝
```

**Autonomous Incident Response, Semantic Diagnostic Memory & Microservice Self-Healing Mesh**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/Core-FastAPI%20%26%20Python%203.12+-009688.svg)](https://fastapi.tiangolo.com)
[![Go Sentinel](https://img.shields.io/badge/Sentinel-Go%201.22+-00ADD8.svg)](https://golang.org)
[![React Console](https://img.shields.io/badge/Console-React%2019%20%26%20Vite-61DAFB.svg)](https://react.dev)
[![pgvector](https://img.shields.io/badge/Memory-PostgreSQL%20%2B%20pgvector-336791.svg)](https://github.com/pgvector/pgvector)

</div>

---

## Overview

**Kintsugi** is an enterprise-grade autonomous Site Reliability Engineering (AIOps) system that monitors Docker and Kubernetes container runtimes, intercepts failures in real-time, strips sensitive PII/credentials at the edge, vectors error traces against historical incident memory using `pgvector`, and dispatches self-healing remediation pipelines in milliseconds.

Named after the Japanese philosophy of repairing broken pottery with precious metals (*Kintsugi*), the platform treats production failures as opportunities for architectural resilience and autonomous recovery.

---

## Architecture

```mermaid
flowchart TB
    %% Edge Layer
    subgraph EDGE["Edge & Host Layer"]
        direction TB
        RUNTIME["Docker Engine / Container Runtime"]
        
        subgraph SENTINEL["Go Sentinel Daemon"]
            direction TB
            EVENT_STREAM["Docker Socket Event Stream"]
            SANITIZER["Zero Data-Leak Sanitizer<br/><i>Regex & Entropy Redactor</i>"]
            GUARDRAIL["Flapping Guardrail<br/><i>Sliding Window Circuit Breaker</i>"]
            EXECUTOR["Remediation Executor<br/><i>Restart / Kill / Rollback / Prune</i>"]
        end
    end

    %% Control Plane
    subgraph CORE["Control Plane (FastAPI)"]
        direction TB
        API["Ingestion & API Gateway"]
        RCA_ENGINE["AI Diagnostic Engine<br/><i>RCA & Confidence Scorer</i>"]
        POLICY["Remediation Policy Engine<br/><i>Active / Passive Sentinel Mode</i>"]
        BROADCASTER["SSE Telemetry Streamer"]
    end

    %% Semantic Memory
    subgraph MEMORY["Semantic Memory Layer"]
        direction TB
        PGVECTOR[("PostgreSQL + pgvector<br/><i>384-dim Embeddings</i>")]
        INCIDENT_STORE[("Incident DB & Audit Logs")]
    end

    %% LLM Gateway
    subgraph LLM_GATEWAY["Multi-Model Reasoning Gateway"]
        direction TB
        ROUTER{{"Universal Model Router"}}
        M_GEMINI["Google Gemini / Gemma"]
        M_OR["OpenRouter (Claude, DeepSeek, Llama)"]
        M_OPENAI["OpenAI (GPT-4o)"]
        M_LOCAL["Local Ollama / Heuristic Engine"]
    end

    %% Operations Console
    subgraph OPS["Operator Interface"]
        direction TB
        CONSOLE["React 19 Terminal Console<br/><i>Real-Time HUD & Interactive CLI REPL</i>"]
    end

    %% Event Ingestion & Sanitization Flow
    RUNTIME -->|"Cgroup & Die Events"| EVENT_STREAM
    EVENT_STREAM --> SANITIZER
    SANITIZER --> GUARDRAIL
    GUARDRAIL -->|"Scrubbed Telemetry Payload"| API

    %% Diagnostic & Inference Flow
    API --> RCA_ENGINE
    RCA_ENGINE <-->|"Cosine Similarity Query"| PGVECTOR
    RCA_ENGINE -->|"Structured JSON Request"| ROUTER

    ROUTER --- M_GEMINI
    ROUTER --- M_OR
    ROUTER --- M_OPENAI
    ROUTER --- M_LOCAL

    ROUTER -->|"Structured RCA & Action Plan"| RCA_ENGINE
    RCA_ENGINE --> POLICY

    %% Remediation Loop
    POLICY -->|"Autonomous Dispatch (Active Mode)"| EXECUTOR
    EXECUTOR -->|"Container Self-Healing Action"| RUNTIME

    %% Telemetry & Human-in-the-Loop Flow
    POLICY -->|"Audit Records & Vectors"| INCIDENT_STORE
    POLICY -->|"Real-Time Event Stream"| BROADCASTER
    BROADCASTER -->|"Server-Sent Events (SSE)"| CONSOLE
    CONSOLE -->|"Operator Override / Batch Heal"| API
```

---

## Core Capabilities

- **Go Sentinel Daemon**: Low-overhead edge agent listening directly to container runtime event streams with microsecond incident detection.
- **Zero Data-Leak Sanitizer**: High-speed regex and entropy filters redacting JWTs, API keys, database connection strings, RSA private keys, and passwords before network dispatch.
- **Multi-Model Diagnostic Engine**:
  - **Google Gemini**: `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-flash-lite-latest`, Gemma open weights
  - **OpenRouter & Universal API Routers**: Claude 3.7 Sonnet, DeepSeek R1, Llama 3.3 70B, Qwen 2.5 Coder
  - **OpenAI**: GPT-4o, GPT-4o-mini
  - **Anthropic**: Claude 3.5 Sonnet, Claude 3.5 Haiku
  - **Local Models**: Ollama / vLLM / deterministic heuristic fallback engine
- **Semantic Memory (pgvector)**: 384-dimensional cosine similarity search across historical cluster outages to minimize Mean Time to Recovery (MTTR).
- **Flapping Circuit Breakers**: Sliding-window algorithms preventing destructive crash loops and escalating persistent faults to human SREs.
- **Dual Operating Modes**:
  - **Active Mode**: Immediate autonomous remediation and health verification.
  - **Passive Sentinel Mode (Dry-Run)**: Observes crashes, runs RCA diagnostics, generates proposals, logs execution traces, and leaves container state unmodified.
- **Cluster Batch Remediation**: 1-click and interactive CLI commands (`$ heal-all-unresolved`, `heal all`) to sweep and heal all unresolved or passive incidents across the cluster.
- **Terminal Operations Console**: Real-time HUD, demultiplexed live telemetry stream, interactive CLI REPL, and visual vector similarity explorer.

---

## Quick Start (Local Docker Compose)

### 1. Clone & Configure
```bash
git clone https://github.com/unxki/kintsugi.git
cd kintsugi
cp .env.example .env
```

### 2. Start the Cluster
```bash
make run
# or
docker compose up --build -d
```

### 3. Access Services
- **Console Interface**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Core OpenAPI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **PostgreSQL / pgvector**: `localhost:5432`

---

## Testing & Verification

Run the unified test suite across all sub-services:
```bash
make test
```
- **Core Tests**: `pytest` async integration suite with vector similarity tests.
- **Sentinel Tests**: Go unit tests for log sanitization, regex redactors, and flapping detection.
- **Console Tests**: Vite production bundle compilation.

---

## Deployment Topology

- **Database**: [Supabase](https://supabase.com) (PostgreSQL + `pgvector` extension enabled)
- **Sentinel Daemon**: Azure Linux VM / Kubernetes DaemonSet with Docker Socket access
- **Frontend Console**: [Vercel](https://vercel.com) / Netlify
- **Core API**: Azure Container Apps / AWS ECS / Fly.io / Render

---

## License

MIT License. Built for resilient autonomous infrastructure.
