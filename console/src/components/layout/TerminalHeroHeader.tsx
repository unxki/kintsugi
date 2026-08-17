import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ArrowRight } from "lucide-react";

interface TerminalHeroHeaderProps {
  activeTab: "feed" | "workloads" | "logs" | "config" | "system";
  onInjectChaos: () => void;
}

const TAB_CONFIG: Record<
  "feed" | "workloads" | "logs" | "config" | "system",
  { command: string; subtitle: string }
> = {
  feed: {
    command: "cat ~/incidents",
    subtitle: "AUTONOMOUS SITE RELIABILITY ENGINEERING (AIOps)",
  },
  workloads: {
    command: "ps aux --workloads",
    subtitle: "CONTAINER RUNTIME MESH & CGROUP TELEMETRY",
  },
  logs: {
    command: "tail -f ~/runtime-logs",
    subtitle: "DEMULTIPLEXED ENGINE OBSERVABILITY & TRACE BUFFER",
  },
  config: {
    command: "kintsugi-control-plane --config",
    subtitle: "AI DIAGNOSTIC ENGINE & MULTI-MODEL ROUTER CONTROL PLANE",
  },
  system: {
    command: "netstat -topology --mesh",
    subtitle: "SENTINEL DAEMON GRAPH & NODE TOPOLOGY",
  },
};

const GLYPHS = "!/<>-_\\~0101#@$%&*=+[]{}?";

interface CharState {
  char: string;
  isResolved: boolean;
}

export const TerminalHeroHeader: React.FC<TerminalHeroHeaderProps> = ({
  activeTab,
  onInjectChaos,
}) => {
  const current = TAB_CONFIG[activeTab] || TAB_CONFIG.feed;
  const [chars, setChars] = useState<CharState[]>(() =>
    current.command.split("").map((c) => ({ char: c, isResolved: true }))
  );
  const animIntervalRef = useRef<number | null>(null);

  // Snappy cyber scramble across the entire command string (~240ms duration)
  useEffect(() => {
    const target = current.command;
    const targetLen = target.length;
    let progress = 0;

    if (animIntervalRef.current) {
      clearInterval(animIntervalRef.current);
    }

    // Step every 20ms with rapid progressive reveal
    const interval = window.setInterval(() => {
      progress += 0.85;

      const resolvedIndex = Math.floor(progress);

      setChars(() => {
        const nextChars: CharState[] = [];
        for (let i = 0; i < targetLen; i++) {
          if (target[i] === " ") {
            nextChars.push({ char: " ", isResolved: true });
          } else if (i < resolvedIndex) {
            nextChars.push({ char: target[i], isResolved: true });
          } else {
            const randomGlyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            nextChars.push({ char: randomGlyph, isResolved: false });
          }
        }
        return nextChars;
      });

      if (resolvedIndex >= targetLen) {
        setChars(target.split("").map((c) => ({ char: c, isResolved: true })));
        clearInterval(interval);
      }
    }, 20);

    animIntervalRef.current = interval;

    return () => {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
      }
    };
  }, [activeTab]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e1e1e]">
      <div>
        {/* Animated Subtitle Badge */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + "_sub"}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="text-[11px] text-[#00ff41] font-mono mb-1 flex items-center gap-2 font-bold tracking-wider"
          >
            <span className="h-2 w-2 rounded-full bg-[#00ff41] inline-block animate-pulse shadow-[0_0_8px_#00ff41]" />
            <span>{current.subtitle}</span>
          </motion.div>
        </AnimatePresence>

        {/* Animated Terminal Command Prompt */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-3xl font-extrabold font-mono tracking-tight text-white flex items-center gap-2 select-none">
            <span className="text-[#00ff41] drop-shadow-[0_0_8px_rgba(0,255,65,0.6)]">
              $
            </span>
            <span className="inline-flex items-center whitespace-pre font-mono">
              {chars.map((item, idx) => (
                <span
                  key={idx}
                  className={`transition-colors duration-75 ${
                    item.isResolved
                      ? "text-white"
                      : "text-[#00ff41] font-bold drop-shadow-[0_0_6px_rgba(0,255,65,0.8)]"
                  }`}
                >
                  {item.char === " " ? "\u00A0" : item.char}
                </span>
              ))}
            </span>
            <span className="inline-block w-2.5 h-6 sm:h-7 bg-[#00ff41] animate-pulse shadow-[0_0_10px_#00ff41] ml-0.5 align-middle" />
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Singular Undisputed Hero CTA */}
        <button
          onClick={onInjectChaos}
          className="px-4 py-2 text-xs font-mono font-bold bg-[#00ff41] text-black hover:bg-[#00ff41]/90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,255,65,0.3)] active:scale-95 whitespace-nowrap"
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>$ inject-chaos-scenario</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
