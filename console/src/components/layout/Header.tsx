import React, { useRef, useEffect } from "react";
import { Terminal, Shield, Activity, Server, FileText, Sliders } from "lucide-react";
import { StatusIndicator } from "../common/StatusIndicator";

interface HeaderProps {
  isConnected: boolean;
  activeTab: "feed" | "workloads" | "logs" | "config" | "system";
  setActiveTab: (tab: "feed" | "workloads" | "logs" | "config" | "system") => void;
  nodeCount: number;
  incidentCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  activeTab,
  setActiveTab,
  nodeCount,
  incidentCount,
}) => {
  const navRef = useRef<HTMLElement | null>(null);

  // Enable mouse wheel horizontal scrolling on the navigation bar
  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        navEl.scrollLeft += e.deltaY * 0.85;
      }
    };

    navEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      navEl.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const navButtons = (
    <>
      <button
        onClick={() => setActiveTab("feed")}
        className={`px-3 py-1.5 text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
          activeTab === "feed"
            ? "bg-[#141414] text-[#00ff41] font-bold border border-[#00ff41]/40 shadow-[0_0_10px_rgba(0,255,65,0.15)]"
            : "text-[#9ca3af] hover:text-white hover:bg-[#111111] border border-transparent"
        }`}
      >
        <Activity className="w-3.5 h-3.5" />
        <span>~/incident-feed</span>
        {incidentCount > 0 && (
          <span className="text-[10px] bg-[#1e1e1e] text-white px-1.5 py-0.2 rounded-xs">
            {incidentCount}
          </span>
        )}
      </button>

      <button
        onClick={() => setActiveTab("workloads")}
        className={`px-3 py-1.5 text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
          activeTab === "workloads"
            ? "bg-[#141414] text-[#00ff41] font-bold border border-[#00ff41]/40 shadow-[0_0_10px_rgba(0,255,65,0.15)]"
            : "text-[#9ca3af] hover:text-white hover:bg-[#111111] border border-transparent"
        }`}
      >
        <Shield className="w-3.5 h-3.5" />
        <span>~/workloads</span>
      </button>

      <button
        onClick={() => setActiveTab("logs")}
        className={`px-3 py-1.5 text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
          activeTab === "logs"
            ? "bg-[#141414] text-[#00ff41] font-bold border border-[#00ff41]/40 shadow-[0_0_10px_rgba(0,255,65,0.15)]"
            : "text-[#9ca3af] hover:text-white hover:bg-[#111111] border border-transparent"
        }`}
      >
        <FileText className="w-3.5 h-3.5" />
        <span>~/runtime-logs</span>
      </button>

      <button
        onClick={() => setActiveTab("config")}
        className={`px-3 py-1.5 text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
          activeTab === "config"
            ? "bg-[#141414] text-[#00ff41] font-bold border border-[#00ff41]/40 shadow-[0_0_10px_rgba(0,255,65,0.15)]"
            : "text-[#9ca3af] hover:text-white hover:bg-[#111111] border border-transparent"
        }`}
      >
        <Sliders className="w-3.5 h-3.5" />
        <span>~/config</span>
      </button>

      <button
        onClick={() => setActiveTab("system")}
        className={`px-3 py-1.5 text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
          activeTab === "system"
            ? "bg-[#141414] text-[#00ff41] font-bold border border-[#00ff41]/40 shadow-[0_0_10px_rgba(0,255,65,0.15)]"
            : "text-[#9ca3af] hover:text-white hover:bg-[#111111] border border-transparent"
        }`}
      >
        <Terminal className="w-3.5 h-3.5" />
        <span>~/node-topology</span>
      </button>
    </>
  );

  return (
    <header className="sticky top-0 z-40 bg-[#050505]/95 backdrop-blur-md border-b border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Main Header Bar */}
        <div className="flex items-center justify-between h-14 md:h-16 gap-3">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff41] opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00ff41] shadow-[0_0_10px_#00ff41]" />
              </span>
              <span className="text-white font-mono font-extrabold text-sm sm:text-base tracking-wider">
                kintsugi<span className="text-[#00ff41]">.aiops</span>
              </span>
            </div>

            <div className="hidden xl:flex items-center text-[11px] text-[#6b7280] font-mono border-l border-[#1e1e1e] pl-3">
              <span className="text-[#00ff41] mr-1">$</span>
              <span>kintsugi --telemetry-stream</span>
            </div>
          </div>

          {/* Center: Desktop Navigation Bar */}
          <nav
            ref={navRef}
            className="hidden md:flex items-center gap-1 bg-[#0a0a0a] border border-[#1e1e1e] p-1 rounded-sm overflow-x-auto max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] select-none"
          >
            {navButtons}
          </nav>

          {/* Right: Node Indicator & Live Connection Indicator */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-[#141414] border border-[#222] text-[10px] sm:text-[11px] font-mono text-[#9ca3af]">
              <Server className="w-3 h-3 text-[#00ff41]" />
              <span>{nodeCount} <span className="hidden xs:inline">Node</span></span>
            </div>

            <StatusIndicator
              status={isConnected ? "connected" : "disconnected"}
            />
          </div>
        </div>

        {/* Mobile Navigation Sub-Bar (Full-width Horizontal Scroll with Touch & Wheel) */}
        <div className="md:hidden pb-2.5 pt-0.5 border-t border-[#141414]">
          <nav
            className="flex items-center gap-1.5 bg-[#0a0a0a] border border-[#1e1e1e] p-1 rounded-sm overflow-x-auto w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] select-none touch-pan-x"
          >
            {navButtons}
          </nav>
        </div>
      </div>
    </header>
  );
};
