import React, { useState, useEffect, useMemo } from "react";
import {
  Sliders,
  Cpu,
  Shield,
  Zap,
  Key,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Radio,
  SlidersHorizontal,
  Lock,
  Save,
  RotateCcw,
  Sparkles,
  Search,
  Globe,
  Filter
} from "lucide-react";

interface SystemConfig {
  llm_provider: string;
  llm_model: string;
  openai_api_key_configured: boolean;
  openrouter_api_key_configured: boolean;
  anthropic_api_key_configured: boolean;
  gemini_api_key_configured: boolean;
  local_llm_endpoint: string;
  custom_base_url?: string;
  operating_mode: string;
  similarity_threshold: number;
  confidence_threshold: number;
  flap_threshold: number;
  flap_window_seconds: number;
  log_tail_lines: number;
  auto_heal_timeout_ms: number;
  updated_at?: string;
}

interface SettingsViewProps {
  apiEndpoint?: string;
}

const PROVIDER_PRESETS: {
  [key: string]: {
    name: string;
    badge: string;
    desc: string;
    defaultModel: string;
    defaultBaseUrl?: string;
    models: string[];
  };
} = {
  gemini: {
    name: "Google Gemini & Gemma",
    badge: "MULTIMODAL & FAST",
    desc: "Ultra-fast structured reasoning via Gemini 3.5 Flash and Google Gemma open weights.",
    defaultModel: "gemini-3.5-flash",
    models: [
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
      "gemma-4-31b-it",
      "gemma-4-26b-a4b-it",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
    ],
  },
  openrouter: {
    name: "OpenRouter & Universal API Routers",
    badge: "300+ FRONTIER MODELS",
    desc: "Single unified API key for Claude 3.7, DeepSeek R1, Llama 3.3 70B, Qwen 2.5 Coder, Gemini 2.0, Groq, and custom gateways.",
    defaultModel: "anthropic/claude-3.7-sonnet",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    models: [
      "anthropic/claude-3.7-sonnet",
      "deepseek/deepseek-r1",
      "meta-llama/llama-3.3-70b-instruct",
      "google/gemini-2.0-flash-001",
      "qwen/qwen-2.5-coder-32b-instruct",
      "openai/gpt-4o",
      "openai/o3-mini",
      "mistralai/mistral-large-2411",
      "deepseek/deepseek-chat",
      "groq/llama-3.3-70b-versatile",
      "cohere/command-r-plus",
    ],
  },
  openai: {
    name: "OpenAI",
    badge: "ADVANCED REASONING",
    desc: "Structured JSON schema inference and deep stack trace reasoning via GPT-4o, GPT-4o-mini, and o3-mini.",
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "o3-mini", "o1-mini", "o1", "gpt-4-turbo"],
  },
  anthropic: {
    name: "Anthropic Claude",
    badge: "ENTERPRISE RCA",
    desc: "Claude 3.7 Sonnet (Hybrid Reasoning) and 3.5 Sonnet for enterprise systems and complex multi-line panics.",
    defaultModel: "claude-3-7-sonnet-20250219",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    models: [
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
  },
  local_llm: {
    name: "Local LLM / Ollama",
    badge: "AIR-GAPPED",
    desc: "Self-hosted OpenAI-compatible inference server (Ollama, vLLM, LocalAI) for air-gapped security.",
    defaultModel: "deepseek-r1:latest",
    models: ["deepseek-r1:latest", "llama3.3:latest", "qwen2.5-coder:latest", "mistral-small:latest"],
  },
  heuristic: {
    name: "Deterministic Heuristic Engine",
    badge: "OFFLINE / 0ms",
    desc: "Instant regex-based expert SRE failure classification. Runs 100% locally with zero latency or API dependencies.",
    defaultModel: "deterministic-regex-v1",
    models: ["deterministic-regex-v1"],
  },
};

const ROUTER_PRESETS = [
  { name: "OpenRouter", url: "https://openrouter.ai/api/v1", desc: "Frontier Catalog (300+ models)" },
  { name: "Groq", url: "https://api.groq.com/openai/v1", desc: "Ultra-low Latency LPU" },
  { name: "DeepSeek", url: "https://api.deepseek.com/v1", desc: "Direct R1 & V3 API" },
  { name: "Together AI", url: "https://api.together.xyz/v1", desc: "Open Source Cloud" },
  { name: "Mistral AI", url: "https://api.mistral.ai/v1", desc: "European Frontier AI" },
  { name: "LiteLLM Gateway", url: "http://localhost:4000/v1", desc: "Self-Hosted Enterprise Proxy" },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  apiEndpoint = "http://localhost:8000/api/v1",
}) => {
  const [config, setConfig] = useState<SystemConfig>({
    llm_provider: "heuristic",
    llm_model: "gemini-flash-lite-latest",
    openai_api_key_configured: false,
    openrouter_api_key_configured: false,
    anthropic_api_key_configured: false,
    gemini_api_key_configured: false,
    local_llm_endpoint: "http://localhost:11434/v1",
    custom_base_url: "",
    operating_mode: "ACTIVE",
    similarity_threshold: 0.85,
    confidence_threshold: 0.75,
    flap_threshold: 3,
    flap_window_seconds: 60,
    log_tail_lines: 100,
    auto_heal_timeout_ms: 5000,
  });

  // Sensitive input fields
  const [openaiKey, setOpenaiKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic Model Fetching & Search State
  const [availableModels, setAvailableModels] = useState<string[]>(PROVIDER_PRESETS.heuristic.models);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isLiveModels, setIsLiveModels] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");

  // Connectivity Test State
  const [isTestingLLM, setIsTestingLLM] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    provider: string;
    model: string;
    latency_ms: number;
    message: string;
    error?: string | null;
  } | null>(null);

  const fetchConfig = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${apiEndpoint}/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        if (data.custom_base_url) {
          setCustomBaseUrl(data.custom_base_url);
        }
        fetchModelsForProvider(data.llm_provider, data);
      } else {
        setErrorMessage("Failed to fetch system configuration from Core API.");
      }
    } catch (err) {
      setErrorMessage("Could not connect to Kintsugi Core API server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [apiEndpoint]);

  const fetchModelsForProvider = async (provider: string, currentCfg?: SystemConfig) => {
    setIsFetchingModels(true);
    const cfg = currentCfg || config;
    let keyToUse: string | undefined = undefined;
    if (provider === "gemini") keyToUse = geminiKey.trim() || undefined;
    if (provider === "openrouter") keyToUse = openrouterKey.trim() || openaiKey.trim() || undefined;
    if (provider === "openai") keyToUse = openaiKey.trim() || undefined;
    if (provider === "anthropic") keyToUse = anthropicKey.trim() || undefined;

    try {
      const res = await fetch(`${apiEndpoint}/config/fetch-models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm_provider: provider,
          api_key: keyToUse,
          endpoint: cfg.local_llm_endpoint,
          custom_base_url: customBaseUrl.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          setAvailableModels(data.models);
          setIsLiveModels(Boolean(data.is_live_fetched));
          if (!data.models.includes(cfg.llm_model)) {
            setConfig((prev) => ({ ...prev, llm_model: data.default_model || data.models[0] }));
          }
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch dynamic models:", e);
    } finally {
      setIsFetchingModels(false);
    }

    // Fallback to presets
    const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.heuristic;
    setAvailableModels(preset.models);
    setIsLiveModels(false);
  };

  const handleProviderChange = (providerId: string) => {
    const preset = PROVIDER_PRESETS[providerId] || PROVIDER_PRESETS.heuristic;
    setConfig((prev) => ({
      ...prev,
      llm_provider: providerId,
      llm_model: preset.defaultModel,
    }));
    if (preset.defaultBaseUrl && !customBaseUrl.trim()) {
      setCustomBaseUrl(preset.defaultBaseUrl);
    }
    setTestResult(null);
    setModelSearchQuery("");
    setVendorFilter("all");
    fetchModelsForProvider(providerId);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);
    try {
      const payload: any = {
        llm_provider: config.llm_provider,
        llm_model: config.llm_model,
        local_llm_endpoint: config.local_llm_endpoint,
        custom_base_url: customBaseUrl.trim() || null,
        operating_mode: config.operating_mode,
        similarity_threshold: config.similarity_threshold,
        confidence_threshold: config.confidence_threshold,
        flap_threshold: config.flap_threshold,
        flap_window_seconds: config.flap_window_seconds,
        log_tail_lines: config.log_tail_lines,
        auto_heal_timeout_ms: config.auto_heal_timeout_ms,
      };

      if (openaiKey.trim()) payload.openai_api_key = openaiKey.trim();
      if (openrouterKey.trim()) payload.openrouter_api_key = openrouterKey.trim();
      if (anthropicKey.trim()) payload.anthropic_api_key = anthropicKey.trim();
      if (geminiKey.trim()) payload.gemini_api_key = geminiKey.trim();

      const res = await fetch(`${apiEndpoint}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        if (updated.custom_base_url) setCustomBaseUrl(updated.custom_base_url);
        setSaveSuccess(true);
        setOpenaiKey("");
        setOpenrouterKey("");
        setAnthropicKey("");
        setGeminiKey("");
        fetchModelsForProvider(updated.llm_provider, updated);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setErrorMessage("Failed to save configuration.");
      }
    } catch (err) {
      setErrorMessage("Network error while saving configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestLLM = async () => {
    setIsTestingLLM(true);
    setTestResult(null);
    try {
      let currentKey: string | undefined = undefined;
      if (config.llm_provider === "openrouter") currentKey = openrouterKey.trim() || openaiKey.trim() || undefined;
      if (config.llm_provider === "openai" && openaiKey.trim()) currentKey = openaiKey.trim();
      if (config.llm_provider === "anthropic" && anthropicKey.trim()) currentKey = anthropicKey.trim();
      if (config.llm_provider === "gemini" && geminiKey.trim()) currentKey = geminiKey.trim();

      const res = await fetch(`${apiEndpoint}/config/test-llm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm_provider: config.llm_provider,
          llm_model: config.llm_model,
          api_key: currentKey,
          endpoint: config.local_llm_endpoint,
          custom_base_url: customBaseUrl.trim() || undefined,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setTestResult(result);
      } else {
        setTestResult({
          success: false,
          provider: config.llm_provider,
          model: config.llm_model,
          latency_ms: 0,
          message: "Core API returned an error during connection test.",
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        provider: config.llm_provider,
        model: config.llm_model,
        latency_ms: 0,
        message: "Network failure while testing connection.",
      });
    } finally {
      setIsTestingLLM(false);
    }
  };

  const handleResetDefaults = () => {
    setConfig({
      llm_provider: "gemini",
      llm_model: "gemini-flash-lite-latest",
      openai_api_key_configured: false,
      openrouter_api_key_configured: false,
      anthropic_api_key_configured: false,
      gemini_api_key_configured: false,
      local_llm_endpoint: "http://localhost:11434/v1",
      custom_base_url: "",
      operating_mode: "ACTIVE",
      similarity_threshold: 0.85,
      confidence_threshold: 0.75,
      flap_threshold: 3,
      flap_window_seconds: 60,
      log_tail_lines: 100,
      auto_heal_timeout_ms: 5000,
    });
    setCustomBaseUrl("");
    setAvailableModels(PROVIDER_PRESETS.gemini.models);
    setIsLiveModels(false);
    setModelSearchQuery("");
    setVendorFilter("all");
  };

  const handleOperatingModeToggle = async (mode: "ACTIVE" | "PASSIVE") => {
    setConfig((prev) => ({ ...prev, operating_mode: mode }));
    try {
      const res = await fetch(`${apiEndpoint}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operating_mode: mode }),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);

        // When switching to ACTIVE, sweep cluster and auto-heal all passive/unresolved incidents
        if (mode === "ACTIVE") {
          try {
            await fetch("/api/v1/actions/batch-remediate", { method: "POST" });
          } catch (sweepErr) {
            console.warn("Auto-sweep on mode toggle:", sweepErr);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to auto-sync operating mode:", err);
    }
  };

  const toggleShowKey = (field: string) => {
    setShowKeys((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const providerList = [
    { id: "gemini", ...PROVIDER_PRESETS.gemini },
    { id: "openrouter", ...PROVIDER_PRESETS.openrouter },
    { id: "openai", ...PROVIDER_PRESETS.openai },
    { id: "anthropic", ...PROVIDER_PRESETS.anthropic },
    { id: "local_llm", ...PROVIDER_PRESETS.local_llm },
    { id: "heuristic", ...PROVIDER_PRESETS.heuristic },
  ];

  // Dynamic search & vendor filtering on model list
  const filteredModels = useMemo(() => {
    return availableModels.filter((m) => {
      const name = m.toLowerCase();
      const matchesSearch = !modelSearchQuery.trim() || name.includes(modelSearchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (vendorFilter === "all") return true;
      if (vendorFilter === "anthropic") return name.includes("claude") || name.includes("anthropic");
      if (vendorFilter === "deepseek") return name.includes("deepseek") || name.includes("r1");
      if (vendorFilter === "meta") return name.includes("llama") || name.includes("meta");
      if (vendorFilter === "google") return name.includes("gemini") || name.includes("gemma") || name.includes("google");
      if (vendorFilter === "openai") return name.includes("gpt") || name.includes("o1") || name.includes("o3") || name.includes("openai");
      if (vendorFilter === "qwen") return name.includes("qwen");
      if (vendorFilter === "mistral") return name.includes("mistral") || name.includes("codestral");
      return true;
    });
  }, [availableModels, modelSearchQuery, vendorFilter]);

  if (isLoading) {
    return (
      <div className="bg-[#080808] border border-[#1e1e1e] p-12 text-center font-mono">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 text-[#00ff41] animate-spin" />
        <p className="text-xs text-[#9ca3af]">Loading Kintsugi Control Plane Configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono max-w-7xl mx-auto pb-12">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-[#0c0c0c] border border-[#1e1e1e] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-[#00ff41]" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">
              $ kintsugi-control-plane --config
            </h1>
            <p className="text-[11px] text-[#6b7280]">
              Real-time dynamic orchestration, AI diagnostic engine hot-swapping, universal model routing, and remediation guardrails.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-[11px] text-[#00ff41] bg-[#00ff41]/10 border border-[#00ff41]/40 px-2.5 py-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              CONFIG APPLIED IN REALTIME!
            </span>
          )}
          {errorMessage && (
            <span className="flex items-center gap-1 text-[11px] text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/40 px-2.5 py-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errorMessage}
            </span>
          )}
        </div>
      </div>

      {/* Grid Layout: 2 Primary Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI & Engine Configuration (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: AI Provider Selection */}
          <div className="bg-[#080808] border border-[#1e1e1e] p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                <Cpu className="w-4 h-4 text-[#00ff41]" />
                <span>AI Diagnostics Engine & Provider Hot-Swapping</span>
              </div>
              <span className="text-[10px] text-[#6b7280] border border-[#1e1e1e] px-1.5 py-0.5 font-mono">
                ACTIVE: {config.llm_provider.toUpperCase()}
              </span>
            </div>

            {/* Provider Selection Cards */}
            <div className="space-y-2.5">
              {providerList.map((p) => {
                const isSelected = config.llm_provider === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    className={`p-3.5 border cursor-pointer transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-[#141414] border-[#00ff41] border-l-4 shadow-[0_0_15px_rgba(0,255,65,0.12)]"
                        : "bg-[#0c0c0c] border-[#1e1e1e] hover:border-[#333] hover:bg-[#101010]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className={`w-3.5 h-3.5 ${isSelected ? "text-[#00ff41]" : "text-[#4b5563]"}`} />
                        <span className={`text-xs font-bold ${isSelected ? "text-white" : "text-[#d1d5db]"}`}>
                          {p.name}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 border ${
                          isSelected
                            ? "bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/40"
                            : "bg-[#141414] text-[#6b7280] border-[#222]"
                        }`}
                      >
                        {p.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6b7280] pl-5 leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Model & Credentials Parameters */}
            <div className="bg-[#0c0c0c] border border-[#1e1e1e] p-4 space-y-4">
              <div className="text-xs font-bold text-white flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#00ff41]" />
                  <span>Provider Parameters & Credentials</span>
                </div>
                {isLiveModels ? (
                  <span className="text-[10px] text-[#00ff41] bg-[#00ff41]/10 border border-[#00ff41]/30 px-1.5 py-0.5 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> LIVE API MODELS SYNCED ({availableModels.length})
                  </span>
                ) : (
                  <span className="text-[10px] text-[#6b7280] bg-[#141414] border border-[#222] px-1.5 py-0.5">
                    DEFAULT PRESETS ({availableModels.length})
                  </span>
                )}
              </div>

              {/* API Key Inputs (Shown before Model Selection for immediate Fetching) */}

              {/* Gemini Key */}
              {config.llm_provider === "gemini" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-[#9ca3af]">
                      Google Gemini API Key:
                    </label>
                    {config.gemini_api_key_configured && (
                      <span className="text-[10px] text-[#00ff41] flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> KEY CONFIGURED IN DB
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys["gemini"] ? "text" : "password"}
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      onBlur={() => fetchModelsForProvider("gemini")}
                      placeholder={config.gemini_api_key_configured ? "•••••••••••••••••••••••• (Leave blank to keep existing)" : "AIzaSy..."}
                      className="w-full bg-[#080808] border border-[#1e1e1e] text-xs text-white px-3 py-2 pr-10 focus:outline-none focus:border-[#00ff41] transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("gemini")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6b7280] hover:text-white"
                    >
                      {showKeys["gemini"] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* OpenRouter Key */}
              {config.llm_provider === "openrouter" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-[#9ca3af]">
                      OpenRouter / Universal Router API Key:
                    </label>
                    {config.openrouter_api_key_configured && (
                      <span className="text-[10px] text-[#00ff41] flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> KEY CONFIGURED IN DB
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys["openrouter"] ? "text" : "password"}
                      value={openrouterKey}
                      onChange={(e) => setOpenrouterKey(e.target.value)}
                      onBlur={() => fetchModelsForProvider("openrouter")}
                      placeholder={config.openrouter_api_key_configured ? "•••••••••••••••••••••••• (Leave blank to keep existing)" : "sk-or-v1-..."}
                      className="w-full bg-[#080808] border border-[#1e1e1e] text-xs text-white px-3 py-2 pr-10 focus:outline-none focus:border-[#00ff41] transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("openrouter")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6b7280] hover:text-white"
                    >
                      {showKeys["openrouter"] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* OpenAI Key */}
              {config.llm_provider === "openai" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-[#9ca3af]">
                      OpenAI API Key:
                    </label>
                    {config.openai_api_key_configured && (
                      <span className="text-[10px] text-[#00ff41] flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> KEY CONFIGURED IN DB
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys["openai"] ? "text" : "password"}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      onBlur={() => fetchModelsForProvider("openai")}
                      placeholder={config.openai_api_key_configured ? "•••••••••••••••••••••••• (Leave blank to keep existing)" : "sk-proj-..."}
                      className="w-full bg-[#080808] border border-[#1e1e1e] text-xs text-white px-3 py-2 pr-10 focus:outline-none focus:border-[#00ff41] transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("openai")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6b7280] hover:text-white"
                    >
                      {showKeys["openai"] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Anthropic Key */}
              {config.llm_provider === "anthropic" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-[#9ca3af]">
                      Anthropic API Key:
                    </label>
                    {config.anthropic_api_key_configured && (
                      <span className="text-[10px] text-[#00ff41] flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> KEY CONFIGURED IN DB
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKeys["anthropic"] ? "text" : "password"}
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      onBlur={() => fetchModelsForProvider("anthropic")}
                      placeholder={config.anthropic_api_key_configured ? "•••••••••••••••••••••••• (Leave blank to keep existing)" : "sk-ant-..."}
                      className="w-full bg-[#080808] border border-[#1e1e1e] text-xs text-white px-3 py-2 pr-10 focus:outline-none focus:border-[#00ff41] transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("anthropic")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6b7280] hover:text-white"
                    >
                      {showKeys["anthropic"] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Local LLM Endpoint */}
              {config.llm_provider === "local_llm" && (
                <div>
                  <label className="block text-[11px] text-[#9ca3af] mb-1">
                    Local Inference Server Endpoint:
                  </label>
                  <input
                    type="text"
                    value={config.local_llm_endpoint}
                    onChange={(e) => setConfig((prev) => ({ ...prev, local_llm_endpoint: e.target.value }))}
                    onBlur={() => fetchModelsForProvider("local_llm")}
                    placeholder="http://localhost:11434/v1"
                    className="w-full bg-[#080808] border border-[#1e1e1e] text-xs text-white px-3 py-2 focus:outline-none focus:border-[#00ff41] transition-colors font-mono"
                  />
                  <p className="text-[10px] text-[#6b7280] mt-1">
                    Compatible with Ollama, vLLM, LM Studio, or LocalAI OpenAI-compatible endpoints.
                  </p>
                </div>
              )}

              {/* Custom Base URL / API Router */}
              {config.llm_provider !== "heuristic" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-[#9ca3af] flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#00ff41]" />
                      <span>Custom Base URL / API Router:</span>
                    </label>
                    {customBaseUrl.trim() && (
                      <span className="text-[10px] text-[#00ff41] flex items-center gap-1 font-mono">
                        <Zap className="w-2.5 h-2.5" /> ACTIVE ROUTER
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    onBlur={() => fetchModelsForProvider(config.llm_provider)}
                    placeholder="e.g. https://openrouter.ai/api/v1 or http://localhost:4000/v1"
                    className="w-full bg-[#080808] border border-[#1e1e1e] text-xs text-white px-3 py-2 focus:outline-none focus:border-[#00ff41] transition-colors font-mono placeholder:text-[#444]"
                  />

                  {/* Quick Router Preset Chips */}
                  <div>
                    <span className="text-[10px] text-[#6b7280] block mb-1">
                      Quick Gateway Presets:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ROUTER_PRESETS.map((preset) => {
                        const isCurrent = customBaseUrl.trim() === preset.url;
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setCustomBaseUrl(preset.url);
                              fetchModelsForProvider(config.llm_provider, { ...config, custom_base_url: preset.url });
                            }}
                            className={`px-2 py-0.5 text-[10px] font-mono border transition-all ${
                              isCurrent
                                ? "bg-[#00ff41]/20 text-[#00ff41] border-[#00ff41]"
                                : "bg-[#111111] text-[#9ca3af] border-[#222] hover:border-[#444] hover:text-white"
                            }`}
                          >
                            + {preset.name}
                          </button>
                        );
                      })}
                      {customBaseUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomBaseUrl("");
                            fetchModelsForProvider(config.llm_provider, { ...config, custom_base_url: "" });
                          }}
                          className="px-2 py-0.5 text-[10px] text-[#ef4444] border border-[#ef4444]/30 hover:bg-[#ef4444]/10"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Model Picker & Catalog Search */}
              <div className="space-y-2.5 pt-2 border-t border-[#1a1a1a]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-[#9ca3af] font-bold">
                      Model Catalog & Selection:
                    </label>
                    <span className="text-[10px] text-[#00ff41] bg-[#00ff41]/10 px-1.5 py-0.5 border border-[#00ff41]/30">
                      {filteredModels.length} of {availableModels.length} models
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isFetchingModels}
                    onClick={() => fetchModelsForProvider(config.llm_provider)}
                    className="text-[10px] text-[#00ff41] hover:text-[#00ff41]/80 hover:underline flex items-center gap-1 transition-all"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingModels ? "animate-spin" : ""}`} />
                    <span>{isFetchingModels ? "Fetching API Models..." : "Fetch Models from Key"}</span>
                  </button>
                </div>

                {/* Search & Vendor Filter Tabs */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#6b7280]" />
                    <input
                      type="text"
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      placeholder="Search models (e.g. claude, r1, llama, gemini, gpt, qwen)..."
                      className="w-full bg-[#080808] border border-[#1e1e1e] text-xs text-white pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#00ff41] font-mono placeholder:text-[#444]"
                    />
                  </div>

                  {/* Vendor Filter Chips */}
                  <div className="flex flex-wrap gap-1 items-center pt-0.5">
                    <Filter className="w-2.5 h-2.5 text-[#6b7280] mr-1" />
                    {[
                      { id: "all", label: "All" },
                      { id: "anthropic", label: "Claude / Anthropic" },
                      { id: "deepseek", label: "DeepSeek" },
                      { id: "meta", label: "Llama / Meta" },
                      { id: "google", label: "Gemini / Gemma" },
                      { id: "openai", label: "OpenAI" },
                      { id: "qwen", label: "Qwen" },
                      { id: "mistral", label: "Mistral" },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVendorFilter(v.id)}
                        className={`px-2 py-0.5 text-[9px] font-mono border transition-all ${
                          vendorFilter === v.id
                            ? "bg-[#00ff41] text-black font-bold border-[#00ff41]"
                            : "bg-[#111111] text-[#6b7280] border-[#222] hover:text-[#d1d5db]"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Selector Scrollable Grid */}
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-2 bg-[#080808] border border-[#1e1e1e] scrollbar-thin">
                  {filteredModels.length > 0 ? (
                    filteredModels.map((modelName) => {
                      const isModelSelected = config.llm_model === modelName;
                      return (
                        <button
                          key={modelName}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, llm_model: modelName }))}
                          className={`px-2.5 py-1 text-[11px] font-mono border transition-all text-left truncate max-w-full ${
                            isModelSelected
                              ? "bg-[#00ff41] text-black font-bold border-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.35)]"
                              : "bg-[#111111] text-[#9ca3af] border-[#222] hover:border-[#444] hover:text-white"
                          }`}
                          title={modelName}
                        >
                          {modelName}
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-[11px] text-[#6b7280] text-center w-full">
                      No models matching query "{modelSearchQuery}". Enter a custom model identifier below.
                    </div>
                  )}
                </div>

                {/* Custom / Exact Model Identifier Input */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-[#6b7280]">
                      Active / Custom Model Identifier:
                    </label>
                    <span className="text-[10px] text-[#00ff41] font-mono">
                      Selected: <span className="text-white font-bold">{config.llm_model}</span>
                    </span>
                  </div>
                  <input
                    type="text"
                    value={config.llm_model}
                    onChange={(e) => setConfig((prev) => ({ ...prev, llm_model: e.target.value }))}
                    placeholder="e.g. anthropic/claude-3.7-sonnet, deepseek/deepseek-r1, gemini-flash-lite-latest"
                    className="w-full bg-[#080808] border border-[#1e1e1e] text-xs text-white px-3 py-2 focus:outline-none focus:border-[#00ff41] transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Test Connectivity Action */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isTestingLLM}
                  onClick={handleTestLLM}
                  className="px-3.5 py-1.5 text-xs bg-[#141414] hover:bg-[#1e1e1e] text-white border border-[#2e2e2e] hover:border-[#00ff41] hover:text-[#00ff41] transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
                >
                  {isTestingLLM ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-[#00ff41] animate-spin" />
                      <span>Testing Connectivity...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-[#00ff41]" />
                      <span>$ ping --provider-health</span>
                    </>
                  )}
                </button>

                {testResult && (
                  <div
                    className={`text-[11px] p-2 border flex items-center gap-2 ${
                      testResult.success
                        ? "bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/40"
                        : "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/40"
                    }`}
                  >
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{testResult.message} ({testResult.latency_ms}ms)</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: AI & Vector Confidence Sliders */}
          <div className="bg-[#080808] border border-[#1e1e1e] p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                <SlidersHorizontal className="w-4 h-4 text-[#00ff41]" />
                <span>Confidence & Vector Match Thresholds</span>
              </div>
            </div>

            {/* Confidence Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#d1d5db]">Autonomous Auto-Heal Confidence Gate:</span>
                <span className="text-[#00ff41] font-bold">
                  {Math.round(config.confidence_threshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.99"
                step="0.01"
                value={config.confidence_threshold}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, confidence_threshold: parseFloat(e.target.value) }))
                }
                className="w-full accent-[#00ff41] bg-[#1a1a1a] h-1.5 rounded-none cursor-pointer"
              />
              <p className="text-[11px] text-[#6b7280]">
                If the AI root-cause diagnosis confidence falls below this score, auto-healing is suspended and the incident is escalated to human operator.
              </p>
            </div>

            {/* Cosine Similarity Threshold */}
            <div className="space-y-2 pt-2 border-t border-[#1a1a1a]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#d1d5db]">pgvector Cosine Similarity Match Threshold:</span>
                <span className="text-[#00ff41] font-bold">
                  {Math.round(config.similarity_threshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.99"
                step="0.01"
                value={config.similarity_threshold}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, similarity_threshold: parseFloat(e.target.value) }))
                }
                className="w-full accent-[#00ff41] bg-[#1a1a1a] h-1.5 rounded-none cursor-pointer"
              />
              <p className="text-[11px] text-[#6b7280]">
                Minimum vector cosine similarity required to bind new stack traces to historical remediation knowledge items in PostgreSQL.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Remediation Guardrails & Operating Mode (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Operating Mode Master Switch */}
          <div className="bg-[#080808] border border-[#1e1e1e] p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                <Shield className="w-4 h-4 text-[#00ff41]" />
                <span>Sentinel Operating Mode</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOperatingModeToggle("ACTIVE")}
                className={`p-3 border text-left flex flex-col gap-1 transition-all ${
                  config.operating_mode === "ACTIVE"
                    ? "bg-[#00ff41]/10 border-[#00ff41] shadow-[0_0_12px_rgba(0,255,65,0.2)]"
                    : "bg-[#0c0c0c] border-[#1e1e1e] text-[#6b7280] hover:border-[#333]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Zap className={`w-4 h-4 ${config.operating_mode === "ACTIVE" ? "text-[#00ff41]" : "text-[#4b5563]"}`} />
                  <span className={`text-xs font-bold ${config.operating_mode === "ACTIVE" ? "text-white" : "text-[#9ca3af]"}`}>
                    ACTIVE
                  </span>
                </div>
                <span className="text-[10px] text-[#6b7280]">
                  Full Autonomous Auto-Heal & Container Restarts
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleOperatingModeToggle("PASSIVE")}
                className={`p-3 border text-left flex flex-col gap-1 transition-all ${
                  config.operating_mode === "PASSIVE"
                    ? "bg-[#f59e0b]/10 border-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                    : "bg-[#0c0c0c] border-[#1e1e1e] text-[#6b7280] hover:border-[#333]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Activity className={`w-4 h-4 ${config.operating_mode === "PASSIVE" ? "text-[#f59e0b]" : "text-[#4b5563]"}`} />
                  <span className={`text-xs font-bold ${config.operating_mode === "PASSIVE" ? "text-white" : "text-[#9ca3af]"}`}>
                    PASSIVE
                  </span>
                </div>
                <span className="text-[10px] text-[#6b7280]">
                  Dry-Run: Observe, Analyze & Alert Only
                </span>
              </button>
            </div>

            <div className="p-3 bg-[#0c0c0c] border border-[#1e1e1e] text-[11px] text-[#9ca3af] leading-relaxed">
              {config.operating_mode === "ACTIVE" ? (
                <span className="text-[#00ff41]">
                  ⚡ Active Mode: The system autonomously executes remediations (container restarts, socket prune) upon failure detection.
                </span>
              ) : (
                <span className="text-[#f59e0b]">
                  🛡️ Passive Mode: The Sentinel daemon diagnoses crashes and generates full RCA plans without modifying container states.
                </span>
              )}
            </div>
          </div>

          {/* Circuit Breaker & Safety Limits */}
          <div className="bg-[#080808] border border-[#1e1e1e] p-4 sm:p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                <Activity className="w-4 h-4 text-[#ef4444]" />
                <span>Circuit Breaker Guardrails</span>
              </div>
            </div>

            {/* Flap Threshold Limit */}
            <div className="space-y-1">
              <label className="block text-[11px] text-[#9ca3af]">
                Flap Crash Limit (Consecutive Crashes):
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.flap_threshold}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, flap_threshold: parseInt(e.target.value) || 3 }))
                }
                className="w-full bg-[#0c0c0c] border border-[#1e1e1e] text-xs text-white px-3 py-2 focus:outline-none focus:border-[#00ff41]"
              />
              <p className="text-[10px] text-[#6b7280]">
                If a container crashes more than this amount within the sliding window, auto-restart trips.
              </p>
            </div>

            {/* Flap Window Seconds */}
            <div className="space-y-1">
              <label className="block text-[11px] text-[#9ca3af]">
                Sliding Time Window (Seconds):
              </label>
              <input
                type="number"
                min="10"
                max="600"
                value={config.flap_window_seconds}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, flap_window_seconds: parseInt(e.target.value) || 60 }))
                }
                className="w-full bg-[#0c0c0c] border border-[#1e1e1e] text-xs text-white px-3 py-2 focus:outline-none focus:border-[#00ff41]"
              />
              <p className="text-[10px] text-[#6b7280]">
                Window duration across which crash frequencies are tracked in memory.
              </p>
            </div>

            {/* Log Tail Lines */}
            <div className="space-y-1">
              <label className="block text-[11px] text-[#9ca3af]">
                Log Tail Buffer Lines:
              </label>
              <input
                type="number"
                min="20"
                max="500"
                value={config.log_tail_lines}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, log_tail_lines: parseInt(e.target.value) || 100 }))
                }
                className="w-full bg-[#0c0c0c] border border-[#1e1e1e] text-xs text-white px-3 py-2 focus:outline-none focus:border-[#00ff41]"
              />
              <p className="text-[10px] text-[#6b7280]">
                Tail buffer lines extracted and redacted locally prior to AI root-cause analysis.
              </p>
            </div>

            {/* Auto Heal Timeout */}
            <div className="space-y-1">
              <label className="block text-[11px] text-[#9ca3af]">
                Remediation Timeout (Milliseconds):
              </label>
              <input
                type="number"
                min="1000"
                max="30000"
                step="500"
                value={config.auto_heal_timeout_ms}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, auto_heal_timeout_ms: parseInt(e.target.value) || 5000 }))
                }
                className="w-full bg-[#0c0c0c] border border-[#1e1e1e] text-xs text-white px-3 py-2 focus:outline-none focus:border-[#00ff41]"
              />
            </div>
          </div>

          {/* Action Execution Bar */}
          <div className="bg-[#080808] border border-[#1e1e1e] p-4 flex items-center justify-between gap-3 shadow-xl">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-2 text-xs text-[#9ca3af] hover:text-white border border-[#1e1e1e] hover:border-[#333] transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold bg-[#00ff41] hover:bg-[#00ff41]/90 text-black border border-[#00ff41] transition-all flex items-center gap-2 active:scale-95 shadow-[0_0_15px_rgba(0,255,65,0.25)]"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-black animate-spin" />
                  <span>Syncing State...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 fill-current" />
                  <span>$ save-configuration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
