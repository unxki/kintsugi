# Agentic Auto-Healer — System Architecture & Philosophy

## 1. System Vision
The Agentic Auto-Healer is an autonomous Site Reliability Engineering (AIOps) system built to minimize Mean Time to Recovery (MTTR). It bridges low-level OS/container virtualization with cloud-level intelligence: observing container failure lifecycles locally, running root-cause analysis (RCA) via LLM agents, executing safe remediation, and streaming telemetry to a real-time web console.

## 2. Component Domain Boundaries

### A. The Sentinel Daemon (Node Layer)
* **Role:** Passive observer & execution unit on the host machine.
* **Domain:** Direct integration with the Docker runtime environment. Intercepts abnormal termination, packages execution state, and carries out authorized local remediation commands.

### B. The Healer Brain (Intelligence & Orchestration Layer)
* **Role:** Ingestion engine, diagnostic coordinator, and telemetry broadcaster.
* **Domain:** Evaluates raw incident context against historical failure patterns using vector similarity, prompts language models for structured root-cause extraction, evaluates safety bounds, and coordinates real-time event distribution.

### C. The Web Console (Observability Layer)
* **Role:** Operator visual dashboard.
* **Domain:** Subscribes to telemetry streams, presents high-contrast terminal-style diagnostics, and displays system health metrics and historical post-mortems.

## 3. Data Lifecycle & Interaction Model
1. **Detection:** A container crashes, exhausts memory, or fails a health probe.
2. **Context Aggregation:** The Daemon captures relevant exit states, resource metadata, and raw output streams.
3. **Ingestion & Analysis:** The Brain receives the incident, queries vector storage for related prior incidents, and consults an LLM agent for structured triage.
4. **Remediation & Escalation:** An automated action (e.g., restart, volume prune, configuration rollback) is issued to the Daemon. If a service enters a restart loop, it escalates to manual intervention.
5. **Streaming:** Real-time state transitions stream seamlessly to connected web dashboards.