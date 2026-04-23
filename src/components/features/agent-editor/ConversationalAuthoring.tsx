"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, User, Loader2, Database } from "lucide-react";
import { AgentConfig, SkillConfig } from "@/src/lib/types/constants";
import ReactMarkdown from "react-markdown";

// Export this so ConfigPanel can use it
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ConversationalAuthoringProps {
  config: AgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<AgentConfig>>;
  availableSkills: SkillConfig[];
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ConversationalAuthoring = ({
  config,
  setConfig,
  availableSkills,
  messages,
  setMessages,
  isProcessing,
  setIsProcessing,
}: ConversationalAuthoringProps) => {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsProcessing(true);

    try {
      const response = await fetch("/api/meta-agent/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage,
          currentConfig: config,
          skills: availableSkills,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to generate workflow.");
      }

      // Create a condensed summary of the nodes to print in the chat so it doesn't flood the screen
      const nodeSummary = data.nodes?.map((n: any) => ({
        id: n.id,
        type: n.type,
        label: n.data?.label,
        mappings:
          n.data?.input_mapping ||
          n.data?.initialization_mapping ||
          n.data?.extraction_mapping,
      }));

      // Output the step-by-step process as multiple messages
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `**Step 1: Planning**\n\n${data.plan}`,
        },
        {
          role: "assistant",
          content: `**Step 2: Topology Generation**\n\nCreated ${data.nodes?.length || 0} nodes and ${data.edges?.length || 0} edges.\n\n\`\`\`json\n${JSON.stringify(nodeSummary, null, 2)}\n\`\`\``,
        },
        {
          role: "assistant",
          content: `**Step 3: Schema Generation**\n\nGlobal State Schema:\n\`\`\`json\n${JSON.stringify(data.state_schema, null, 2)}\n\`\`\``,
        },
        {
          role: "assistant",
          content: data.message,
        },
      ]);

      // Instantly patch the live graph configuration
      setConfig((prev) => ({
        ...prev,
        state_schema: data.state_schema || prev.state_schema || {},
        orchestration: {
          nodes: data.nodes || prev.orchestration?.nodes || [],
          edges: data.edges || prev.orchestration?.edges || [],
          viewport: prev.orchestration?.viewport || { x: 0, y: 0, zoom: 1 },
        },
      }));
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ **Error:** I ran into an issue building that workflow: ${err.message}`,
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-inner relative">
      {/* Chat History */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50"
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-4 w-full ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 border border-purple-200 shadow-sm mt-1">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
            )}

            <div
              className={`p-4 rounded-2xl max-w-[80%] shadow-sm border ${
                msg.role === "user"
                  ? "bg-slate-900 text-white border-slate-800"
                  : "bg-white text-slate-800 border-slate-200"
              }`}
            >
              <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-code:bg-slate-100 prose-code:text-purple-600 prose-code:px-1 prose-code:rounded">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 border border-slate-300 shadow-sm mt-1">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-4 w-full justify-start animate-in fade-in">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 border border-purple-200 shadow-sm mt-1">
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3 text-slate-500 text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              Meta-Agent is designing your workflow...
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={handleSendMessage}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want the agent to do..."
            disabled={isProcessing}
            className="w-full p-4 pr-14 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none shadow-sm transition-all text-sm disabled:bg-slate-50 disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="absolute right-2 p-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-xs text-slate-400">
            <strong>Tip:</strong> Mention specific skills you want to use from
            your Skill Library.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
            <Database className="w-3 h-3" /> {availableSkills.length} Skills
            Available
          </div>
        </div>
      </div>
    </div>
  );
};
