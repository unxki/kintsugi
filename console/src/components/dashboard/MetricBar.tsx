import React from "react";
import { SystemStats } from "../../types/incident";
import { Server, Activity, Clock, CheckCircle2, ShieldAlert } from "lucide-react";

interface MetricBarProps {
  stats: SystemStats;
}

export const MetricBar: React.FC<MetricBarProps> = ({ stats }) => {
  const autoHealPercentage =
    stats.total_incidents > 0
      ? Math.round((stats.auto_healed_count / stats.total_incidents) * 100)
      : 100;

  const metrics = [
    {
      id: "01",
      label: "ACTIVE SENTINELS",
      value: `${stats.active_agents} NODE`,
      sub: "Go Daemon v1.22",
      icon: Server,
      accent: "text-[#00ff41]",
      border: "border-l-[#00ff41]",
    },
    {
      id: "02",
      label: "MONITORED WORKLOADS",
      value: `${stats.monitored_workloads} CONTAINERS`,
      sub: "Docker Engine Hook",
      icon: Activity,
      accent: "text-white",
      border: "border-l-[#06b6d4]",
    },
    {
      id: "03",
      label: "MTTR LATENCY",
      value: `${stats.mean_time_to_recovery_sec}s`,
      sub: "Autonomous Recovery",
      icon: Clock,
      accent: "text-[#00ff41]",
      border: "border-l-[#00ff41]",
    },
    {
      id: "04",
      label: "AUTO-HEAL SUCCESS",
      value: `${autoHealPercentage}%`,
      sub: `${stats.auto_healed_count} / ${stats.total_incidents} Resolved`,
      icon: CheckCircle2,
      accent: "text-[#00ff41]",
      border: "border-l-[#00ff41]",
    },
    {
      id: "05",
      label: "ESCALATIONS",
      value: `${stats.escalated_count}`,
      sub: stats.escalated_count > 0 ? "Operator Required" : "Circuit Armed",
      icon: ShieldAlert,
      accent: stats.escalated_count > 0 ? "text-[#ef4444]" : "text-[#9ca3af]",
      border: stats.escalated_count > 0 ? "border-l-[#ef4444]" : "border-l-[#333333]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {metrics.map((m) => {
        const IconComponent = m.icon;
        return (
          <div
            key={m.id}
            className={`bg-[#0c0c0c] border border-[#1e1e1e] border-l-2 ${m.border} p-3.5 flex flex-col justify-between hover:border-[#333333] transition-all hover:bg-[#111111]`}
          >
            <div className="flex items-center justify-between text-xs text-[#6b7280]">
              <span className="font-mono text-[10px] text-[#00ff41] font-bold">[{m.id}]</span>
              <IconComponent className="w-3.5 h-3.5 text-[#6b7280]" />
            </div>

            <div className="my-2">
              <span className="text-[10px] text-[#9ca3af] uppercase tracking-wider block font-mono">
                {m.label}
              </span>
              <span className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${m.accent}`}>
                {m.value}
              </span>
            </div>

            <div className="text-[11px] text-[#6b7280] font-mono truncate border-t border-[#1a1a1a] pt-1.5 mt-1">
              {m.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
};
