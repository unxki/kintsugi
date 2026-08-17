# Healer Brain (AIOps Engine) Specification

## 1. Core Objectives
* Ingest incident payloads from one or more Sentinel Daemons reliably.
* Manage vector-based semantic search to correlate new stack traces with historical errors.
* Interface with LLM inference APIs to extract structured root causes and recommended recovery actions.
* Push live incident updates and system telemetry via Server-Sent Events (SSE).

## 2. Functional Requirements

### Diagnostic Pipeline
* Generate semantic embeddings for incoming error logs to enable similarity matching across historical incidents.
* Coordinate with an LLM using system prompts designed to enforce strict, schema-compliant JSON outputs containing:
  - Concise root-cause summary.
  - Failure classification (e.g., Memory Exhaustion, Port Conflict, Unhandled Exception).
  - Remediation proposal with a confidence score.
  - Operational reasoning for human operators.

### Real-Time Telemetry Broadcasting
* Maintain an efficient, connection-managed Server-Sent Events (SSE) stream.
* Broadcast lifecycle stages: incident created, AI diagnosis completed, action executed, and state resolved.

### Storage & Persistence
* Persist complete incident records: container identifiers, metadata, log traces, vector embeddings, AI analysis outputs, and timestamps.