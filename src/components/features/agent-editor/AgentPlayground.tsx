"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  AlertCircle,
  X,
  Loader2,
  CheckCircle2,
  Network,
  CornerDownRight,
  ArrowRight,
  GitBranch,
  Brain,
  Check,
  Copy,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AgentConfig, OrchestratorConfig } from "@/src/lib/types/constants";
import { v4 as uuidv4 } from "uuid";
import { RecursiveJsonViewer } from "../../shared/json-tools/RecursiveJsonViewer";

const getMarkdownComponents = (linkClassName: string) => ({
  p: ({ node, ...props }: any) => (
    <p
      className="mb-4 leading-relaxed text-sm text-slate-700 last:mb-0"
      {...props}
    />
  ),
  ul: ({ node, ...props }: any) => (
    <ul
      className="list-disc pl-6 mb-4 space-y-2 text-sm text-slate-700"
      {...props}
    />
  ),
  ol: ({ node, ...props }: any) => (
    <ol
      className="list-decimal pl-6 mb-4 space-y-2 text-sm text-slate-700"
      {...props}
    />
  ),
  li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
  h1: ({ node, ...props }: any) => (
    <h1 className="text-xl font-bold mb-4 mt-6 text-slate-900" {...props} />
  ),
  h2: ({ node, ...props }: any) => (
    <h2 className="text-lg font-bold mb-3 mt-5 text-slate-900" {...props} />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 className="text-base font-bold mb-2 mt-4 text-slate-900" {...props} />
  ),
  strong: ({ node, ...props }: any) => (
    <strong className="font-bold text-slate-900" {...props} />
  ),
  a: ({ node, ...props }: any) => (
    <a className={`${linkClassName} hover:underline font-medium`} {...props} />
  ),
  blockquote: ({ node, ...props }: any) => (
    <blockquote
      className="border-l-4 border-slate-300 pl-4 italic text-slate-600 mb-4 bg-slate-50 py-2 rounded-r"
      {...props}
    />
  ),
  code: ({ node, className, children, ...props }: any) => {
    const isInline = !className;
    return isInline ? (
      <code
        className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[13px] font-mono border border-slate-200"
        {...props}
      >
        {children}
      </code>
    ) : (
      <pre className="bg-slate-800 text-slate-50 p-4 rounded-lg text-[13px] font-mono overflow-x-auto mb-4 mt-2">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    );
  },
});

type HistoryEvent =
  | { type: "message"; content: string }
  | { type: "skill_start"; skillName: string; args: any }
  | { type: "skill_end"; skillName: string; result: any }
  | {
      type: "skill_node_start";
      skillName: string;
      nodeId: string;
      modelName?: string;
    }
  | {
      type: "skill_node_end";
      skillName: string;
      nodeId: string;
      updates: any;
      fullState?: any;
      modelName?: string;
    }
  | {
      type: "skill_edge_traversal";
      skillName: string;
      source: string;
      target: string;
      condition?: string;
      reasoning?: string;
    }
  | { type: "skill_tool_start"; skillName: string; toolName: string; args: any }
  | {
      type: "skill_tool_end";
      skillName: string;
      toolName: string;
      result: any;
    };

interface AgentPlaygroundProps {
  config: AgentConfig | OrchestratorConfig;
  apiEndpoint?: string;
  accent?: "agent" | "orchestrator";
  onClose: () => void;
}

const accentClasses = {
  agent: {
    link: "text-fuchsia-600",
    iconBg: "bg-fuchsia-100",
    iconText: "text-fuchsia-600",
    messageBg: "bg-fuchsia-600",
    spinner: "text-fuchsia-500",
    focusRing: "focus:ring-fuchsia-500",
    button: "bg-fuchsia-600 hover:bg-fuchsia-700",
  },
  orchestrator: {
    link: "text-sky-600",
    iconBg: "bg-sky-100",
    iconText: "text-sky-600",
    messageBg: "bg-sky-600",
    spinner: "text-sky-500",
    focusRing: "focus:ring-sky-500",
    button: "bg-sky-600 hover:bg-sky-700",
  },
};

export const AgentPlayground = ({
  config,
  apiEndpoint,
  accent = "agent",
  onClose,
}: AgentPlaygroundProps) => {
  const [input, setInput] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [threadId] = useState(() => uuidv4());
  const [isCopied, setIsCopied] = useState(false);
  const theme = accentClasses[accent];
  const markdownComponents = getMarkdownComponents(theme.link);

  const handleCopyTrace = async () => {
    let trace = "## Execution Trace\n\n";

    history.forEach((h) => {
      if (h.type === "message") {
        trace += `${h.content}\n\n`;
      } else if (h.type === "skill_start") {
        trace += `**Executing System:** ${h.skillName}\n`;
        trace += `Arguments:\n\`\`\`json\n${JSON.stringify(h.args, null, 2)}\n\`\`\`\n\n`;
      } else if (h.type === "skill_end") {
        trace += `**System Completed:** ${h.skillName}\n`;
        trace += `Result:\n\`\`\`json\n${JSON.stringify(h.result, null, 2)}\n\`\`\`\n\n`;
      } else if (h.type === "skill_node_start") {
        trace += `**Node Started:** ${h.nodeId} (in ${h.skillName})\n`;
        if (h.modelName) trace += `Model Used: ${h.modelName}\n`;
        trace += `\n`;
      } else if (h.type === "skill_node_end") {
        trace += `**Node Completed:** ${h.nodeId} (in ${h.skillName})\n`;
        if (h.modelName) trace += `Model Used: ${h.modelName}\n`;
        trace += `State Updates:\n\`\`\`json\n${JSON.stringify(h.updates, null, 2)}\n\`\`\`\n\n`;
      } else if (h.type === "skill_edge_traversal") {
        trace += `**Edge Traversal:** ${h.source} -> ${h.target}\n`;
        if (h.condition) trace += `Condition: "${h.condition}"\n`;
        if (h.reasoning) trace += `Reasoning: ${h.reasoning}\n`;
        trace += `\n`;
      } else if (h.type === "skill_tool_start") {
        trace += `**Tool Started:** ${h.toolName}\n`;
        trace += `Arguments:\n\`\`\`json\n${JSON.stringify(h.args, null, 2)}\n\`\`\`\n\n`;
      } else if (h.type === "skill_tool_end") {
        trace += `**Tool Completed:** ${h.toolName}\n`;
        trace += `Result:\n\`\`\`json\n${JSON.stringify(h.result, null, 2)}\n\`\`\`\n\n`;
      }
    });

    try {
      await navigator.clipboard.writeText(trace);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy trace", err);
    }
  };

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    setError(null);
    const displayContent = input.trim();

    setHistory((prev) => [
      ...prev,
      { type: "message", content: `**User:** ${displayContent}` },
    ]);
    setInput("");
    setIsSimulating(true);

    try {
      const response = await fetch(apiEndpoint || "/api/agents/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          input: displayContent,
          thread_id: threadId,
        }),
      });

      if (!response.body) throw new Error("No readable stream available");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
                { type: "message", content: "" },
              ]);
            } else if (event.type === "skill_end") {
              setActiveModel(null);
              setHistory((prev) => [
                ...prev,
                {
                  type: "skill_end",
                  skillName: event.skillName,
                  result: event.result,
                },
                { type: "message", content: "" },
              ]);
            } else if (event.type === "skill_node_start") {
              setActiveModel(event.modelName || null);
              setHistory((prev) => [
                ...prev,
                {
                  type: "skill_node_start",
                  skillName: event.skillName,
                  nodeId: event.nodeId,
                  modelName: event.modelName,
                },
              ]);
            } else if (event.type === "skill_node_end") {
              setActiveModel(null);
              setHistory((prev) => [
                ...prev,
                {
                  type: "skill_node_end",
                  skillName: event.skillName,
                  nodeId: event.nodeId,
                  updates: event.updates,
                  fullState: event.fullState,
                  modelName: event.modelName,
                },
              ]);
            } else if (event.type === "skill_edge_traversal") {
              setHistory((prev) => [
                ...prev,
                {
                  type: "skill_edge_traversal",
                  skillName: event.skillName,
                  source: event.source,
                  target: event.target,
                  condition: event.condition,
                  reasoning: event.reasoning,
                },
              ]);
            } else if (event.type === "skill_tool_start") {
              setHistory((prev) => [
                ...prev,
                {
                  type: "skill_tool_start",
                  skillName: event.skillName,
                  toolName: event.toolName,
                  args: event.args,
                },
              ]);
            } else if (event.type === "skill_tool_end") {
              setHistory((prev) => [
                ...prev,
                {
                  type: "skill_tool_end",
                  skillName: event.skillName,
                  toolName: event.toolName,
                  result: event.result,
                },
              ]);
            } else if (event.type === "error") {
              setActiveModel(null);
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
          <Bot className={`w-5 h-5 ${theme.iconText}`} /> Sandbox
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyTrace}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            {isCopied ? (
              <Check className={`w-3.5 h-3.5 ${theme.iconText}`} />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {isCopied ? "Copied" : "Copy Trace"}
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
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
              Chat with the system to test its reasoning and routing.
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
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${theme.iconBg}`}
                  >
                    <Bot className={`w-4 h-4 ${theme.iconText}`} />
                  </div>
                )}
                <div
                  className={`p-4 rounded-xl max-w-[85%] w-full shadow-sm ${isUser ? `${theme.messageBg} text-white` : "bg-white border border-gray-200"}`}
                >
                  {isUser ? (
                    <p className="text-sm m-0 leading-relaxed whitespace-pre-wrap">
                      {cleanContent}
                    </p>
                  ) : (
                    <div className="w-full">
                      <ReactMarkdown components={markdownComponents}>
                        {cleanContent}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          } else if (item.type === "skill_start") {
            const isSubAgent =
              item.args?.request !== undefined &&
              Object.keys(item.args).length === 1;
            return (
              <div
                key={i}
                className="flex flex-col gap-1.5 ml-11 animate-in fade-in w-[85%]"
              >
                <div
                  className={`flex items-center gap-2 text-[11px] font-mono ${isSubAgent ? "text-fuchsia-600" : "text-violet-600"}`}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {isSubAgent ? "Delegating task:" : "Executing Workflow:"}
                  </span>
                  <span
                    className={`font-semibold border px-1.5 py-0.5 rounded ${isSubAgent ? "bg-fuchsia-50 border-fuchsia-200" : "bg-violet-50 border-violet-200"}`}
                  >
                    {item.skillName}
                  </span>
                </div>
                <div className="text-sm text-slate-500 bg-white shadow-sm p-3 rounded-lg border border-slate-200">
                  <span className="font-bold mb-1.5 block text-slate-400 uppercase tracking-wider text-xs">
                    {isSubAgent ? "Agent Instructions / Request" : "Parameters"}
                  </span>
                  {isSubAgent ? (
                    <pre className="text-xs bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto font-mono text-slate-700 whitespace-pre-wrap">
                      {item.args.request}
                    </pre>
                  ) : (
                    <div className="bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto">
                      <RecursiveJsonViewer data={item.args} />
                    </div>
                  )}
                </div>
              </div>
            );
          } else if (item.type === "skill_node_end") {
            return (
              <div
                key={i}
                className="flex flex-col gap-1.5 ml-14 my-2 animate-in fade-in w-[80%]"
              >
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-slate-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Network className="w-4 h-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-700 m-0 text-[11px] uppercase tracking-wide">
                        Graph Node Completed:{" "}
                        <span className="text-violet-600 font-bold">
                          {item.nodeId}
                        </span>
                      </h3>
                    </div>
                    {item.modelName && (
                      <span className="text-[10px] font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                        {item.modelName}
                      </span>
                    )}
                  </div>
                  <div className="p-3 overflow-x-auto">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      State Updates
                    </h4>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100">
                      <RecursiveJsonViewer data={item.updates} />
                    </div>
                  </div>
                </div>
              </div>
            );
          } else if (item.type === "skill_edge_traversal") {
            return (
              <div
                key={i}
                className="flex flex-col gap-1.5 ml-14 my-2 animate-in fade-in w-[80%]"
              >
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono px-2">
                  <CornerDownRight className="w-4 h-4" />
                  <span>Traversing edge:</span>
                  <span className="font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                    {item.source}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-300" />
                  <span className="font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                    {item.target}
                  </span>
                </div>
                {item.condition && (
                  <div className="flex items-center gap-1.5 text-xs text-orange-600 font-mono px-2 ml-6">
                    <GitBranch className="w-3 h-3" />
                    <span className="bg-orange-50 border border-orange-200 px-2 py-0.5 rounded italic">
                      Condition met: "{item.condition}"
                    </span>
                  </div>
                )}
                {item.reasoning && (
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-500 px-2 ml-6 mt-1">
                    <Brain className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-400" />
                    <div className="bg-white border border-slate-200 shadow-sm px-3 py-2 rounded-lg leading-relaxed">
                      <span className="font-semibold text-indigo-600 mr-1">
                        Router Logic:
                      </span>
                      {item.reasoning}
                    </div>
                  </div>
                )}
              </div>
            );
          } else if (item.type === "skill_tool_start") {
            return (
              <div
                key={i}
                className="flex flex-col gap-1.5 ml-16 my-2 animate-in fade-in w-[75%] border-l-2 border-emerald-200 pl-3"
              >
                <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-mono">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Calling Tool / MCP:</span>
                  <span className="font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    {item.toolName}
                  </span>
                </div>
                <div className="bg-white border border-emerald-100 rounded shadow-sm p-2">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                    Tool Inputs
                  </span>
                  <div className="bg-slate-50 p-1.5 rounded border border-slate-100 overflow-x-auto">
                    <RecursiveJsonViewer data={item.args} />
                  </div>
                </div>
              </div>
            );
          } else if (item.type === "skill_tool_end") {
            return (
              <div
                key={i}
                className="flex flex-col gap-1.5 ml-16 mb-4 animate-in fade-in w-[75%] border-l-2 border-emerald-200 pl-3"
              >
                <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Tool / MCP Completed</span>
                </div>
                <div className="bg-white border border-emerald-100 rounded shadow-sm p-2">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                    Tool Outputs
                  </span>
                  <div className="bg-slate-50 p-1.5 rounded border border-slate-100 overflow-x-auto max-h-60 overflow-y-auto custom-scrollbar">
                    <RecursiveJsonViewer data={item.result} />
                  </div>
                </div>
              </div>
            );
          } else if (item.type === "skill_end") {
            return (
              <div
                key={i}
                className="flex flex-col gap-1.5 ml-11 animate-in fade-in w-[85%] mb-4"
              >
                <div className="flex items-center gap-2 text-[11px] text-fuchsia-600 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Execution Completed:</span>
                  <span className="font-semibold bg-fuchsia-50 border border-fuchsia-200 px-1.5 py-0.5 rounded">
                    {item.skillName}
                  </span>
                </div>
                <div className="text-sm text-slate-500 bg-white shadow-sm p-3 rounded-lg border border-slate-200 max-h-60 overflow-y-auto custom-scrollbar">
                  <span className="font-bold mb-1.5 block text-slate-400 uppercase tracking-wider text-xs">
                    Final Output
                  </span>
                  {typeof item.result === "string" ? (
                    <pre className="text-xs bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto font-mono text-slate-700 whitespace-pre-wrap">
                      {item.result}
                    </pre>
                  ) : (
                    <div className="bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto">
                      <RecursiveJsonViewer data={item.result} />
                    </div>
                  )}
                </div>
              </div>
            );
          }
          return null;
        })}

        {isSimulating && (
          <div className="flex gap-3 text-gray-400 items-center animate-pulse pl-11 mt-4">
            <Loader2 className={`w-5 h-5 animate-spin ${theme.spinner}`} />
            <span className={`text-sm font-semibold ${theme.spinner}`}>
              {activeModel
                ? `Processing with ${activeModel}...`
                : "Processing..."}
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
            placeholder="Type your request..."
            className={`flex-1 p-3.5 border border-gray-300 rounded-xl focus:ring-2 ${theme.focusRing} outline-none disabled:bg-gray-100 shadow-sm transition-all`}
            disabled={isSimulating}
          />
          <button
            type="submit"
            disabled={isSimulating || !input.trim()}
            className={`${theme.button} text-white p-3.5 rounded-xl disabled:opacity-50 transition-colors shadow-sm`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
