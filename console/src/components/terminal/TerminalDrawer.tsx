import React, { useState, useEffect, useRef } from "react";
import { Terminal, ChevronUp, ChevronDown, Trash2, Search, Filter, Copy, Check, Maximize2, Minimize2, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface LogEntry {
  id: string;
  timestamp: string;
  source: "SENTINEL" | "DOCKER" | "AI_RCA" | "PGVECTOR" | "POLICY" | "SANITIZER" | "CLI" | "CHAOS";
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS" | "DEBUG";
  message: string;
  containerName?: string;
}

interface TerminalDrawerProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  onExecuteCommand: (cmd: string) => Promise<string | void>;
  onInjectChaos?: (scenario: string) => Promise<void>;
  isLive?: boolean;
}

export const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  logs,
  onClearLogs,
  onExecuteCommand,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [filterSource, setFilterSource] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [commandInput, setCommandInput] = useState<string>("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copied, setCopied] = useState<boolean>(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    if (filterSource !== "ALL" && log.source !== filterSource) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.source.toLowerCase().includes(q) ||
        (log.containerName && log.containerName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const submitCommand = async () => {
    const cmd = commandInput.trim();
    if (!cmd) return;

    setCommandHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setCommandInput("");

    if (cmd === "clear") {
      onClearLogs();
      return;
    }

    await onExecuteCommand(cmd);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      await submitCommand();
    } else if (e.key === "ArrowUp") {
      if (commandHistory.length > 0) {
        const nextIdx = historyIndex + 1 < commandHistory.length ? historyIndex + 1 : historyIndex;
        setHistoryIndex(nextIdx);
        setCommandInput(commandHistory[commandHistory.length - 1 - nextIdx]);
      }
    } else if (e.key === "ArrowDown") {
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCommandInput(commandHistory[commandHistory.length - 1 - nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput("");
      }
    }
  };

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.source}] [${l.level}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSourceBadge = (source: LogEntry["source"]) => {
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
      case "CHAOS":
        return "text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/30";
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
    <aside aria-label="Terminal Console" className="fixed bottom-0 left-0 right-0 z-50 font-mono border-t border-[#1e1e1e] bg-[#080808]/98 backdrop-blur-xl shadow-[0_-10px_35px_rgba(0,0,0,0.85)] select-none">
      {/* Toggle Bar - Always pinned to the very bottom */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#0c0c0c] hover:bg-[#121212] cursor-pointer transition-colors border-b border-[#181818]"
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-white font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ff41] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00ff41] shadow-[0_0_6px_#00ff41]" />
            </span>
            <Terminal className="w-3.5 h-3.5 text-[#00ff41]" />
            <span className="text-[11px] sm:text-xs">KINTSUGI LIVE LOGS & REPL</span>
          </div>

          <span className="text-[10px] text-[#6b7280] bg-[#141414] px-1.5 py-0.2 border border-[#222]">
            {logs.length} EVENTS
          </span>

          <span className="text-[10px] text-[#4b5563] hidden md:inline">
            (Docker Socket, Sentinel Daemon, Sanitizer, pgvector, AI RCA)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMaximized(!isMaximized);
              }}
              className="p-1 text-[#9ca3af] hover:text-white hover:bg-[#1e1e1e] transition-colors"
              title={isMaximized ? "Restore Height" : "Maximize Terminal"}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          <span className="text-[11px] text-[#00ff41] font-bold hidden sm:inline">
            {isOpen ? "[− Collapse]" : "[+ Open Terminal]"}
          </span>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-[#9ca3af]" />
          ) : (
            <ChevronUp className="w-4 h-4 text-[#00ff41]" />
          )}
        </div>
      </div>

      {/* Expanded Terminal Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: isMaximized ? "85vh" : "min(55vh, 360px)", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col overflow-hidden bg-[#050505]"
          >
            {/* Top Toolbar */}
            <div className="bg-[#0a0a0a] border-b border-[#181818] p-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
              {/* Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <span className="text-[10px] text-[#6b7280] flex items-center gap-1 mr-1 shrink-0">
                  <Filter className="w-3 h-3" /> STREAM:
                </span>
                {["ALL", "SENTINEL", "DOCKER", "AI_RCA", "PGVECTOR", "POLICY", "SANITIZER"].map(
                  (src) => (
                    <button
                      key={src}
                      onClick={() => setFilterSource(src)}
                      className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border transition-all shrink-0 ${
                        filterSource === src
                          ? "bg-[#00ff41] text-black font-bold border-[#00ff41]"
                          : "bg-[#121212] text-[#9ca3af] border-[#222] hover:border-[#333] hover:text-white"
                      }`}
                    >
                      {src}
                    </button>
                  )
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="bg-[#121212] border border-[#222] text-[11px] text-white px-2 py-0.5 pl-6 focus:outline-none focus:border-[#00ff41] w-28 sm:w-36"
                  />
                  <Search className="w-3 h-3 text-[#6b7280] absolute left-1.5 top-1.5 pointer-events-none" />
                </div>

                <button
                  onClick={handleCopyLogs}
                  className="px-2 py-0.5 bg-[#141414] hover:bg-[#1e1e1e] border border-[#222] text-[#9ca3af] hover:text-white flex items-center gap-1 text-[10px]"
                  title="Copy terminal output"
                >
                  {copied ? <Check className="w-3 h-3 text-[#00ff41]" /> : <Copy className="w-3 h-3" />}
                  <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
                </button>

                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-2 py-0.5 border text-[10px] ${
                    autoScroll
                      ? "bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/30"
                      : "bg-[#141414] text-[#6b7280] border-[#222]"
                  }`}
                  title="Toggle Auto-Scroll"
                >
                  Auto-Scroll: {autoScroll ? "ON" : "OFF"}
                </button>

                <button
                  onClick={onClearLogs}
                  className="p-1 bg-[#141414] hover:bg-[#ef4444]/20 border border-[#222] hover:border-[#ef4444]/40 text-[#6b7280] hover:text-[#ef4444]"
                  title="Clear Output"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Log Stream Output Buffer */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1 font-mono text-[11px] leading-relaxed custom-scrollbar"
            >
              {filteredLogs.length === 0 ? (
                <div className="text-[#4b5563] text-center py-6">
                  [No log events match active filter]
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 hover:bg-[#0a0a0a] py-0.5 px-1">
                    <span className="text-[10px] text-[#4b5563] shrink-0">{log.timestamp}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 border shrink-0 uppercase tracking-wider ${getSourceBadge(
                        log.source
                      )}`}
                    >
                      {log.source}
                    </span>
                    <span className={`flex-1 break-all ${getLevelColor(log.level)}`}>
                      {log.containerName && (
                        <span className="text-[#00ff41] font-semibold mr-1.5">
                          [{log.containerName}]
                        </span>
                      )}
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Interactive CLI REPL Input Bar */}
            <div className="bg-[#0a0a0a] border-t border-[#1e1e1e] p-2 flex items-center gap-2">
              <span className="text-[#00ff41] font-bold text-xs pl-1">kintsugi &gt;</span>
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Command: 'help', 'inject oom', 'stats', 'containers'..."
                className="flex-1 bg-transparent text-xs text-white placeholder:text-[#4b5563] focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={submitCommand}
                className="px-2.5 py-1 bg-[#00ff41] hover:bg-[#00ff41]/90 text-black font-bold text-[10px] font-mono flex items-center gap-1 active:scale-95 transition-all"
              >
                <Send className="w-3 h-3" />
                <span className="hidden sm:inline">EXEC</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
};
