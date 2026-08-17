import React from "react";
import { Loader2, CheckCircle2, ShieldAlert, AlertTriangle, Play, Sparkles } from "lucide-react";

export type BadgeVariant =
  | "detected"
  | "diagnosing"
  | "remediating"
  | "resolved"
  | "passive"
  | "escalated"
  | "failed"
  | "running"
  | "oom"
  | "panic"
  | "neutral";

interface TerminalBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

export const TerminalBadge: React.FC<TerminalBadgeProps> = ({
  label,
  variant = "neutral",
  size = "sm",
}) => {
  const getStyles = () => {
    switch (variant) {
      case "resolved":
      case "running":
        return "bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/40 shadow-[0_0_8px_rgba(0,255,65,0.15)]";
      case "passive":
        return "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]";
      case "diagnosing":
        return "bg-[#06b6d4]/10 text-[#06b6d4] border-[#06b6d4]/40 shadow-[0_0_8px_rgba(6,182,212,0.15)]";
      case "remediating":
        return "bg-[#a855f7]/10 text-[#c084fc] border-[#a855f7]/40 shadow-[0_0_8px_rgba(168,85,247,0.15)]";
      case "detected":
      case "oom":
        return "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]";
      case "escalated":
      case "failed":
      case "panic":
        return "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/50 shadow-[0_0_8px_rgba(239,68,68,0.2)]";
      default:
        return "bg-[#141414] text-[#9ca3af] border-[#262626]";
    }
  };

  const getIcon = () => {
    switch (variant) {
      case "resolved":
        return <CheckCircle2 className="w-3 h-3 text-[#00ff41]" />;
      case "passive":
        return <AlertTriangle className="w-3 h-3 text-[#f59e0b]" />;
      case "diagnosing":
        return <Sparkles className="w-3 h-3 text-[#06b6d4] animate-spin" />;
      case "remediating":
        return <Loader2 className="w-3 h-3 text-[#c084fc] animate-spin" />;
      case "escalated":
      case "failed":
        return <ShieldAlert className="w-3 h-3 text-[#ef4444] animate-pulse" />;
      case "detected":
      case "oom":
        return <AlertTriangle className="w-3 h-3 text-[#f59e0b]" />;
      case "running":
        return <Play className="w-2.5 h-2.5 text-[#00ff41] fill-[#00ff41]" />;
      default:
        return null;
    }
  };

  const sizeClass = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono uppercase tracking-wider font-semibold border ${sizeClass} ${getStyles()} transition-all`}
    >
      {getIcon()}
      <span>{label}</span>
    </span>
  );
};
