"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hi! Ask me about your sales, profit, customer due, or stock — I'll answer using your real business data." },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ suggestions: string[] }>("/api/ai/suggestions").then((r) => setSuggestions(r.suggestions));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.post<{ answer: string }>("/api/ai/ask", { question });
      setMessages((m) => [...m, { role: "assistant", text: res.answer }]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Sorry, I couldn't answer that right now.";
      setMessages((m) => [...m, { role: "assistant", text: msg }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 flex flex-col h-[calc(100vh-6rem)]">
      <h1 className="text-xl font-bold pt-2 pb-3">AI Business Assistant</h1>

      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user" ? "bg-brand text-white rounded-br-sm" : "bg-white border border-slate-200 rounded-bl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-slate-400 px-1">Thinking through your data...</div>}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.map((s) => (
            <button key={s} onClick={() => ask(s)} className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-600">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Ask about your business..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
        />
        <button className="btn-primary px-5" onClick={() => ask(input)} disabled={loading}>
          Ask
        </button>
      </div>
    </div>
  );
}
