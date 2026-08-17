import React from "react";

interface StatusIndicatorProps {
  status: "connected" | "disconnected" | "connecting";
  label?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
}) => {
  const isLive = status === "connected";

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#0c0c0c] border border-[#1e1e1e] rounded-none">
      <span className="relative flex h-2 w-2">
        {isLive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff41] opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isLive
              ? "bg-[#00ff41]"
              : status === "connecting"
              ? "bg-[#f59e0b]"
              : "bg-[#ef4444]"
          }`}
        />
      </span>
      <span
        className={`text-xs font-mono tracking-tight font-medium ${
          isLive ? "text-[#00ff41]" : "text-[#9ca3af]"
        }`}
      >
        {label || (isLive ? "SSE: LIVE STREAM" : "SSE: OFFLINE")}
      </span>
    </div>
  );
};
