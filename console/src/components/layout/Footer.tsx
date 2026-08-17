import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[#1e1e1e] bg-[#050505] py-6 text-xs text-[#6b7280] font-mono mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[#00ff41]">●</span>
          <span>KINTSUGI AIOps Engine v1.0.0</span>
          <span>•</span>
          <span>Docker Socket: /var/run/docker.sock</span>
        </div>

        <div className="flex items-center gap-4 text-[#9ca3af]">
          <span>pgvector 384-dim L2</span>
          <span>•</span>
          <span>Sentinel Guardrail: Sliding Window 60s</span>
          <span>•</span>
          <span className="text-[#00ff41]">Zero Data Leak Sanitization</span>
        </div>
      </div>
    </footer>
  );
};
