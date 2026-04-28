"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Maximize2, Send, Sparkles, User, X } from "lucide-react";
import Link from "next/link";
import { useLunaChat } from "@/features/ai-assistant/useLunaChat";

type PanelProps = {
  onClose: () => void;
};

function AiFloatingPanel({ onClose }: PanelProps) {
  const { messages, isThinking, sendMessage } = useLunaChat();
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!inputText.trim() || isThinking) return;
    const text = inputText;
    setInputText("");
    await sendMessage(text);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
      <motion.div
        data-print-hidden="true"
        dir="ltr"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className={`fixed bottom-40 z-[9999] h-[500px] w-[350px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 ltr:right-6 rtl:left-6 max-sm:bottom-40 ltr:max-sm:right-4 rtl:max-sm:left-4 max-sm:w-[calc(100vw-2rem)]`}
      >
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
        <span className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <Sparkles size={16} className="text-blue-600 dark:text-blue-400" />
          Luna AI
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/ai-assistant"
            title="Ouvrir en mode complet"
            className="text-slate-400 transition hover:text-blue-600 dark:hover:text-blue-400"
          >
            <Maximize2 size={15} />
          </Link>
          <button onClick={onClose} className="text-slate-400 transition hover:text-slate-700 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100%-73px)] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !isThinking && (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500">
              <Bot size={32} className="mb-2 text-blue-500 opacity-50 dark:text-blue-400" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Hi, I&apos;m Luna.</p>
              <p className="text-xs text-slate-500">How can I help you quickly?</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "assistant" ? (
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-sm shadow-blue-500/20 dark:bg-blue-600">
                  <Bot size={12} className="text-white dark:text-white" />
                </div>
              ) : (
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-slate-800">
                  <User size={12} className="text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13px] tracking-wide shadow-sm ${
                  msg.role === "assistant"
                    ? "rounded-tl-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    : "rounded-tr-sm border border-blue-100 bg-blue-50 text-slate-900 dark:border-blue-800/40 dark:bg-blue-900/40 dark:text-blue-50"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-start gap-2">
              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-sm shadow-blue-500/20 dark:bg-blue-600">
                <Bot size={12} className="text-white dark:text-white" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Loader2 size={14} className="animate-spin text-blue-500 dark:text-blue-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 rounded-full border border-transparent bg-slate-100 px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
            <input
              type="text"
              value={inputText}
              placeholder="Ask Luna..."
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKey}
              className="flex-1 border-none bg-transparent text-sm text-slate-900 outline-none placeholder-slate-400 dark:text-white dark:placeholder-slate-500"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isThinking}
              className="text-blue-600 transition disabled:text-slate-400 disabled:opacity-30 dark:text-blue-400"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function AiFloatingWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div
        data-print-hidden="true"
        className={`fixed bottom-24 z-[9999] ltr:right-6 rtl:left-6 max-sm:bottom-24 ltr:max-sm:right-4 rtl:max-sm:left-4`}
      >
        <div dir="ltr">
          <button
            onClick={() => setIsOpen((previous) => !previous)}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-blue-500 bg-blue-600 text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] transition-all duration-300 hover:scale-105 active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-blue-400"
        >
          {isOpen ? <X size={24} /> : <Bot size={28} />}
        </button>
        </div>
      </div>

      <AnimatePresence>{isOpen ? <AiFloatingPanel onClose={() => setIsOpen(false)} /> : null}</AnimatePresence>
    </>
  );
}
