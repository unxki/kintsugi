import React, { useState } from "react";
import { X, Zap, ShieldAlert, Cpu, HardDrive, AlertTriangle, CheckCircle2, Play, Server, Crosshair } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChaosControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInjectChaos: (scenario: string, containerName?: string) => Promise<void>;
  workloads?: Array<{ container_id: string; container_name: string; status: string }>;
}

export const ChaosControlModal: React.FC<ChaosControlModalProps> = ({
  isOpen,
  onClose,
  onInjectChaos,
  workloads = [],
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>("oom");
  const [selectedTarget, setSelectedTarget] = useState<string>("auto");
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionSuccess, setExecutionSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const scenarios = [
    {
      id: "oom",
      title: "Memory Exhaustion",
      code: "OOM Kill (137)",
      description: "Triggers rapid heap buffer growth exceeding container memory quota. Linux OOM Killer terminates PID.",
      icon: HardDrive,
      color: "text-[#f59e0b]",
      border: "border-[#f59e0b]/40",
      activeBg: "bg-[#f59e0b]/10",
      badge: "EXIT 137",
    },
    {
      id: "panic",
      title: "Unhandled Runtime Panic",
      code: "Panic (Exit 2)",
      description: "Injects an uncaught nil pointer dereference exception. Extracts stack trace for AI classification.",
      icon: AlertTriangle,
      color: "text-[#ef4444]",
      border: "border-[#ef4444]/40",
      activeBg: "bg-[#ef4444]/10",
      badge: "EXIT 2",
    },
    {
      id: "flapping",
      title: "Flapping Crash Loop",
      code: "Flap Loop (4x)",
      description: "Simulates 4 consecutive rapid crashes. Tests sliding-window circuit breaker & SRE human escalation.",
      icon: ShieldAlert,
      color: "text-[#ef4444]",
      border: "border-[#ef4444]/40",
      activeBg: "bg-[#ef4444]/10",
      badge: "CIRCUIT BREAKER",
    },
    {
      id: "segfault",
      title: "Native Segmentation Fault",
      code: "Segfault (139)",
      description: "Triggers an invalid memory address violation (SIGSEGV). Captures core signal for health restart.",
      icon: Cpu,
      color: "text-[#c084fc]",
      border: "border-[#c084fc]/40",
      activeBg: "bg-[#c084fc]/10",
      badge: "SIGSEGV 139",
    },
    {
      id: "zombie_deadlock",
      title: "Zombie Process Deadlock",
      code: "Deadlock (SIGTERM Trap)",
      description: "Spins locked CPU thread and masks SIGTERM graceful signals. Forces AI to analyze process tree and issue forceful SIGKILL.",
      icon: Cpu,
      color: "text-[#f43f5e]",
      border: "border-[#f43f5e]/40",
      activeBg: "bg-[#f43f5e]/10",
      badge: "SIGKILL REQUIRED",
    },
    {
      id: "network_cascade",
      title: "Cascading Socket Partition",
      code: "Pool Exhaustion",
      description: "Simulates database connection drop. Worker livelocks and floods multi-line stack traces without exiting, forcing log diagnosis & pool reset.",
      icon: Zap,
      color: "text-[#38bdf8]",
      border: "border-[#38bdf8]/40",
      activeBg: "bg-[#38bdf8]/10",
      badge: "LIVELOCK / RCA",
    },
    {
      id: "port_conflict",
      title: "Socket Port Collision",
      code: "Port Collision",
      description: "Simulates TCP socket bind collision on port 8080. Stops orphan processes and frees socket.",
      icon: Zap,
      color: "text-[#06b6d4]",
      border: "border-[#06b6d4]/40",
      activeBg: "bg-[#06b6d4]/10",
      badge: "EADDRINUSE",
    },
  ];

  const handleExecute = async () => {
    setIsExecuting(true);
    setExecutionSuccess(false);
    try {
      const targetName = selectedTarget === "auto" ? undefined : selectedTarget;
      await onInjectChaos(selectedScenario, targetName);
      setExecutionSuccess(true);
      setTimeout(() => {
        setExecutionSuccess(false);
        onClose();
      }, 700);
    } finally {
      setIsExecuting(false);
    }
  };

  const currentScenarioObj = scenarios.find((s) => s.id === selectedScenario) || scenarios[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md font-mono">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-[#080808] border border-[#1e1e1e] w-full max-w-3xl shadow-[0_0_50px_rgba(0,0,0,0.95)] flex flex-col"
        >
          {/* Modal Header */}
          <div className="bg-[#0c0c0c] border-b border-[#1e1e1e] p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#00ff41] animate-pulse" />
              <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                Kintsugi Chaos Control Plane & Scenario Injector
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-[#6b7280] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Target Workload Selection */}
            <div className="bg-[#0c0c0c] border border-[#1e1e1e] p-3.5 space-y-2">
              <label className="text-[11px] text-[#9ca3af] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#00ff41]" />
                Target Monitored Workload:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTarget("auto")}
                  className={`p-2 text-left text-xs border transition-all flex items-center justify-between ${
                    selectedTarget === "auto"
                      ? "bg-[#141414] border-[#00ff41] text-[#00ff41] font-bold shadow-[0_0_10px_rgba(0,255,65,0.15)]"
                      : "bg-[#080808] border-[#1e1e1e] text-[#9ca3af] hover:border-[#333] hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5" />
                    <span>Auto / Dynamic Target</span>
                  </span>
                  <span className="text-[10px] text-[#6b7280]">DEFAULT</span>
                </button>

                {workloads.length > 0 ? (
                  workloads.slice(0, 3).map((w) => (
                    <button
                      key={w.container_id}
                      type="button"
                      onClick={() => setSelectedTarget(w.container_name)}
                      className={`p-2 text-left text-xs border transition-all flex items-center justify-between ${
                        selectedTarget === w.container_name
                          ? "bg-[#141414] border-[#00ff41] text-[#00ff41] font-bold shadow-[0_0_10px_rgba(0,255,65,0.15)]"
                          : "bg-[#080808] border-[#1e1e1e] text-[#9ca3af] hover:border-[#333] hover:text-white"
                      }`}
                    >
                      <span className="truncate">{w.container_name}</span>
                      <span className="text-[10px] text-[#00ff41] uppercase">{w.status}</span>
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedTarget("auth-service")}
                    className={`p-2 text-left text-xs border transition-all flex items-center justify-between ${
                      selectedTarget === "auth-service"
                        ? "bg-[#141414] border-[#00ff41] text-[#00ff41] font-bold shadow-[0_0_10px_rgba(0,255,65,0.15)]"
                        : "bg-[#080808] border-[#1e1e1e] text-[#9ca3af] hover:border-[#333] hover:text-white"
                    }`}
                  >
                    <span>auth-service (production)</span>
                    <span className="text-[10px] text-[#00ff41]">RUNNING</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scenarios Selection Grid */}
            <div className="space-y-2">
              <label className="text-[11px] text-[#9ca3af] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#00ff41]" />
                Select Attack Vector:
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {scenarios.map((s) => {
                  const Icon = s.icon;
                  const isSelected = selectedScenario === s.id;

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedScenario(s.id)}
                      className={`p-3 text-left border transition-all flex flex-col justify-between gap-2 ${
                        isSelected
                          ? `bg-[#141414] ${s.border} border-l-4 shadow-[0_0_15px_rgba(0,0,0,0.8)]`
                          : "bg-[#0c0c0c] border-[#1e1e1e] hover:border-[#333] hover:bg-[#111111]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${s.color}`} />
                          <span className={`text-xs font-bold ${isSelected ? "text-white" : "text-[#d1d5db]"}`}>
                            {s.title}
                          </span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 border ${s.border} ${s.color} font-mono`}>
                          {s.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6b7280] leading-relaxed">
                        {s.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Scenario Preview Box */}
            <div className="bg-[#050505] border border-[#1e1e1e] p-3 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#9ca3af]">
                <span className="text-[#00ff41] font-bold">$</span>
                <span>sentinel inject --scenario={currentScenarioObj.id} --target={selectedTarget}</span>
              </div>
              <span className="text-[10px] text-[#6b7280] border border-[#1e1e1e] px-1.5 py-0.5">
                AUTO-HEAL ARMED
              </span>
            </div>
          </div>

          {/* Modal Footer with Singular CTA */}
          <div className="bg-[#0c0c0c] border-t border-[#1e1e1e] p-4 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-[#9ca3af] hover:text-white border border-[#1e1e1e] hover:border-[#333] transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isExecuting || executionSuccess}
              onClick={handleExecute}
              className={`px-5 py-2 text-xs font-mono font-bold border transition-all flex items-center gap-2 active:scale-95 shadow-lg ${
                executionSuccess
                  ? "bg-[#00ff41] text-black border-[#00ff41]"
                  : isExecuting
                  ? "bg-[#1f2937] text-[#9ca3af] border-[#374151]"
                  : "bg-[#00ff41] hover:bg-[#00ff41]/90 text-black border-[#00ff41] shadow-[0_0_15px_rgba(0,255,65,0.25)]"
              }`}
            >
              {executionSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>CHAOS INJECTED SUCCESSFULLY!</span>
                </>
              ) : isExecuting ? (
                <span>DISPATCHING SCENARIO TO SENTINEL...</span>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>$ execute-attack-vector -&gt;</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
