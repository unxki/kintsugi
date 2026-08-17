import React, { useState, useRef, useEffect } from "react";
import { LogEntry } from "../terminal/TerminalDrawer";
import { Terminal, Search, Download, Copy, Check, Filter, ShieldCheck, Database, Brain, Cpu, Trash2, RefreshCw } from "lucide-react";

interface RuntimeLogsViewProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  onRefresh: () => void;
}

export const RuntimeLogsView: React.FC<RuntimeLogsViewProps> = ({
  logs,
  onClearLogs,
  onRefresh,
}) => {
  const [activeSource, setActiveSource] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (activeSource !== "ALL" && log.source !== activeSource) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.source.toLowerCase().includes(q) ||
        (log.containerName && log.containerName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCopy = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.source}] [${l.level}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.source}] [${l.level}] ${l.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kintsugi-runtime-${new Date().toISOString().slice(0, 19)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSourceStyle = (source: LogEntry["source"]) => {
    switch (source) {
      case "AI_RCA":
        return "text-[#06b6d4] bg-[#06b6d4]/10 border-[#06b6d4]/30";
      case "SENTINEL":
        return "text-[#00ff41] bg-[#00ff41]/10 border-[#00ff41]/30";
      case "PGVECTOR":
        return "text-[#a855f7] bg-[#a855f7]/10 border-[#a855f7]/30";
      case "POLICY":
        return "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30";
      case "DOCKER":
        return "text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/30";
      case "SANITIZER":
        return "text-[#ec4899] bg-[#ec4899]/10 border-[#ec4899]/30";
      default:
        return "text-[#9ca3af] bg-[#141414] border-[#222]";
    }
  };

  const getLevelColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "ERROR":
        return "text-[#ef4444]";
      case "WARN":
        return "text-[#f59e0b]";
      case "SUCCESS":
        return "text-[#00ff41]";
      case "DEBUG":
        return "text-[#6b7280]";
      default:
        return "text-[#d1d5db]";
    }
  };

  return (
    <div className="bg-[#080808] border border-[#1e1e1e] font-mono shadow-2xl flex flex-col h-[720px]">
      {/* Header Bar */}
      <div className="p-4 bg-[#0c0c0c] border-b border-[#1e1e1e] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-[#00ff41]" />
          <div>
            <div className="text-xs sm:text-sm font-bold text-white tracking-wide">
              KINTSUGI ENGINE UNDER-THE-HOOD OBSERVABILITY
            </div>
            <div className="text-[11px] text-[#6b7280]">
              Demultiplexed Docker socket stream, Go daemon heartbeats, vector similarity calculations, and AI reasoning traces
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={onRefresh}
            className="p-1.5 text-xs text-[#9ca3af] hover:text-white bg-[#141414] border border-[#222] hover:border-[#333]"
            title="Refresh logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClearLogs}
            className="p-1.5 text-xs text-[#9ca3af] hover:text-[#ef4444] bg-[#141414] border border-[#222] hover:border-[#ef4444]/40"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDownload}
            className="px-2.5 py-1 text-xs bg-[#141414] hover:bg-[#1e1e1e] text-[#9ca3af] hover:text-white border border-[#222] flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT</span>
          </button>

          <button
            onClick={handleCopy}
            className="px-3 py-1 text-xs bg-[#00ff41]/10 hover:bg-[#00ff41]/20 text-[#00ff41] border border-[#00ff41]/40 flex items-center gap-1.5 font-bold"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#00ff41]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "COPIED" : "COPY ALL"}</span>
          </button>
        </div>
      </div>

      {/* Source Tabs & Search */}
      <div className="bg-[#0a0a0a] border-b border-[#181818] p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Source Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] text-[#6b7280] flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3 h-3" /> STREAM:
          </span>
          {["ALL", "SENTINEL", "DOCKER", "AI_RCA", "PGVECTOR", "POLICY", "SANITIZER"].map((src) => (
            <button
              key={src}
              onClick={() => setActiveSource(src)}
              className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider border transition-all shrink-0 ${
                activeSource === src
                  ? "bg-[#00ff41] text-black font-bold border-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.25)]"
                  : "bg-[#121212] text-[#9ca3af] border-[#222] hover:border-[#333] hover:text-white"
              }`}
            >
              {src}
            </button>
          ))}
        </div>

        {/* Search & Auto-Scroll Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full bg-[#121212] border border-[#222] text-xs text-white pl-7 pr-3 py-1 focus:outline-none focus:border-[#00ff41]"
            />
            <Search className="w-3.5 h-3.5 text-[#6b7280] absolute left-2 top-1.5" />
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 text-[11px] font-bold border transition-colors shrink-0 ${
              autoScroll
                ? "text-[#00ff41] border-[#00ff41]/40 bg-[#00ff41]/10"
                : "text-[#6b7280] border-[#222] bg-[#121212]"
            }`}
          >
            Auto-Scroll: {autoScroll ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Main Terminal Output */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1.5 text-xs font-mono select-text bg-[#030303] leading-relaxed"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-xs text-[#6b7280] italic py-24 text-center">
            -- No matching runtime logs captured yet. Listening to Docker daemon and Sentinel socket --
          </div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div
              key={log.id || idx}
              className="flex items-start gap-2.5 hover:bg-[#0c0c0c] px-2 py-1 rounded-none transition-colors border-l-2 border-transparent hover:border-[#333]"
            >
              <span className="text-[10px] text-[#4b5563] select-none w-6 text-right shrink-0">
                {idx + 1}
              </span>
              <span className="text-[11px] text-[#6b7280] shrink-0">{log.timestamp}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 border shrink-0 uppercase tracking-wider ${getSourceStyle(
                  log.source
                )}`}
              >
                {log.source}
              </span>
              <span className={`flex-1 break-all ${getLevelColor(log.level)}`}>
                {log.containerName && (
                  <span className="text-[#00ff41] font-bold mr-1.5">
                    [{log.containerName}]
                  </span>
                )}
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Bottom Subsystem Status Badges */}
      <div className="bg-[#0c0c0c] border-t border-[#1e1e1e] p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#9ca3af]">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00ff41]" />
          <span>Sanitizer: <strong className="text-white">Active</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-[#00ff41]" />
          <span>pgvector: <strong className="text-white">384-dim L2</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-[#06b6d4]" />
          <span>AI Diagnostician: <strong className="text-white">Ready</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-[#00ff41]" />
          <span>Sentinel Daemon: <strong className="text-white">Hooked</strong></span>
        </div>
      </div>
    </div>
  );
};
