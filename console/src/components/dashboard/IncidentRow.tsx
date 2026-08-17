import React from "react";
import { Incident } from "../../types/incident";
import { TerminalBadge, BadgeVariant } from "../common/TerminalBadge";
import { ShieldAlert, Cpu, ArrowRight, Clock, RotateCcw } from "lucide-react";

interface IncidentRowProps {
  incident: Incident;
  onSelect: (incident: Incident) => void;
  onQuickRemediate?: (incidentId: string, action: string) => void;
  isSelected?: boolean;
}

export const IncidentRow: React.FC<IncidentRowProps> = ({
  incident,
  onSelect,
  onQuickRemediate,
  isSelected,
}) => {
  const isEscalated =
    incident.is_flapping ||
    incident.status === "ESCALATED_MANUAL_INTERVENTION" ||
    incident.remediation_status === "ESCALATED";

  const isPassive =
    incident.remediation_status === "PASSIVE_OBSERVED" ||
    (incident.action_taken && incident.action_taken.startsWith("PASSIVE_OBSERVED"));

  const getBadgeVariant = (status: string): BadgeVariant => {
    if (isEscalated) return "escalated";
    if (isPassive) return "passive";
    switch (status) {
      case "RESOLVED":
        return "resolved";
      case "DIAGNOSING":
        return "diagnosing";
      case "REMEDIATING":
        return "remediating";
      case "FAILED":
        return "failed";
      default:
        return "detected";
    }
  };

  const formattedTime = new Date(incident.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const isLive =
    !isEscalated &&
    (incident.status === "DETECTED" ||
      incident.status === "DIAGNOSING" ||
      incident.status === "REMEDIATING");

  return (
    <div
      onClick={() => onSelect(incident)}
      className={`group relative p-3 sm:p-4 bg-[#0c0c0c] border transition-all cursor-pointer select-none font-mono ${
        isSelected
          ? "border-[#00ff41] bg-[#121212] shadow-[0_0_18px_rgba(0,255,65,0.15)]"
          : isEscalated
          ? "border-[#ef4444]/60 bg-[#140808] hover:border-[#ef4444]"
          : isLive
          ? "border-[#06b6d4]/50 bg-[#0d1315] hover:border-[#06b6d4]"
          : "border-[#1e1e1e] hover:border-[#333333] hover:bg-[#111111]"
      }`}
    >
      {/* Indicator bar on left */}
      {isEscalated ? (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ef4444] animate-pulse" />
      ) : isLive ? (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#06b6d4] animate-pulse" />
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Left Section: Time, Container Info, Exit status */}
        <div className="flex items-start sm:items-center gap-3">
          <span className="text-xs text-[#6b7280] font-mono shrink-0 flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#4b5563]" />
            {formattedTime}
          </span>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-bold text-white group-hover:text-[#00ff41] transition-colors flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#6b7280] group-hover:text-[#00ff41]" />
              {incident.container_name}
            </span>

            <span className="text-[11px] text-[#6b7280] hidden md:inline truncate max-w-xs">
              ({incident.image})
            </span>

            <span
              className={`text-[11px] font-bold px-1.5 py-0.5 border ${
                incident.exit_code === 137
                  ? "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30"
                  : incident.exit_code === 0
                  ? "text-[#00ff41] bg-[#00ff41]/10 border-[#00ff41]/30"
                  : "text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/30"
              }`}
            >
              exit {incident.exit_code}
            </span>

            {incident.is_flapping && (
              <span className="text-[10px] uppercase font-bold text-[#ef4444] bg-[#ef4444]/20 border border-[#ef4444] px-1.5 py-0.5 animate-pulse flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                CIRCUIT TRIPPED ({incident.restart_count}X)
              </span>
            )}
          </div>
        </div>

        {/* Right Section: Failure Classification & Status Badge */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0 flex-wrap">
          {incident.failure_classification && (
            <span className="text-[11px] text-[#9ca3af] hidden lg:inline max-w-xs truncate bg-[#141414] px-2 py-0.5 border border-[#222]">
              {incident.failure_classification}
            </span>
          )}

          <TerminalBadge
            label={
              isEscalated
                ? "CIRCUIT TRIPPED"
                : isPassive
                ? "PASSIVE OBSERVED"
                : incident.status.replace("_MANUAL_INTERVENTION", "")
            }
            variant={getBadgeVariant(incident.status)}
          />

          {/* Quick Override Button for Flapping Incidents */}
          {isEscalated && onQuickRemediate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickRemediate(incident.id, "RESTART_CONTAINER");
              }}
              className="px-2 py-0.5 text-[11px] font-bold bg-[#00ff41]/15 hover:bg-[#00ff41]/30 text-[#00ff41] border border-[#00ff41]/60 transition-all flex items-center gap-1 active:scale-95 shadow-[0_0_10px_rgba(0,255,65,0.2)]"
              title="Force restart workload and reset circuit breaker"
            >
              <RotateCcw className="w-3 h-3" />
              <span>$ override-restart</span>
            </button>
          )}

          <button className="text-xs text-[#6b7280] group-hover:text-[#00ff41] flex items-center gap-1 pl-1 font-bold">
            <span className="hidden sm:inline">$ inspect</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* Root cause snippet preview */}
      {incident.root_cause && (
        <div className="mt-2 text-xs text-[#9ca3af] border-t border-[#1a1a1a] pt-2 flex items-start gap-2">
          <span className={isEscalated ? "text-[#ef4444] shrink-0 font-bold" : "text-[#00ff41] shrink-0 font-bold"}>
            ➜
          </span>
          <span className="truncate leading-relaxed text-[#d1d5db]">{incident.root_cause}</span>
        </div>
      )}
    </div>
  );
};
