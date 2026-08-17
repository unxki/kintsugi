import React, { useState, useMemo } from "react";
import { Incident } from "../../types/incident";
import { IncidentRow } from "./IncidentRow";
import { Search, Filter, Terminal, RefreshCw, Trash2, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface IncidentFeedProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  selectedIncidentId?: string;
  onRefresh: () => void;
  onClearIncidents?: () => void;
  onQuickRemediate?: (incidentId: string, action: string) => void;
  onBatchRemediate?: () => void;
}

export const IncidentFeed: React.FC<IncidentFeedProps> = ({
  incidents,
  onSelectIncident,
  selectedIncidentId,
  onRefresh,
  onClearIncidents,
  onQuickRemediate,
  onBatchRemediate,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const unresolvedCount = useMemo(() => {
    return incidents.filter(
      (inc) =>
        inc.status !== "RESOLVED" ||
        inc.remediation_status === "PASSIVE_OBSERVED" ||
        inc.remediation_status === "ESCALATED" ||
        inc.is_flapping
    ).length;
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "CRITICAL" && inc.status !== "FAILED" && inc.status !== "ESCALATED_MANUAL_INTERVENTION") {
          return false;
        }
        if (statusFilter === "RESOLVED" && inc.status !== "RESOLVED") {
          return false;
        }
        if (statusFilter === "ACTIVE" && (inc.status === "RESOLVED" || inc.status === "FAILED")) {
          return false;
        }
        if (statusFilter === "FLAPPING" && !inc.is_flapping) {
          return false;
        }
        if (statusFilter === "OOM" && inc.exit_code !== 137 && inc.termination_reason !== "oom") {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesName = inc.container_name.toLowerCase().includes(q);
        const matchesClass = inc.failure_classification?.toLowerCase().includes(q) ?? false;
        const matchesRoot = inc.root_cause?.toLowerCase().includes(q) ?? false;
        const matchesImage = inc.image.toLowerCase().includes(q);
        return matchesName || matchesClass || matchesRoot || matchesImage;
      }

      return true;
    });
  }, [incidents, searchQuery, statusFilter]);

  return (
    <div className="bg-[#080808] border border-[#1e1e1e] flex flex-col h-full font-mono shadow-2xl">
      {/* Top Header Bar */}
      <div className="p-3 sm:p-4 border-b border-[#1e1e1e] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0c0c0c]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#00ff41]" />
          <span className="text-xs text-white font-bold tracking-wide">
            $ cat /var/log/kintsugi/telemetry.stream
          </span>
          <span className="text-[10px] text-[#00ff41] bg-[#00ff41]/10 border border-[#00ff41]/30 px-2 py-0.5 font-bold">
            {incidents.length} INCIDENTS
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {onBatchRemediate && unresolvedCount > 0 && (
            <button
              onClick={onBatchRemediate}
              className="px-2.5 py-1 text-[11px] font-bold bg-[#00ff41]/15 hover:bg-[#00ff41]/30 text-[#00ff41] border border-[#00ff41]/60 transition-all flex items-center gap-1.5 active:scale-95 shadow-[0_0_12px_rgba(0,255,65,0.25)]"
              title="Autonomously remediate and auto-heal all unresolved/passive incidents"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>$ heal-all-unresolved ({unresolvedCount})</span>
            </button>
          )}

          {onClearIncidents && incidents.length > 0 && (
            <button
              onClick={onClearIncidents}
              className="p-1.5 text-xs text-[#6b7280] hover:text-[#ef4444] border border-[#1e1e1e] hover:border-[#ef4444]/40 transition-colors"
              title="Clear all incidents"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onRefresh}
            className="p-1.5 text-xs text-[#9ca3af] hover:text-[#00ff41] border border-[#1e1e1e] hover:border-[#00ff41]/40 transition-colors"
            title="Refresh feed"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 border-b border-[#1a1a1a] flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between bg-[#080808]">
        {/* Search input with grep style */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#6b7280]">
            <Search className="w-3.5 h-3.5 text-[#00ff41]" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="grep container, root cause, error signature..."
            className="w-full bg-[#0c0c0c] border border-[#1e1e1e] text-xs text-white pl-8 pr-12 py-1.5 focus:outline-none focus:border-[#00ff41] transition-colors placeholder:text-[#4b5563]"
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <span className="text-[10px] text-[#4b5563] border border-[#1e1e1e] px-1">
              /
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[10px] text-[#6b7280] flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            FILTER:
          </span>

          {["ALL", "ACTIVE", "RESOLVED", "CRITICAL", "FLAPPING", "OOM"].map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-2.5 py-1 text-[11px] font-mono tracking-wider transition-all border ${
                statusFilter === filter
                  ? "bg-[#00ff41] text-black font-bold border-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.25)]"
                  : "bg-[#0c0c0c] text-[#9ca3af] border-[#1e1e1e] hover:border-[#333333] hover:text-white"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Incident Stream Table / Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#141414] max-h-[620px] custom-scrollbar">
        {filteredIncidents.length === 0 ? (
          <div className="py-16 text-center text-[#6b7280]">
            <Terminal className="w-8 h-8 mx-auto mb-2 text-[#333333]" />
            <p className="text-xs">
              {incidents.length === 0
                ? "All workloads healthy. No incidents detected in telemetry buffer."
                : "No incidents match the active search and filter criteria."}
            </p>
            <p className="text-[10px] text-[#4b5563] mt-1">
              Sentinel daemon listening on /var/run/docker.sock
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredIncidents.map((incident) => (
              <motion.div
                key={incident.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <IncidentRow
                  incident={incident}
                  isSelected={incident.id === selectedIncidentId}
                  onSelect={onSelectIncident}
                  onQuickRemediate={onQuickRemediate}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Feed Bottom Status Line */}
      <div className="px-4 py-2 border-t border-[#1a1a1a] bg-[#050505] flex items-center justify-between text-[11px] text-[#6b7280]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00ff41] animate-ping" />
          <span>REALTIME SSE BUFFER CONNECTED</span>
        </div>
        <div>
          <span>Showing {filteredIncidents.length} of {incidents.length} events</span>
        </div>
      </div>
    </div>
  );
};
