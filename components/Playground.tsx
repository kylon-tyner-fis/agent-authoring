"use client";

import { useState } from "react";
import {
  Send,
  Bot,
  User,
  AlertCircle,
  Network,
  ShieldCheck,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { RecursiveJsonViewer } from "./RecursiveJsonViewer";
import { AgentConfig, Message } from "@/lib/constants";

// --- MARKDOWN INTERCEPTOR ---
// Defined safely outside the component to prevent React state bugs
const MarkdownComponents = {
  code(props: any) {
    const { children, className, node, ...rest } = props;
    const match = /language-(\w+)/.exec(className || "");

    if (match && match[1] === "json") {
      try {
        const data = JSON.parse(String(children).replace(/\n$/, ""));

        // Split payload if we receive LangGraph structure
        if (data && typeof data === "object" && "extracted_data" in data) {
          const { extracted_data, ...systemData } = data;

          return (
            <div className="my-4 flex flex-col gap-4 w-full not-prose font-sans">
              <div className="bg-purple-50 border border-purple-200 rounded-lg shadow-sm overflow-hidden">
                <div className="bg-purple-100 border-b border-purple-200 px-4 py-2.5 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <h3 className="font-bold text-purple-900 m-0 text-xs uppercase tracking-wider">
                    System
                  </h3>
                </div>
                <div className="p-4 overflow-x-auto">
                  <RecursiveJsonViewer data={systemData} />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-sm overflow-hidden">
                <div className="bg-blue-100 border-b border-blue-200 px-4 py-2.5 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-700" />
                  <h3 className="font-bold text-blue-900 m-0 text-xs uppercase tracking-wider">
                    User State
                  </h3>
                </div>
                <div className="p-4 overflow-x-auto">
                  <RecursiveJsonViewer data={extracted_data} />
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="my-4 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden font-sans not-prose w-full">
            <div className="bg-slate-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
              <Network className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-slate-700 m-0 text-xs uppercase tracking-wide">
                JSON Payload
              </h3>
            </div>
            <div className="p-5 overflow-x-auto">
              <RecursiveJsonViewer data={data} />
            </div>
          </div>
        );
      } catch (e) {
        // Fall through if parsing fails
      }
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },
};

interface PlaygroundProps {
  config: AgentConfig;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onClose: () => void;
}

export const Playground = ({
  config,
  messages,
  setMessages,
  onClose,
}: PlaygroundProps) => {
  const [input, setInput] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setError(null);
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsSimulating(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, input }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to execute agent");

      const parsedResult = JSON.parse(data.result);
      const formattedJson = JSON.stringify(parsedResult, null, 2);

      setMessages([
        ...newMessages,
        { role: "assistant", content: `\`\`\`json\n${formattedJson}\n\`\`\`` },
      ]);
    } catch (err: any) {
      setError(err.message);
      setMessages([
        ...newMessages,
        { role: "assistant", content: "❌ Execution failed." },
      ]);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-full bg-gray-50 relative border-l border-gray-200">
      {/* DRAWER HEADER */}
      <div className="p-5 border-b border-gray-200 bg-white flex items-center justify-between shrink-0 shadow-sm z-10">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600" /> Playground
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

      {/* CHAT LOG */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {messages.map((msg, i) => {
          const isMiss = msg.content.includes('is_relevant": false');
          const bgClass =
            msg.role === "user"
              ? "bg-indigo-600 text-white"
              : isMiss
                ? "bg-amber-50 border border-amber-200"
                : "bg-white border border-gray-200";

          return (
            <div
              key={i}
              className={`flex gap-3 w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${isMiss ? "bg-amber-100" : "bg-indigo-100"}`}
                >
                  {isMiss ? (
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  ) : (
                    <Bot className="w-4 h-4 text-indigo-600" />
                  )}
                </div>
              )}

              <div
                className={`p-4 rounded-xl max-w-[85%] w-full shadow-sm ${bgClass}`}
              >
                {msg.role === "user" ? (
                  <p className="text-sm m-0 leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                    <ReactMarkdown components={MarkdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          );
        })}
        {isSimulating && (
          <div className="flex gap-3 text-gray-400 items-center animate-pulse pl-2">
            <Bot className="w-5 h-5" />
            <span className="text-sm">Executing Agent...</span>
          </div>
        )}
      </div>

      {/* INPUT BAR */}
      <div className="p-5 bg-white border-t border-gray-200 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message to test..."
            className="flex-1 p-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100 shadow-sm transition-all"
            disabled={isSimulating}
          />
          <button
            type="submit"
            disabled={isSimulating || !input.trim()}
            className="bg-indigo-600 text-white p-3.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
