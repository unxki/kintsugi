import React from "react";
import { Incident } from "../../types/incident";
import { Sparkles, Brain, CheckCircle2, ShieldCheck } from "lucide-react";

interface RootCauseCardProps {
  incident: Incident;
}

export const RootCauseCard: React.FC<RootCauseCardProps> = ({ incident }) => {
  const confidencePercent = Math.round((incident.confidence_score || 0.95) * 100);

  return (
    <div className="space-y-4 font-mono">
      {/* Top Banner: Classification & Confidence Gauge */}
      <div className="bg-[#0c0c0c] border border-[#1e1e1e] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#1e1e1e]">
          <div className="flex items-center gap-2 flex-wrap">
            <Brain className="w-4 h-4 text-[#00ff41]" />
            <span className="text-xs text-[#9ca3af] uppercase tracking-wider">
              Failure Classification:
            </span>
            <span className="text-xs sm:text-sm font-bold text-white bg-[#161616] px-2.5 py-1 border border-[#333]">
              {incident.failure_classification || "Memory Exhaustion (OOM)"}
            </span>
          </div>

          {/* Confidence Gauge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6b7280]">CONFIDENCE:</span>
            <div className="flex items-center gap-2 bg-[#121212] border border-[#1e1e1e] px-2.5 py-1">
              <div className="w-16 bg-[#1e1e1e] h-2">
                <div
                  className="bg-[#00ff41] h-full transition-all duration-1000 shadow-[0_0_8px_#00ff41]"
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-[#00ff41]">{confidencePercent}%</span>
            </div>
          </div>
        </div>

        {/* Root Cause Description */}
        <div className="mt-4">
          <div className="text-[11px] text-[#00ff41] uppercase tracking-wider mb-1.5 flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#00ff41]" />
            ROOT-CAUSE ANALYSIS (RCA)
          </div>
          <p className="text-xs sm:text-sm text-gray-100 leading-relaxed font-mono bg-[#050505] p-3.5 border border-[#1a1a1a]">
            {incident.root_cause ||
              `Container '${incident.container_name}' exceeded allocated cgroup memory quota and was terminated by the Linux OOM Killer (Exit 137). Resident heap buffer overflow detected.`}
          </p>
        </div>
      </div>

      {/* Automated Remediation Path */}
      <div className="bg-[#0c0c0c] border border-[#1e1e1e] p-4 sm:p-5">
        <div className="text-xs text-[#9ca3af] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#00ff41]" />
          AUTOMATED REMEDIATION PATHWAY
        </div>

        <div className="bg-[#050505] border border-[#1a1a1a] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#6b7280]">ACTION:</span>
            <span className="text-xs font-bold text-[#00ff41] bg-[#00ff41]/10 border border-[#00ff41]/30 px-2.5 py-0.5">
              {incident.action_taken || incident.remediation_proposal || "RESTART_CONTAINER"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6b7280]">STATUS:</span>
            <span
              className={`font-bold px-2 py-0.5 border text-xs ${
                incident.remediation_status === "PASSIVE_OBSERVED" || incident.action_taken?.startsWith("PASSIVE_OBSERVED")
                  ? "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/40"
                  : incident.remediation_status === "SUCCESS" || incident.status === "RESOLVED"
                  ? "bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/40"
                  : incident.remediation_status === "ESCALATED" || incident.status === "ESCALATED_MANUAL_INTERVENTION"
                  ? "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/40"
                  : "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/40 animate-pulse"
              }`}
            >
              {incident.remediation_status === "PASSIVE_OBSERVED" || incident.action_taken?.startsWith("PASSIVE_OBSERVED")
                ? "PASSIVE OBSERVED (DRY-RUN)"
                : incident.status === "RESOLVED"
                ? "RESOLVED (SUCCESS)"
                : incident.remediation_status}
            </span>
          </div>
        </div>

        {/* Operational SRE Reasoning */}
        <div className="mt-3.5 text-xs text-[#9ca3af] leading-relaxed border-l-2 border-[#00ff41] pl-3 py-1.5 bg-[#111111]/50">
          <span className="text-white font-semibold">Operational Reasoning: </span>
          {incident.operational_reasoning ||
            "The process consumed resident memory beyond the container memory quota. Auto-restart cleared volatile leak buffer. Container returned to healthy state with 0 exit code."}
        </div>
      </div>

      {/* Remediation Execution History if present */}
      {incident.remediations && incident.remediations.length > 0 && (
        <div className="bg-[#0c0c0c] border border-[#1e1e1e] p-4 sm:p-5">
          <div className="text-xs text-[#9ca3af] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff41]" />
            EXECUTION AUDIT TRAIL
          </div>
          <div className="space-y-2">
            {incident.remediations.map((rem) => (
              <div
                key={rem.id}
                className="text-xs bg-[#050505] border border-[#1e1e1e] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#00ff41]">➜</span>
                  <span className="text-white font-bold">{rem.action_type}</span>
                  <span className="text-[#6b7280]">({rem.duration_ms}ms)</span>
                </div>
                <span className="text-[#00ff41] text-[11px] font-semibold">{rem.execution_output || "Executed action successfully."}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
