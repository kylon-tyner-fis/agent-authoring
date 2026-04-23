"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  AlertCircle,
  X,
  Network,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AgentConfig, Message } from "@/src/lib/types/constants";
import { v4 as uuidv4 } from "uuid";
import { RecursiveJsonViewer } from "../../shared/json-tools/RecursiveJsonViewer";

type HistoryEvent =
  | { type: "message"; content: string }
  | { type: "skill_start"; skillName: string; args: any }
  | { type: "skill_end"; skillName: string; result: any };

interface AgentPlaygroundProps {
  agent: AgentConfig;
  onClose: () => void;
}

export const AgentPlayground = ({ agent, onClose }: AgentPlaygroundProps) => {
  const [input, setInput] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [threadId] = useState(() => uuidv4());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    setError(null);
    const displayContent = input.trim();

    // Add user message to UI immediately
    setHistory((prev) => [
      ...prev,
      { type: "message", content: `**User:** ${displayContent}` },
    ]);
    setInput("");
    setIsSimulating(true);

    try {
      const response = await fetch("/api/agents/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentConfig: agent,
          input: displayContent,
          thread_id: threadId,
        }),
      });

      if (!response.body) throw new Error("No readable stream available");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Initialize an empty assistant message to append chunks to
      setHistory((prev) => [...prev, { type: "message", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const dataStr = part.slice(6);
            if (!dataStr.trim()) continue;

            const event = JSON.parse(dataStr);

            if (event.type === "chunk") {
              setHistory((prev) => {
                const newHistory = [...prev];
                const lastIndex = newHistory.length - 1;
                const lastItem = newHistory[lastIndex];

                if (lastItem.type === "message") {
                  // FIX: Create a new object rather than mutating the old one!
                  // This prevents React Strict Mode from double-appending the chunk.
                  newHistory[lastIndex] = {
                    ...lastItem,
                    content: lastItem.content + event.chunk,
                  };
                }
                return newHistory;
              });
            } else if (event.type === "skill_start") {
              setHistory((prev) => [
                ...prev,
                {
                  type: "skill_start",
                  skillName: event.skillName,
                  args: event.args,
                },
                { type: "message", content: "" }, // Prepare for next text chunk
              ]);
            } else if (event.type === "skill_end") {
              setHistory((prev) => [
                ...prev,
                {
                  type: "skill_end",
                  skillName: event.skillName,
                  result: event.result,
                },
                { type: "message", content: "" }, // Prepare for next text chunk
              ]);
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setHistory((prev) => [
        ...prev,
        { type: "message", content: "❌ Execution failed." },
      ]);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-full bg-gray-50 relative border-l border-gray-200">
      <div className="border-b border-gray-200 bg-white shrink-0 shadow-sm z-10 p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5 text-emerald-600" /> Agent Executive Sandbox
        </h2>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="absolute top-20 left-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-md z-10 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="flex-1 overflow-auto text-sm">{error}</div>
          <button
            onClick={() => setError(null)}
            className="text-red-700 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex-1 p-6 overflow-y-auto space-y-4" ref={scrollRef}>
        {history.length === 0 && !isSimulating && (
          <div className="text-center mt-10">
            <p className="text-sm text-gray-500 italic">
              Chat with the Executive Agent to test its reasoning and routing.
            </p>
          </div>
        )}

        {history.map((item, i) => {
          if (item.type === "message" && item.content.trim()) {
            const isUser = item.content.startsWith("**User:**");
            const cleanContent = isUser
              ? item.content.replace("**User:**", "").trim()
              : item.content;
            return (
              <div
                key={i}
                className={`flex gap-3 w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm bg-emerald-100">
                    <Bot className="w-4 h-4 text-emerald-600" />
                  </div>
                )}
                <div
                  className={`p-4 rounded-xl max-w-[85%] w-full shadow-sm ${isUser ? "bg-emerald-600 text-white" : "bg-white border border-gray-200"}`}
                >
                  {isUser ? (
                    <p className="text-sm m-0 leading-relaxed">
                      {cleanContent}
                    </p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                      <ReactMarkdown>{cleanContent}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          } else if (item.type === "skill_start") {
            return (
              <div
                key={i}
                className="flex flex-col gap-1.5 ml-11 my-2 animate-in fade-in w-[85%]"
              >
                <div className="flex items-center gap-2 text-[11px] text-blue-600 font-mono">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Delegating to Skill:</span>
                  <span className="font-semibold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                    {item.skillName}
                  </span>
                </div>
                <div className="text-sm text-slate-500 bg-white shadow-sm p-3 rounded-lg border border-slate-200">
                  <span className="font-bold mb-1.5 block text-slate-400 uppercase tracking-wider">
                    Parameters
                  </span>
                  <RecursiveJsonViewer data={item.args} />
                </div>
              </div>
            );
          } else if (item.type === "skill_end") {
            return (
              <div
                key={i}
                className="flex flex-col gap-1.5 ml-11 my-2 animate-in fade-in w-[85%]"
              >
                <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Skill Completed:</span>
                  <span className="font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    {item.skillName}
                  </span>
                </div>
                <div className="text-sm text-slate-500 bg-white shadow-sm p-3 rounded-lg border border-slate-200 max-h-60 overflow-y-auto custom-scrollbar">
                  <span className="font-bold mb-1.5 block text-slate-400 uppercase tracking-wider">
                    Workflow Output
                  </span>
                  <RecursiveJsonViewer data={item.result} />
                </div>
              </div>
            );
          }
          return null;
        })}

        {isSimulating && (
          <div className="flex gap-3 text-gray-400 items-center animate-pulse pl-11 mt-4">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-500">
              Agent Reasoning...
            </span>
          </div>
        )}
      </div>

      <div className="p-5 bg-white border-t border-gray-200 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a goal for the agent..."
            className="flex-1 p-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-100 shadow-sm transition-all"
            disabled={isSimulating}
          />
          <button
            type="submit"
            disabled={isSimulating || !input.trim()}
            className="bg-emerald-600 text-white p-3.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
