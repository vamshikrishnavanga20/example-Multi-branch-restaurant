"use client";

import { useEffect, useRef } from "react";
import { Send, Mic, MicOff, Loader2, Sparkles } from "lucide-react";
import { WorkspaceMessage } from "../types";
import ChatBubble from "../components/ChatBubble";
import { useTheme } from "@/lib/theme-context";

interface AssistantTabProps {
  messages: WorkspaceMessage[];
  input: string;
  setInput: (val: string) => void;
  isThinking: boolean;
  isListening: boolean;
  onToggleListening: () => void;
  onSubmit: (e?: React.FormEvent) => void;
  timeframeLabel: string;
  onQuickPrompt: (prompt: string) => void;
}

const QUICK_PROMPTS = [
  "Show me the dish performance report",
  "Which dish is our top seller?",
  "What is our total revenue?",
  "What should we do to grow sales?",
];

export default function AssistantTab({
  messages,
  input,
  setInput,
  isThinking,
  isListening,
  onToggleListening,
  onSubmit,
  timeframeLabel,
  onQuickPrompt,
}: AssistantTabProps) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === "light";
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  return (
    <div className={`flex h-[680px] flex-col rounded-2xl border transition-all ${
      isLight ? "bg-white border-slate-200 shadow-lg" : "border-white/5 bg-white/[0.015] shadow-2xl backdrop-blur-xl"
    }`}>
      {/* Header Bar */}
      <div className={`flex items-center justify-between border-b px-6 py-4 transition-colors ${
        isLight ? "border-slate-200 bg-slate-50/70" : "border-white/10 bg-white/[0.02]"
      }`}>
        <div className="flex items-center gap-2.5">
          <div 
            style={{ borderColor: themeConfig.border, backgroundColor: themeConfig.light, color: themeConfig.primary }}
            className="flex h-8 w-8 items-center justify-center rounded-xl border"
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className={`font-serif text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
              AI Sommelier Studio
            </h3>
            <p className={`text-[11px] ${isLight ? "text-slate-500 font-medium" : "text-gray-400"}`}>
              Context scoped to: {timeframeLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {messages.map((msg, idx) => (
          <ChatBubble key={idx} message={msg} />
        ))}

        {isThinking && (
          <div className={`flex items-center gap-3 text-xs ${isLight ? "text-slate-600 font-medium" : "text-gray-400"}`}>
            <div 
              style={{ color: themeConfig.primary }}
              className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                isLight ? "border-slate-200 bg-slate-100" : "border-white/10 bg-white/5"
              }`}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
            <span className="animate-pulse">Consulting operational database...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className={`flex gap-2 overflow-x-auto border-t px-4 py-2.5 custom-scrollbar ${
        isLight ? "border-slate-200 bg-slate-50/50" : "border-white/5"
      }`}>
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onQuickPrompt(prompt)}
            className={`whitespace-nowrap rounded-lg border px-3 py-1 text-[11px] font-medium transition-colors ${
              isLight
                ? "border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-950 hover:border-slate-300"
                : "border-white/10 bg-white/[0.02] text-gray-300 hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
            }`}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form onSubmit={onSubmit} className={`border-t p-4 transition-colors ${
        isLight ? "border-slate-200 bg-slate-50/80" : "border-white/10 bg-black/40"
      }`}>
        <div className={`flex items-center gap-2 rounded-xl border p-1.5 transition-colors ${
          isLight ? "border-slate-200 bg-white shadow-2xs focus-within:border-amber-500" : "border-white/10 bg-white/5 focus-within:border-[#D4AF37]/50"
        }`}>
          <button
            type="button"
            onClick={onToggleListening}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all ${
              isListening
                ? "bg-red-500 text-white animate-pulse"
                : isLight
                  ? "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
            }`}
            title={isListening ? "Listening... click to stop" : "Voice question (Speech-to-text)"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening to your voice..." : `Ask anything about ${timeframeLabel} sales, dishes, or trends...`}
            className={`flex-1 bg-transparent px-3 text-sm outline-none ${
              isLight ? "text-slate-900 placeholder:text-slate-400" : "text-white placeholder:text-gray-500"
            }`}
            disabled={isThinking}
          />

          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            style={{ backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all hover:opacity-90 disabled:opacity-30 cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
