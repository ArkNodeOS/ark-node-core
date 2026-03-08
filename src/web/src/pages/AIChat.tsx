import { useEffect, useRef, useState } from "react";
import { apiPost } from "../hooks/useApi.ts";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      content: "Hello. I'm Solomon — your personal AI running privately on this Ark. Ask me anything, or tell me what you'd like to set up.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const prompt = input.trim();
    if (!prompt || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: Message = { id: Date.now(), role: "user", content: prompt };
    const loadingMsg: Message = { id: Date.now() + 1, role: "assistant", content: "", loading: true };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);

    try {
      const res = await apiPost<{ response: string }>("/ai/query", { prompt });
      setMessages((prev) =>
        prev.map((m) =>
          m.loading ? { ...m, content: res.response, loading: false } : m
        )
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.loading
            ? { ...m, content: `Error: ${String(e)}`, loading: false }
            : m
        )
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-ark-border bg-ark-surface/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">◈</span>
          <div>
            <div className="font-semibold">Solomon</div>
            <div className="text-xs text-ark-muted">Private AI — running locally</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex animate-slide-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-ark-accent/20 flex items-center justify-center text-sm mr-3 mt-1 shrink-0">
                ◈
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-ark-accent text-white rounded-br-sm"
                  : "bg-ark-card border border-ark-border text-ark-text rounded-bl-sm"
              }`}
            >
              {msg.loading ? (
                <span className="flex gap-1 items-center h-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-ark-muted animate-pulse2" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-ark-muted animate-pulse2" style={{ animationDelay: "200ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-ark-muted animate-pulse2" style={{ animationDelay: "400ms" }} />
                </span>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-ark-border bg-ark-surface/50 backdrop-blur-sm">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Solomon anything..."
            rows={1}
            className="flex-1 bg-ark-card border border-ark-border rounded-xl px-4 py-3 text-sm text-ark-text placeholder:text-ark-muted resize-none focus:outline-none focus:border-ark-accent transition-colors"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="w-12 h-12 rounded-xl bg-ark-accent hover:bg-ark-accent-glow disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all shrink-0"
          >
            ↑
          </button>
        </div>
        <p className="text-xs text-ark-muted text-center mt-2">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
