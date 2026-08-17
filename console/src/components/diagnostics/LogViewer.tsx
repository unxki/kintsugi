import React, { useState } from "react";
import { Copy, Check, Terminal, ShieldCheck, Download, Search, ShieldAlert, Eye } from "lucide-react";

interface LogViewerProps {
  logs: string;
  containerName: string;
  rawLogs?: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, containerName, rawLogs }) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  const activeLogText = showRaw && rawLogs ? rawLogs : logs;
  const lines = activeLogText.split("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(activeLogText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeLogText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${containerName}-crash.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLines = lines.map((line, idx) => ({ line, idx })).filter(({ line }) => {
    if (!searchQuery.trim()) return true;
    return line.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="bg-[#050505] border border-[#1e1e1e] font-mono text-xs flex flex-col h-full">
      {/* Top Header */}
      <div className="bg-[#0c0c0c] border-b border-[#1e1e1e] p-2.5 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Terminal className="w-3.5 h-3.5 text-[#00ff41]" />
          <span className="text-white font-bold text-xs">
            /var/log/containers/{containerName}.log
          </span>
          <span className="bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30 text-[10px] px-2 py-0.5 flex items-center gap-1 font-semibold">
            <ShieldCheck className="w-3 h-3" />
            ZERO-LEAK SANITIZED (SECRETS REDACTED)
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {rawLogs && (
            <button
              onClick={() => setShowRaw(!showRaw)}
              className={`px-2 py-1 text-[11px] border transition-colors flex items-center gap-1 font-bold ${
                showRaw
                  ? "bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/50"
                  : "bg-[#141414] text-[#9ca3af] border-[#262626] hover:text-white"
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>{showRaw ? "VIEWING RAW" : "VIEW RAW DIFF"}</span>
            </button>
          )}

          <button
            onClick={handleDownload}
            className="px-2 py-1 bg-[#141414] hover:bg-[#1f1f1f] text-[#9ca3af] hover:text-white border border-[#262626] transition-colors flex items-center gap-1 text-[11px]"
            title="Download log file"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">DOWNLOAD</span>
          </button>

          <button
            onClick={handleCopy}
            className="px-2.5 py-1 bg-[#141414] hover:bg-[#1f1f1f] text-[#00ff41] border border-[#00ff41]/40 hover:border-[#00ff41] transition-colors flex items-center gap-1 text-[11px] font-bold"
          >
            {copied ? <Check className="w-3 h-3 text-[#00ff41]" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "COPIED" : "COPY"}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar inside logs */}
      <div className="bg-[#080808] border-b border-[#181818] p-2 flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search log lines (e.g. fatal, exception, panic)..."
            className="w-full bg-[#0c0c0c] border border-[#1e1e1e] text-[11px] text-white pl-7 pr-3 py-1 focus:outline-none focus:border-[#00ff41]"
          />
          <Search className="w-3.5 h-3.5 text-[#6b7280] absolute left-2 top-1.5" />
        </div>
        <span className="text-[10px] text-[#6b7280] shrink-0">
          Showing {filteredLines.length} of {lines.length} lines
        </span>
      </div>

      {/* Log Lines Container */}
      <div className="p-3 overflow-y-auto max-h-[380px] space-y-0.5 select-text bg-[#030303]">
        {filteredLines.length === 0 ? (
          <div className="text-xs text-[#6b7280] italic py-8 text-center">
            No matching log lines found.
          </div>
        ) : (
          filteredLines.map(({ line, idx }) => {
            const isRedacted = line.includes("[REDACTED");
            const isError =
              line.toLowerCase().includes("error") ||
              line.toLowerCase().includes("fatal") ||
              line.toLowerCase().includes("panic") ||
              line.toLowerCase().includes("oom") ||
              line.toLowerCase().includes("critical") ||
              line.toLowerCase().includes("sigsegv");

            return (
              <div
                key={idx}
                className={`flex items-start gap-3 hover:bg-[#0f0f0f] px-1.5 py-0.5 font-mono text-[11px] leading-relaxed transition-colors ${
                  isError
                    ? "text-[#ef4444] bg-[#ef4444]/5 border-l-2 border-[#ef4444]"
                    : isRedacted
                    ? "text-[#00ff41] bg-[#00ff41]/5 border-l-2 border-[#00ff41]"
                    : "text-[#d1d5db]"
                }`}
              >
                <span className="text-[#4b5563] select-none w-7 text-right shrink-0">
                  {idx + 1}
                </span>
                <span className="break-all whitespace-pre-wrap flex-1">
                  {line || " "}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Sanitizer Token Masking Audit Footer */}
      <div className="bg-[#0a0a0a] border-t border-[#1a1a1a] p-2.5 flex items-center justify-between text-[11px] text-[#6b7280]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-[#00ff41]" />
          <span>Active Guardrail: Sentinel Regex Token Masker</span>
        </div>
        <span className="text-[#9ca3af]">JWT, Passwords, API Keys auto-scrubbed before LLM dispatch</span>
      </div>
    </div>
  );
};
