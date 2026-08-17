# Web Console & Observability Specification

## 1. Design Language & Aesthetic Guidelines
* **Theme:** Deep-black terminal / Bash Hacker aesthetic (`#050505` background, `#111111` surface panels).
* **Typography:** Exclusively monospaced (`JetBrains Mono`, `Fira Code`, or equivalent).
* **Accent Colors:** Primary Bash Green (`#00ff41`) for active prompts, connection pulses, and successful resolutions; subtle amber/reds for warnings and critical failures; muted gray (`#6b7280`) for metadata.
* **Atmosphere:** Subtle, animated background matrix/grid effect and sharp, technical edges (no heavy rounded corners or drop shadows).

## 2. UI Modules & Information Architecture

### A. System Header & Connection Indicator
* Visual status indicator pulsing green when the SSE telemetry stream is live.
* Node statistics: active agents, monitored containers, and uptime metrics styled as command outputs.

### B. Live Incident Feed
* Real-time stream of incoming events styled like a continuous `/var/log` terminal tail.
* High-contrast tags highlighting container names, timestamps, error classifications, and resolution status.

### C. AI Diagnostic & Inspection Modal/Drawer
* Interactive detailed view for selected incidents:
  - Expandable/scrollable raw log trace snippet.
  - Animated terminal-style breakdown of the AI's root-cause analysis.
  - Action summary displaying the automated remediation path taken.

### D. Monitored Workloads Overview
* Grid/table displaying currently watched containers, images, and live status.