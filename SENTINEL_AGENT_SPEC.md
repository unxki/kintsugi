# Sentinel Daemon Specification

## 1. Core Objectives
* Continuously monitor container runtime events via local socket/API hooks with minimal CPU/memory overhead.
* Capture failure states (exit codes, OOM notifications, terminating signals) the instant they occur.
* Safely capture and sanitize tail log buffers before network dispatch.
* Safely execute remediation directives dispatched by the Healer Brain.

## 2. Functional Requirements

### Event Monitoring & Filtering
* Filter runtime streams specifically for container failure events (e.g., `die`, `oom`, `kill`, `unhealthy`).
* Ignore standard, graceful shutdowns (e.g., intentional `ExitCode 0`).

### Context Collection & Sanitization
* Collect the last 50–100 log lines from standard output and error buffers.
* **Security Rule:** Sanitize logs before dispatch by masking sensitive strings (passwords, auth tokens, private keys) to prevent leaking secrets to external model APIs.
* Package container runtime metadata: image tag, resource limits, restart counts, and exit status.

### Remediation & Safety Guardrails
* Provide handlers for recovery actions (container restarts, dangling volume cleanups, or stopping runaway processes).
* Implement a **flapping/loop detection safety guardrail**: if a container crashes repeatedly within a tight time window, prevent further automated restarts and flag for escalation.