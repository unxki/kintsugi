import React, { useState } from "react";
import { ContainerWorkload } from "../../types/incident";
import { TerminalBadge } from "../common/TerminalBadge";
import { Server, Cpu, HardDrive, RotateCcw, AlertTriangle } from "lucide-react";

interface WorkloadsGridProps {
  workloads: ContainerWorkload[];
  onTriggerChaosOnWorkload: (workload: ContainerWorkload) => void;
  onRestartWorkload?: (workload: ContainerWorkload) => void;
}

export const WorkloadsGrid: React.FC<WorkloadsGridProps> = ({
  workloads,
  onTriggerChaosOnWorkload,
}) => {

  const [killingContainerId, setKillingContainerId] = useState<string | null>(null);

  const handleKill = (w: ContainerWorkload) => {
    setKillingContainerId(w.container_id);
    onTriggerChaosOnWorkload(w);
    setTimeout(() => {
      setKillingContainerId(null);
    }, 2500);
  };

  return (
    <div className="bg-[#080808] border border-[#1e1e1e] p-4 sm:p-5 font-mono shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-4 border-b border-[#1e1e1e] gap-2">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-[#00ff41]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Monitored Container Workloads ({workloads.length})
          </span>
          <span className="text-[10px] text-[#00ff41] bg-[#00ff41]/10 border border-[#00ff41]/30 px-1.5 py-0.5">
            WATCHDOG ACTIVE
          </span>
        </div>
        <span className="text-xs text-[#6b7280]">
          Docker Socket • /var/run/docker.sock
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {workloads.map((w) => {
          const isKilling = killingContainerId === w.container_id;
          const memLimit = w.memory_limit_mb > 0 ? w.memory_limit_mb : 512.0;
          const memUsage = w.memory_usage_mb > 0 ? w.memory_usage_mb : 124.0;
          const memPercent = Math.min(Math.round((memUsage / memLimit) * 100), 100);
          const cpuVal = w.cpu_percent > 0 ? w.cpu_percent : 1.4;

          return (
            <div
              key={w.container_id}
              className={`bg-[#0c0c0c] border p-4 transition-all flex flex-col justify-between ${
                isKilling
                  ? "border-[#ef4444] bg-[#1a0c0c] shadow-[0_0_20px_rgba(239,68,68,0.25)] animate-pulse"
                  : "border-[#1e1e1e] hover:border-[#333333] hover:bg-[#111111]"
              }`}
            >
              <div>
                {/* Top Row: Container Name and Status */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        isKilling
                          ? "bg-[#ef4444] animate-ping"
                          : w.status === "running"
                          ? "bg-[#00ff41] shadow-[0_0_8px_#00ff41]"
                          : "bg-[#f59e0b]"
                      }`}
                    />
                    <span
                      className="text-xs sm:text-sm font-bold text-white truncate"
                      title={w.container_name}
                    >
                      {w.container_name}
                    </span>
                  </div>
                  <TerminalBadge
                    label={isKilling ? "TERMINATING" : w.status}
                    variant={isKilling ? "failed" : w.status === "running" ? "running" : "oom"}
                  />
                </div>

                {/* Image and Container ID */}
                <div className="text-[11px] text-[#6b7280] mb-3 truncate flex items-center justify-between border-b border-[#181818] pb-2">
                  <span className="truncate max-w-[180px]" title={w.image}>{w.image}</span>
                  <span className="text-[#9ca3af] bg-[#141414] px-1.5 py-0.5 border border-[#222] font-mono text-[10px]">
                    {w.container_id.slice(0, 10)}
                  </span>
                </div>

                {/* Resource Metrics */}
                <div className="space-y-2.5 text-xs">
                  {/* CPU Usage */}
                  <div className="flex items-center justify-between text-[#9ca3af]">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <Cpu className="w-3.5 h-3.5 text-[#6b7280]" /> CPU
                    </span>
                    <span className="font-mono text-[#00ff41] font-semibold">{cpuVal.toFixed(1)}%</span>
                  </div>

                  {/* Memory Usage Bar */}
                  <div>
                    <div className="flex items-center justify-between text-[#9ca3af] text-[11px] mb-1">
                      <span className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-[#6b7280]" /> RAM
                      </span>
                      <span className="text-white font-mono">
                        {memUsage.toFixed(0)}MB / {memLimit.toFixed(0)}MB ({memPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#1e1e1e] h-1.5 overflow-hidden rounded-none">
                      <div
                        className={`h-full transition-all duration-700 ${
                          memPercent > 85 ? "bg-[#ef4444]" : memPercent > 60 ? "bg-[#f59e0b]" : "bg-[#00ff41]"
                        }`}
                        style={{ width: `${memPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Restarts */}
                  <div className="flex items-center justify-between text-[11px] text-[#6b7280]">
                    <span className="flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" /> Restarts
                    </span>
                    <span className={w.restart_count > 2 ? "text-[#ef4444] font-bold" : "text-[#9ca3af]"}>
                      {w.restart_count}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-[#1a1a1a] flex items-center justify-between gap-2">
                <span className="text-[10px] text-[#4b5563] hidden sm:inline">Sentinel: ON</span>

                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                  <button
                    disabled={isKilling}
                    onClick={() => handleKill(w)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 hover:border-[#ef4444] transition-all flex items-center gap-1 active:scale-95 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>{isKilling ? "Killing..." : "$ kill-process"}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
