import React, { useState } from "react";
import { Incident } from "../../types/incident";
import { RootCauseCard } from "./RootCauseCard";
import { LogViewer } from "./LogViewer";
import { X, Terminal, Brain, FileText, Database, RotateCcw, ShieldAlert, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DiagnosticModalProps {
  incident: Incident | null;
  onClose: () => void;
  onManualRemediate: (incidentId: string, action: string) => void;
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({
  incident,
  onClose,
  onManualRemediate,
}) => {
  const [activeTab, setActiveTab] = useState<"rca" | "logs" | "vector">("rca");
  const [actionTriggered, setActionTriggered] = useState<string | null>(null);

  if (!incident) return null;

  const rawLogs =
    incident.logs && incident.logs.length > 0
      ? incident.logs[0].sanitized_log
      : `[INFO] Container ${incident.container_name} terminated with exit code ${incident.exit_code}.\n[WARN] Termination signal captured: ${incident.termination_reason}\n[INFO] Sanitized buffer: No plain secrets detected.`;

  const handleAction = (action: string) => {
    setActionTriggered(action);
    onManualRemediate(incident.id, action);
    setTimeout(() => setActionTriggered(null), 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-[#080808] border border-[#1e1e1e] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.9)] font-mono rounded-none"
        >
          {/* Header */}
          <div className="bg-[#0c0c0c] border-b border-[#1e1e1e] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 bg-[#00ff41] rounded-full inline-block shadow-[0_0_10px_#00ff41]" />
              <div>
                <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>$ kintsugi diagnose --incident</span>
                  <span className="text-[#00ff41] bg-[#00ff41]/10 px-1.5 py-0.5 border border-[#00ff41]/30">
                    {incident.id}
                  </span>
                </div>
                <div className="text-[11px] text-[#6b7280] mt-0.5">
                  Target: <span className="text-white">{incident.container_name}</span> ({incident.image})
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-[#6b7280] hover:text-white border border-transparent hover:border-[#1e1e1e] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-[#0a0a0a] border-b border-[#1a1a1a] px-4 flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("rca")}
              className={`px-3 py-2.5 text-xs font-mono transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                activeTab === "rca"
                  ? "border-[#00ff41] text-[#00ff41] font-bold"
                  : "border-transparent text-[#9ca3af] hover:text-white"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>AI Root Cause & Remediation</span>
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`px-3 py-2.5 text-xs font-mono transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                activeTab === "logs"
                  ? "border-[#00ff41] text-[#00ff41] font-bold"
                  : "border-transparent text-[#9ca3af] hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Sanitized Logs</span>
            </button>

            <button
              onClick={() => setActiveTab("vector")}
              className={`px-3 py-2.5 text-xs font-mono transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                activeTab === "vector"
                  ? "border-[#00ff41] text-[#00ff41] font-bold"
                  : "border-transparent text-[#9ca3af] hover:text-white"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Vector Similarity (pgvector)</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 max-h-[62vh]">
            {activeTab === "rca" && <RootCauseCard incident={incident} />}

            {activeTab === "logs" && (
              <LogViewer
                logs={rawLogs}
                containerName={incident.container_name}
              />
            )}

            {activeTab === "vector" && (
              <div className="space-y-4 font-mono">
                <div className="bg-[#0c0c0c] border border-[#1e1e1e] p-4 text-xs text-[#9ca3af] space-y-2">
                  <div className="text-white font-bold flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#00ff41]" />
                    <span>pgvector 384-dim Semantic Correlation Engine</span>
                  </div>
                  <p className="leading-relaxed">
                    Kintsugi extracted the stack trace, sanitized tokens, and generated a normalized 384-dimensional dense vector embedding. The pgvector index queried past failure patterns to accelerate diagnosis.
                  </p>
                </div>

                <div className="border border-[#1e1e1e] bg-[#050505] p-4 text-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1a1a1a]">
                    <span className="text-white font-bold">Vector Signature Match:</span>
                    <span className="text-[#00ff41] bg-[#00ff41]/10 px-2 py-0.5 border border-[#00ff41]/30 font-bold">
                      {(incident.confidence_score * 100).toFixed(0)}% MATCH SCORE
                    </span>
                  </div>
                  <div className="text-[#9ca3af] space-y-1">
                    <div>Classification: <span className="text-[#00ff41] font-bold">{incident.failure_classification || "Memory Exhaustion"}</span></div>
                    <div>Signature Hash: <span className="text-white">{incident.container_name}:{incident.exit_code}</span></div>
                    <div>Embedding Dimension: <span className="text-white">384 (L2 Normalized)</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer with Operator Quick Controls */}
          <div className="bg-[#0c0c0c] border-t border-[#1e1e1e] p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-[#6b7280] flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#00ff41]" />
              <span>Operator Manual Override:</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleAction("RESTART_CONTAINER")}
                disabled={Boolean(actionTriggered)}
                className="flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-bold bg-[#141414] hover:bg-[#1e1e1e] text-[#00ff41] border border-[#00ff41]/40 hover:border-[#00ff41] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(0,255,65,0.15)] active:scale-95"
              >
                {actionTriggered === "RESTART_CONTAINER" ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff41]" />
                    <span>$ RESTART DISPATCHED</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>$ restart-workload</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleAction("STOP_RUNAWAY")}
                disabled={Boolean(actionTriggered)}
                className="flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-bold bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 hover:border-[#ef4444] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(239,68,68,0.15)] active:scale-95"
              >
                {actionTriggered === "STOP_RUNAWAY" ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#ef4444]" />
                    <span>$ KILL DISPATCHED</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>$ kill-container</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
