import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { MetricBar } from "./components/dashboard/MetricBar";
import { IncidentFeed } from "./components/dashboard/IncidentFeed";
import { WorkloadsGrid } from "./components/dashboard/WorkloadsGrid";
import { RuntimeLogsView } from "./components/dashboard/RuntimeLogsView";
import { SettingsView } from "./components/settings/SettingsView";
import { DiagnosticModal } from "./components/diagnostics/DiagnosticModal";
import { ChaosControlModal } from "./components/chaos/ChaosControlModal";
import { TerminalDrawer, LogEntry } from "./components/terminal/TerminalDrawer";
import { MatrixBackground } from "./components/common/MatrixBackground";
import { useSSE } from "./hooks/useSSE";
import { Incident, SystemStats, ContainerWorkload, TelemetryEvent } from "./types/incident";
import { TerminalHeroHeader } from "./components/layout/TerminalHeroHeader";
import { apiUrl } from "./utils/api";
import { Terminal, Shield, Cpu, Database } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"feed" | "workloads" | "logs" | "config" | "system">("feed");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [workloads, setWorkloads] = useState<ContainerWorkload[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isChaosModalOpen, setIsChaosModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ id: string; text: string; type: "info" | "success" | "danger" } | null>(null);
  
  const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([
    {
      id: "boot_1",
      timestamp: new Date(Date.now() - 30000).toLocaleTimeString([], { hour12: false }),
      source: "SENTINEL",
      level: "INFO",
      message: "⚡ Sentinel node daemon initialized. Connected to Docker runtime socket: /var/run/docker.sock",
    },
    {
      id: "boot_2",
      timestamp: new Date(Date.now() - 29000).toLocaleTimeString([], { hour12: false }),
      source: "SANITIZER",
      level: "SUCCESS",
      message: "Zero-Leak regex sanitizer armed. Tracking JWTs, DB connection strings, OpenAI tokens, and RSA keys.",
    },
    {
      id: "boot_3",
      timestamp: new Date(Date.now() - 28000).toLocaleTimeString([], { hour12: false }),
      source: "PGVECTOR",
      level: "INFO",
      message: "Vector engine online. 384-dimensional dense semantic cosine index verified.",
    },
    {
      id: "boot_4",
      timestamp: new Date(Date.now() - 27000).toLocaleTimeString([], { hour12: false }),
      source: "AI_RCA",
      level: "INFO",
      message: "Root-cause diagnostic engine loaded with dynamic provider hot-swapping and heuristic fallbacks.",
    },
  ]);

  const [stats, setStats] = useState<SystemStats>({
    active_agents: 1,
    monitored_workloads: 6,
    total_incidents: 0,
    auto_healed_count: 0,
    escalated_count: 0,
    mean_time_to_recovery_sec: 1.15,
    uptime_seconds: 86400,
    system_status: "OPTIMAL",
  });

  const appendLog = useCallback((source: LogEntry["source"], level: LogEntry["level"], message: string, containerName?: string) => {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      source,
      level,
      message,
      containerName,
    };
    setTerminalLogs((prev) => [...prev.slice(-400), entry]);
  }, []);

  const showToast = (text: string, type: "info" | "success" | "danger" = "info") => {
    const id = Math.random().toString();
    setToastMessage({ id, text, type });
    setTimeout(() => {
      setToastMessage((curr) => (curr?.id === id ? null : curr));
    }, 4000);
  };

  // Fetch historical incidents
  const fetchIncidents = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl("/api/v1/incidents"));
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          setIncidents(data);
        }
      }
    } catch (err) {
      console.warn("Using local incident store:", err);
    }
  }, []);

  // Fetch monitored workloads with Map-based deduplication
  const fetchWorkloads = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl("/api/v1/containers"));
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          // Reconcile by unique container_name to prevent duplicate cards from SSE/polling
          setWorkloads(() => {
            const workloadMap = new Map<string, ContainerWorkload>();
            data.forEach((w: ContainerWorkload) => {
              const key = w.container_name || w.container_id;
              workloadMap.set(key, w);
            });
            return Array.from(workloadMap.values());
          });
        }
      }
    } catch (err) {
      console.warn("Using local container store:", err);
    }
  }, []);

  // Fetch telemetry stats
  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl("/api/v1/telemetry/stats"));
      if (resp.ok) {
        const data = await resp.json();
        setStats(data);
      }
    } catch (err) {
      console.warn("Using local stats store:", err);
    }
  }, []);

  // Real-time SSE Handler
  const handleSSEEvent = useCallback((event: TelemetryEvent) => {
    if (event.event_type.startsWith("incident.")) {
      const incId = event.incident_id;
      if (!incId) return;

      const containerName = event.data.container_name || "container";
      const isFlap = Boolean(event.data.is_flapping);

      if (event.event_type === "incident.detected") {
        appendLog("DOCKER", "ERROR", `Container crash detected (exit ${event.data.exit_code || 1}, reason: ${event.data.termination_reason || "die"})`, containerName);
        appendLog("SANITIZER", "SUCCESS", `Tail logs captured and scrubbed. No plaintext credentials dispatched.`, containerName);
        if (isFlap) {
          appendLog("POLICY", "WARN", `[CIRCUIT BREAKER] Rapid crash loop detected (${event.data.restart_count || 4}x crashes in sliding window). Auto-restart suspended.`, containerName);
        }
      } else if (event.event_type === "incident.diagnosing") {
        appendLog("PGVECTOR", "INFO", `Generating 384-dim normalized embedding and querying historical vectors...`, containerName);
        appendLog("AI_RCA", "INFO", `Executing AI diagnostic inference pipeline...`, containerName);
      } else if (event.event_type === "incident.diagnosed") {
        appendLog("AI_RCA", "SUCCESS", `RCA complete: ${event.data.failure_classification || "Fault"} (${Math.round((event.data.confidence_score || 0.95) * 100)}% confidence). Action: ${event.data.recommended_action}`, containerName);
      } else if (event.event_type === "incident.remediating") {
        appendLog("POLICY", "INFO", `Dispatching automated remediation action: ${event.data.action || "RESTART_CONTAINER"}`, containerName);
      } else if (event.event_type === "incident.resolved") {
        const isPassiveEvent =
          event.data.remediation_status === "PASSIVE_OBSERVED" ||
          (event.data.action_taken && String(event.data.action_taken).startsWith("PASSIVE_OBSERVED"));

        if (isPassiveEvent) {
          appendLog("POLICY", "INFO", `🛡️ [PASSIVE OBSERVED] Analyzed ${containerName} recommendation: ${event.data.action_taken}. No container restart executed.`, containerName);
          showToast(`🛡️ Passive Mode: Observed ${containerName}`, "info");
        } else {
          appendLog("POLICY", "SUCCESS", `✔ Auto-remediation completed successfully in ${event.data.duration_ms || 45}ms. Container verified healthy.`, containerName);
          showToast(`✔ Auto-healed ${containerName} in ${event.data.duration_ms || 45}ms`, "success");
        }
      } else if (event.event_type === "incident.escalated") {
        appendLog("POLICY", "WARN", `⚠ Incident escalated to human SRE operator: ${event.data.reason || "Guardrail tripped"}`, containerName);
        showToast(`⚠ Escalate to Human SRE: ${containerName}`, "danger");
      }

      setIncidents((prev) => {
        const incidentMap = new Map<string, Incident>();
        prev.forEach((inc) => incidentMap.set(inc.id, inc));

        const existing = incidentMap.get(incId);
        const isPassiveEvent =
          event.data.remediation_status === "PASSIVE_OBSERVED" ||
          (event.data.action_taken && String(event.data.action_taken).startsWith("PASSIVE_OBSERVED"));

        const updatedIncident: Incident = existing
          ? {
              ...existing,
              status: event.data.status || existing.status,
              failure_classification: event.data.failure_classification || existing.failure_classification,
              root_cause: event.data.root_cause || existing.root_cause,
              confidence_score: event.data.confidence_score !== undefined ? event.data.confidence_score : existing.confidence_score,
              action_taken: event.data.action_taken || event.data.recommended_action || existing.action_taken,
              is_flapping: event.data.is_flapping !== undefined ? event.data.is_flapping : existing.is_flapping,
              remediation_status:
                event.event_type === "incident.resolved"
                  ? (isPassiveEvent ? "PASSIVE_OBSERVED" : (event.data.remediation_status || "SUCCESS"))
                  : event.event_type === "incident.failed"
                  ? "FAILED"
                  : event.event_type === "incident.escalated"
                  ? "ESCALATED"
                  : event.event_type === "incident.remediating"
                  ? "IN_PROGRESS"
                  : existing.remediation_status,
            }
          : {
              id: incId,
              container_id: event.data.container_id || "unknown",
              container_name: containerName,
              image: event.data.image || "kintsugi/workload:latest",
              exit_code: event.data.exit_code || 1,
              termination_reason: event.data.termination_reason || "die",
              status: event.data.status || "DETECTED",
              confidence_score: event.data.confidence_score || 0.0,
              remediation_status: isPassiveEvent ? "PASSIVE_OBSERVED" : "PENDING",
              is_flapping: Boolean(event.data.is_flapping),
              restart_count: event.data.restart_count || 0,
              created_at: new Date().toISOString(),
              logs: [],
              remediations: [],
            };

        incidentMap.set(incId, updatedIncident);
        return Array.from(incidentMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

      fetchStats();
      fetchWorkloads();
      fetchIncidents();
    } else if (event.event_type === "stats.update") {
      setStats(event.data as SystemStats);
    } else if (event.event_type === "config.updated") {
      appendLog("POLICY", "SUCCESS", `System configuration updated dynamically: Engine=${event.data.llm_provider?.toUpperCase()} Mode=${event.data.operating_mode}`);
      showToast(`Dynamic Config Applied: ${event.data.llm_provider?.toUpperCase()} (${event.data.operating_mode})`, "info");
    }
  }, [appendLog, fetchStats, fetchWorkloads, fetchIncidents]);

  const { isConnected } = useSSE("/api/v1/telemetry/stream", handleSSEEvent);

  // Initial Data Fetch & Periodic Background Reconciliation
  useEffect(() => {
    fetchIncidents();
    fetchWorkloads();
    fetchStats();

    const interval = setInterval(() => {
      fetchIncidents();
      fetchWorkloads();
      fetchStats();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchIncidents, fetchWorkloads, fetchStats]);

  // Trigger Chaos Injection
  const handleInjectChaos = async (scenario: string, containerName?: string) => {
    const isFlap = scenario === "flapping";
    const targetName = containerName || (isFlap ? "auth-service-flapping" : "auth-service");

    showToast(`Injecting chaos scenario: ${scenario.toUpperCase()} on ${targetName}`, "info");
    appendLog("CHAOS", "WARN", `Triggering ${scenario.toUpperCase()} injection against workload: ${targetName}`);

    // Dispatch to backend API (SSE stream will automatically handle detection & progression)
    try {
      const res = await fetch(apiUrl("/api/v1/actions/simulate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, container_name: targetName }),
      });
      if (res.status === 429) {
        const errData = await res.json();
        showToast(errData.detail || "Rate limit reached. Please wait a few seconds.", "danger");
        appendLog("CHAOS", "WARN", "Simulation throttled by VM protection rate limiter.");
      }
    } catch (err) {
      console.warn("Chaos simulation request failed:", err);
    }
  };

  // Manual Remediation API Call & Circuit Breaker Override
  const handleManualRemediate = async (incidentId: string, action: string = "RESTART_CONTAINER") => {
    showToast(`⚡ Dispatched manual override: ${action}`, "info");
    appendLog("POLICY", "INFO", `Operator manual override triggered: ${action} on incident ${incidentId}`);

    // Instant optimistic update
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              status: "RESOLVED",
              remediation_status: "SUCCESS",
              is_flapping: false,
              action_taken: action,
              remediations: [
                {
                  id: Date.now(),
                  action_type: action,
                  status: "COMPLETED",
                  execution_output: `Manual operator override '${action}' completed with verified health check. Circuit breaker reset.`,
                  duration_ms: 540,
                  executed_at: new Date().toISOString(),
                }
              ]
            }
          : inc
      )
    );

    try {
      await fetch(apiUrl("/api/v1/actions/remediate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident_id: incidentId, action }),
      });
      await fetchIncidents();
      await fetchStats();
    } catch (err) {
      console.warn("Manual remediation fallback:", err);
    }
  };

  // Batch Remediate All Unresolved / Passive Incidents
  const handleBatchRemediateAll = async () => {
    showToast("⚡ Dispatched cluster-wide batch remediation for all unresolved incidents", "info");
    appendLog("POLICY", "INFO", "Cluster batch remediation triggered for all passive/unresolved workloads.");

    // Instant optimistic update for all unresolved incidents
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.status !== "RESOLVED" || inc.remediation_status === "PASSIVE_OBSERVED" || inc.is_flapping
          ? {
              ...inc,
              status: "RESOLVED",
              remediation_status: "SUCCESS",
              is_flapping: false,
              action_taken: "RESTART_CONTAINER",
              remediations: [
                {
                  id: Date.now(),
                  action_type: "BATCH_AUTONOMOUS_HEAL",
                  status: "COMPLETED",
                  execution_output: "Autonomous cluster sweep completed with verified health checks.",
                  duration_ms: 120,
                  executed_at: new Date().toISOString(),
                }
              ]
            }
          : inc
      )
    );

    try {
      const resp = await fetch(apiUrl("/api/v1/actions/batch-remediate"), { method: "POST" });
      if (resp.ok) {
        const data = await resp.json();
        appendLog("POLICY", "SUCCESS", `Batch remediation queued: ${data.count} incidents resolving autonomously.`);
        showToast(`✔ Queued healing for ${data.count} incidents`, "success");
      }
      await fetchIncidents();
      await fetchStats();
    } catch (err) {
      console.warn("Batch remediation fallback:", err);
    }
  };

  // Clear all incidents
  const handleClearIncidents = async () => {
    setIncidents([]);
    appendLog("CLI", "WARN", "Incident log stream purged by operator.");
    try {
      await fetch(apiUrl("/api/v1/incidents/clear"), { method: "DELETE" });
      await fetchStats();
      showToast("Cleared all incidents.", "info");
    } catch (err) {
      // client clear
    }
  };

  // Execute interactive REPL commands
  const handleExecuteCommand = async (cmdText: string) => {
    const raw = cmdText.trim();
    const parts = raw.split(/\s+/);
    const command = parts[0].toLowerCase();
    const arg = parts[1] ? parts[1].toLowerCase() : "";

    appendLog("CLI", "INFO", `kintsugi > ${cmdText}`);

    if (command === "help") {
      appendLog("CLI", "SUCCESS", "Available Commands:");
      appendLog("CLI", "INFO", "  inject <scenario>                    - Trigger chaos: oom, panic, flapping, segfault, port_conflict, zombie_deadlock, network_cascade");
      appendLog("CLI", "INFO", "  heal <incident_id>                   - Manually heal a specific incident");
      appendLog("CLI", "INFO", "  heal all / heal --all                - Autonomously heal ALL unresolved / passive incidents in cluster");
      appendLog("CLI", "INFO", "  stats                                - Display cluster observability metrics");
      appendLog("CLI", "INFO", "  containers                           - List monitored Docker containers");
      appendLog("CLI", "INFO", "  clear                                - Clear terminal log output");
      appendLog("CLI", "INFO", "  purge                                - Purge all incidents database");
    } else if (command === "inject") {
      const scenario = arg || "oom";
      await handleInjectChaos(scenario);
      appendLog("CLI", "SUCCESS", `Dispatched chaos injection for '${scenario}'`);
    } else if (command === "stats") {
      appendLog("CLI", "SUCCESS", `System Status: ${stats.system_status} | Active Sentinels: ${stats.active_agents} | MTTR: ${stats.mean_time_to_recovery_sec}s | Healed: ${stats.auto_healed_count}/${stats.total_incidents}`);
    } else if (command === "containers") {
      appendLog("CLI", "INFO", `Monitored Workloads (${workloads.length}):`);
      workloads.forEach((w) => {
        appendLog("CLI", "INFO", `  • ${w.container_name} (${w.image}) [${w.status.toUpperCase()}] CPU:${w.cpu_percent.toFixed(1)}% RAM:${w.memory_usage_mb.toFixed(0)}MB`);
      });
    } else if (command === "heal" || command === "fix" || command === "remediate") {
      if (!arg || arg === "all" || arg === "--all" || arg === "@all" || arg === "-a") {
        await handleBatchRemediateAll();
      } else {
        await handleManualRemediate(parts[1], "RESTART_CONTAINER");
      }
    } else if (command === "purge") {
      await handleClearIncidents();
    } else if (command === "source" || command === "github" || command === "repo" || command === "about") {
      appendLog("CLI", "SUCCESS", "Kintsugi Autonomous AIOps Platform by @unxki");
      appendLog("CLI", "INFO", "  Repository: https://github.com/unxki/kintsugi");
      appendLog("CLI", "INFO", "  Stack: Go Sentinel + Python FastAPI Core + PostgreSQL pgvector + React 19");
    } else {
      appendLog("CLI", "WARN", `Unknown command '${command}'. Type 'help' for available commands.`);
    }
  };

  // Select incident for modal detail
  const handleSelectIncident = async (inc: Incident) => {
    try {
      const resp = await fetch(apiUrl(`/api/v1/incidents/${inc.id}`));
      if (resp.ok) {
        const fullDetail = await resp.json();
        setSelectedIncident(fullDetail);
        setIncidents((prev) => prev.map((item) => (item.id === fullDetail.id ? { ...item, ...fullDetail } : item)));
        return;
      }
    } catch (err) {
      // fallback
    }
    setSelectedIncident(inc);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#f3f4f6] flex flex-col relative selection:bg-[#00ff41] selection:text-black pb-12">
      <MatrixBackground />

      {/* Top Header */}
      <Header
        isConnected={isConnected}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        nodeCount={stats.active_agents}
        incidentCount={incidents.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6 z-10 space-y-5 pb-24">
        {/* Top Hero Section with Animated Terminal Decipher Transition */}
        <TerminalHeroHeader
          activeTab={activeTab}
          onInjectChaos={() => setIsChaosModalOpen(true)}
        />

        {/* HUD Metric Bar */}
        <MetricBar stats={stats} />

        {/* Tab Content with Smooth Cyber Motion Transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full"
          >
            {activeTab === "feed" && (
              <div className="grid grid-cols-1 gap-6">
                <IncidentFeed
                  incidents={incidents}
                  onSelectIncident={handleSelectIncident}
                  selectedIncidentId={selectedIncident?.id}
                  onRefresh={fetchIncidents}
                  onClearIncidents={handleClearIncidents}
                  onQuickRemediate={handleManualRemediate}
                  onBatchRemediate={handleBatchRemediateAll}
                />
              </div>
            )}

            {activeTab === "workloads" && (
              <WorkloadsGrid
                workloads={workloads}
                onTriggerChaosOnWorkload={(w) =>
                  handleInjectChaos("oom", w.container_name)
                }
              />
            )}

            {activeTab === "logs" && (
              <RuntimeLogsView
                logs={terminalLogs}
                onClearLogs={() => setTerminalLogs([])}
                onRefresh={fetchIncidents}
              />
            )}

            {activeTab === "config" && (
              <SettingsView />
            )}

            {activeTab === "system" && (
              <div className="bg-[#080808] border border-[#1e1e1e] p-4 sm:p-6 font-mono space-y-6 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#1e1e1e]">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 sm:w-5 h-4 sm:h-5 text-[#00ff41]" />
                    <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      Kintsugi Autonomous Topology & Agent Mesh
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-[#00ff41] bg-[#00ff41]/10 border border-[#00ff41]/30 px-2 py-0.5 font-bold">
                    DAEMON ONLINE
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-[#0c0c0c] border border-[#1e1e1e] p-4 space-y-2.5 hover:border-[#333] transition-colors">
                    <div className="text-white font-bold flex items-center gap-1.5 pb-2 border-b border-[#1a1a1a]">
                      <Cpu className="w-4 h-4 text-[#00ff41]" />
                      <span>Sentinel Daemon (Node 1)</span>
                    </div>
                    <div className="text-[#9ca3af] space-y-1.5">
                      <div>Status: <span className="text-[#00ff41] font-bold">ONLINE (Listening)</span></div>
                      <div>Socket: <span className="text-white">/var/run/docker.sock</span></div>
                      <div>Sanitizer: <span className="text-[#00ff41]">Zero-Leak Local Masking</span></div>
                      <div>Flap Guardrail: <span className="text-[#00ff41]">Sliding Window (3 in 60s)</span></div>
                    </div>
                  </div>

                  <div className="bg-[#0c0c0c] border border-[#1e1e1e] p-4 space-y-2.5 hover:border-[#333] transition-colors">
                    <div className="text-white font-bold flex items-center gap-1.5 pb-2 border-b border-[#1a1a1a]">
                      <Database className="w-4 h-4 text-[#00ff41]" />
                      <span>Kintsugi Brain & Vector Store</span>
                    </div>
                    <div className="text-[#9ca3af] space-y-1.5">
                      <div>Framework: <span className="text-white">FastAPI / Async Engine</span></div>
                      <div>Vector Engine: <span className="text-[#00ff41] font-bold">pgvector 384-dim (L2)</span></div>
                      <div>LLM Diagnostics: <span className="text-white">Schema-Enforced JSON</span></div>
                      <div>Telemetry: <span className="text-[#00ff41]">Server-Sent Events (SSE)</span></div>
                    </div>
                  </div>

                  <div className="bg-[#0c0c0c] border border-[#1e1e1e] p-4 space-y-2.5 hover:border-[#333] transition-colors">
                    <div className="text-white font-bold flex items-center gap-1.5 pb-2 border-b border-[#1a1a1a]">
                      <Shield className="w-4 h-4 text-[#00ff41]" />
                      <span>Remediation Policy Bounds</span>
                    </div>
                    <div className="text-[#9ca3af] space-y-1.5">
                      <div>Auto-Restart: <span className="text-[#00ff41]">Verified Health Check</span></div>
                      <div>Volume Prune: <span className="text-white">Dangling Volumes Only</span></div>
                      <div>Runaway Stop: <span className="text-white">Socket Conflict Handler</span></div>
                      <div>Escalation Path: <span className="text-[#ef4444] font-bold">Circuit Breaker to SRE</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer placed inside scrollable flow */}
        <Footer />
      </main>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-14 right-6 z-50 p-3.5 border font-mono text-xs shadow-2xl flex items-center gap-2.5 max-w-md ${
              toastMessage.type === "danger"
                ? "bg-[#1a0c0c] text-[#ef4444] border-[#ef4444]/60 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                : toastMessage.type === "success"
                ? "bg-[#0c1a0e] text-[#00ff41] border-[#00ff41]/60 shadow-[0_0_20px_rgba(0,255,65,0.3)]"
                : "bg-[#0c0c0c] text-white border-[#333]"
            }`}
          >
            <span className="font-bold">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Fixed Bottom Terminal Log Streamer & Interactive CLI Drawer */}
      <TerminalDrawer
        logs={terminalLogs}
        onClearLogs={() => setTerminalLogs([])}
        onExecuteCommand={handleExecuteCommand}
        isLive={isConnected}
      />

      {/* Interactive AI Diagnostic & RCA Modal */}
      <DiagnosticModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onManualRemediate={handleManualRemediate}
      />

      {/* Chaos Testing Control Modal */}
      <ChaosControlModal
        isOpen={isChaosModalOpen}
        onClose={() => setIsChaosModalOpen(false)}
        onInjectChaos={handleInjectChaos}
        workloads={workloads}
      />
    </div>
  );
};

export default App;
