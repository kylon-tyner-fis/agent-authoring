"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  AlertCircle,
  Network,
  X,
  FileTerminal,
  MessageSquare,
  CornerDownRight,
  ArrowRight,
  GitBranch,
  Brain,
  Hand,
  Loader2,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SkillConfig, Message } from "@/src/lib/types/constants";
import { v4 as uuidv4 } from "uuid";
import { RecursiveJsonViewer } from "../../shared/json-tools/RecursiveJsonViewer";

const MarkdownComponents = {
  code(props: any) {
    const { children, className, node, ...rest } = props;
    const match = /language-(\w+)/.exec(className || "");

    if (match && match[1] === "json") {
      try {
        const data = JSON.parse(String(children).replace(/\n$/, ""));
        if (data && typeof data === "object" && "extracted_data" in data) {
          const { extracted_data, ...systemData } = data;
          return (
            <div className="my-4 flex flex-col gap-4 w-full not-prose font-sans">
              <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-sm overflow-hidden">
                <div className="bg-blue-100 border-b border-blue-200 px-4 py-2.5 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-700" />
                  <h3 className="font-bold text-blue-900 m-0 text-xs uppercase tracking-wider">
                    Final Output
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
            <div className="p-5 overflow-x-auto">
              <RecursiveJsonViewer data={data} />
            </div>
          </div>
        );
      } catch (e) {}
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },
};

type HistoryEvent =
  | { type: "node_end"; node: string; updates: any; fullState?: any }
  | {
      type: "edge_traversal";
      source: string;
      target: string;
      condition?: string;
      reasoning?: string;
    }
  | { type: "tool_start"; toolName: string; args: Record<string, any> }
  | { type: "tool_end"; toolName: string; result: any };

interface PlaygroundProps {
  config: SkillConfig;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onClose: () => void;
  onActiveNodeChange?: (nodeId: string | null) => void;
}

export const Playground = ({
  config,
  messages,
  setMessages,
  onClose,
  onActiveNodeChange,
}: PlaygroundProps) => {
  const [input, setInput] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"chat" | "state">("chat");
  const [stateHistory, setStateHistory] = useState<HistoryEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [threadId] = useState(() => uuidv4());
  const [interruptedNode, setInterruptedNode] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, stateHistory]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let resumeValue;
    if (interruptedNode && input.trim()) {
      resumeValue = input.trim();
    }

    if (!input.trim() && !resumeValue) return;

    setError(null);

    const displayContent = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: displayContent }]);

    setStateHistory([]);
    setInput("");

    setIsSimulating(true);
    setActiveTab("state");
    setInterruptedNode(null);

    try {
      const body = {
        config,
        input: resumeValue ? "" : displayContent,
        thread_id: threadId,
        resume_value: resumeValue,
      };

      const response = await fetch("/api/skills/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("text/event-stream")) {
        throw new Error("Server returned an invalid response.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No readable stream available");

      const decoder = new TextDecoder();
      let buffer = "";

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

            if (event.type === "node_start") {
              onActiveNodeChange?.(event.node);
            } else if (event.type === "node_end") {
              const nodeName =
                config.orchestration?.nodes?.find(
                  (n: any) => n.id === event.node,
                )?.data?.label || event.node;
              setStateHistory((prev) => [
                ...prev,
                {
                  type: "node_end",
                  node: nodeName,
                  updates: event.stateUpdates,
                  fullState: event.fullState,
                },
              ]);
            } else if (event.type === "edge_traversal") {
              const sourceName =
                config.orchestration?.nodes?.find(
                  (n: any) => n.id === event.source,
                )?.data?.label || event.source;
              const targetName =
                config.orchestration?.nodes?.find(
                  (n: any) => n.id === event.target,
                )?.data?.label || event.target;
              setStateHistory((prev) => [
                ...prev,
                {
                  type: "edge_traversal",
                  source: sourceName,
                  target: targetName,
                  condition: event.condition,
                  reasoning: event.reasoning,
                },
              ]);
            } else if (event.type === "tool_start") {
              setStateHistory((prev) => [
                ...prev,
                {
                  type: "tool_start",
                  toolName: event.toolName,
                  args: event.args,
                },
              ]);
            } else if (event.type === "tool_end") {
              setStateHistory((prev) => [
                ...prev,
                {
                  type: "tool_end",
                  toolName: event.toolName,
                  result: event.result,
                },
              ]);
            } else if (event.type === "interrupt") {
              setInterruptedNode(event.node);
              onActiveNodeChange?.(event.node);
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `⏸️ **Waiting for Human Input at node:** \`${event.node}\`. Please provide your response.`,
                },
              ]);
              setActiveTab("chat");
            } else if (event.type === "final") {
              onActiveNodeChange?.(null);
              const formattedJson = JSON.stringify(event.result, null, 2);
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `\`\`\`json\n${formattedJson}\n\`\`\``,
                },
              ]);
              setActiveTab("chat");
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Execution failed." },
      ]);
      onActiveNodeChange?.(null);
    } finally {
      setIsSimulating(false);
      if (!interruptedNode) onActiveNodeChange?.(null);
    }
  };

  return (
    <div className="w-full flex flex-col h-full bg-gray-50 relative border-l border-gray-200">
      <div className="border-b border-gray-200 bg-white shrink-0 shadow-sm z-10">
        <div className="p-4 flex items-center justify-between">
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
        <div className="flex px-4 border-t border-gray-100">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "chat" ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <MessageSquare className="w-4 h-4" /> Chat
          </button>
          <button
            onClick={() => setActiveTab("state")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === "state" ? "border-purple-600 text-purple-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <FileTerminal className="w-4 h-4" /> State Inspector
          </button>
        </div>
      </div>

      {error && (
        <div className="absolute top-24 left-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-md z-10 flex items-start gap-3">
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

      <div className="flex-1 p-6 overflow-y-auto" ref={scrollRef}>
        {activeTab === "chat" ? (
          <div className="space-y-6">
            {messages.map((msg, i) => {
              const bgClass =
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-200";
              return (
                <div
                  key={i}
                  className={`flex gap-3 w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm bg-indigo-100`}
                    >
                      <Bot className="w-4 h-4 text-indigo-600" />
                    </div>
                  )}
                  <div
                    className={`p-4 rounded-xl max-w-[85%] w-full shadow-sm ${bgClass}`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm m-0 leading-relaxed">
                        {msg.content}
                      </p>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                        <ReactMarkdown components={MarkdownComponents}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {stateHistory.length === 0 && !isSimulating && (
              <p className="text-sm text-gray-500 italic text-center mt-10">
                Run an execution to see state updates.
              </p>
            )}
            {stateHistory.map((history, i) => {
              if (history.type === "node_end") {
                return (
                  <div
                    key={i}
                    className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2"
                  >
                    <div className="bg-slate-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
                      <Network className="w-4 h-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-700 m-0 text-xs uppercase tracking-wide">
                        Node Completed:{" "}
                        <span className="text-purple-600 font-bold">
                          {history.node}
                        </span>
                      </h3>
                    </div>
                    <div className="p-4 overflow-x-auto space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                          State Updates
                        </h4>
                        <RecursiveJsonViewer data={history.updates} />
                      </div>
                      {history.fullState && (
                        <div className="pt-3 border-t border-slate-100">
                          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Global State
                          </h4>
                          <RecursiveJsonViewer data={history.fullState} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              } else if (history.type === "tool_start") {
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 ml-6 my-2 animate-in fade-in"
                  >
                    <div className="flex items-center gap-2 text-[11px] text-teal-600 font-mono px-4">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Executing Tool:</span>
                      <span className="font-semibold bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                        {history.toolName}
                      </span>
                    </div>
                    <div className="ml-10 text-sm text-slate-500 bg-white shadow-sm p-3 rounded-lg border border-slate-200">
                      <span className="font-bold mb-1.5 block text-slate-400 uppercase tracking-wider">
                        Arguments
                      </span>
                      <RecursiveJsonViewer data={history.args} />
                    </div>
                  </div>
                );
              } else if (history.type === "tool_end") {
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 ml-6 my-2 animate-in fade-in"
                  >
                    <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-mono px-4">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Tool Completed:</span>
                      <span className="font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        {history.toolName}
                      </span>
                    </div>
                    <div className="ml-10 text-sm text-slate-500 bg-white shadow-sm p-3 rounded-lg border border-slate-200 max-h-60 overflow-y-auto custom-scrollbar">
                      <span className="font-bold mb-1.5 block text-slate-400 uppercase tracking-wider">
                        Result
                      </span>
                      <RecursiveJsonViewer data={history.result} />
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 ml-6 my-2 animate-in fade-in"
                  >
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono px-4">
                      <CornerDownRight className="w-4 h-4" />
                      <span>Traversing edge:</span>
                      <span className="font-semibold text-slate-600 bg-slate-200/50 border border-slate-200 px-1.5 py-0.5 rounded">
                        {history.source}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className="font-semibold text-slate-600 bg-slate-200/50 border border-slate-200 px-1.5 py-0.5 rounded">
                        {history.target}
                      </span>
                    </div>
                    {history.condition && (
                      <div className="flex items-center gap-1.5 text-sm text-orange-600 font-mono px-4 ml-6">
                        <GitBranch className="w-3 h-3" />
                        <span className="bg-orange-50 border border-orange-200 px-2 py-0.5 rounded italic">
                          Condition met: "{history.condition}"
                        </span>
                      </div>
                    )}
                    {history.reasoning && (
                      <div className="flex items-start gap-1.5 text-[11px] text-slate-500 px-4 ml-6 mt-1">
                        <Brain className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-400" />
                        <div className="bg-white border border-slate-200 shadow-sm px-3 py-2 rounded-lg leading-relaxed">
                          <span className="font-semibold text-indigo-600 mr-1">
                            Router Logic:
                          </span>
                          {history.reasoning}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
            })}
          </div>
        )}

        {isSimulating && (
          <div className="flex gap-3 text-gray-400 items-center animate-pulse pl-2 mt-4">
            <svg
              className="w-5 h-5 animate-spin text-indigo-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-sm font-semibold text-indigo-500">
              Agent Processing...
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
            placeholder={
              interruptedNode
                ? "Type your feedback, or instructions..."
                : "Type a message to test..."
            }
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
