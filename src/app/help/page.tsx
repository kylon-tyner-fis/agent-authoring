"use client";

import { useState, useRef, useEffect } from "react";
import {
  Layers,
  Bot,
  Network,
  Wrench,
  Server,
  BookOpen,
  HelpCircle,
  Rocket,
  Grid3X3,
  Database,
  MessageSquareText,
  Code2,
  AlertTriangle,
  Keyboard,
  Search,
  ChevronRight,
  Sparkles,
  Send,
  Loader2,
  User,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

type DocSection =
  | "taxonomy"
  | "quickstart"
  | "canvas"
  | "state"
  | "prompting"
  | "api"
  | "troubleshooting"
  | "shortcuts"
  | "ai-helper";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Custom Markdown components to fix the code block styling issues
const markdownComponents = {
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
    <a className="text-fuchsia-600 hover:underline font-medium" {...props} />
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
};

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState<DocSection>("taxonomy");
  const [searchQuery, setSearchQuery] = useState("");

  // AI Helper State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your Agent Studio documentation helper. I can answer questions about the taxonomy, canvas editing, state management, API integration, and troubleshooting. How can I help?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sidebarNav = [
    {
      id: "ai-helper",
      label: "Ask AI Helper",
      icon: Sparkles,
      color: "text-fuchsia-600",
    },
    {
      id: "taxonomy",
      label: "Agentic Taxonomy",
      icon: HelpCircle,
      color: "text-indigo-600",
    },
    {
      id: "quickstart",
      label: "Quick Start Guides",
      icon: Rocket,
      color: "text-emerald-600",
    },
    {
      id: "canvas",
      label: "Canvas & Editor Guide",
      icon: Grid3X3,
      color: "text-sky-600",
    },
    {
      id: "state",
      label: "State & Schema",
      icon: Database,
      color: "text-violet-600",
    },
    {
      id: "prompting",
      label: "Prompt Engineering",
      icon: MessageSquareText,
      color: "text-amber-600",
    },
    {
      id: "api",
      label: "API & Integration",
      icon: Code2,
      color: "text-cyan-600",
    },
    {
      id: "troubleshooting",
      label: "Troubleshooting",
      icon: AlertTriangle,
      color: "text-red-600",
    },
    {
      id: "shortcuts",
      label: "Keyboard Shortcuts",
      icon: Keyboard,
      color: "text-slate-600",
    },
  ];

  const taxonomy = [
    {
      title: "Orchestrator",
      icon: <Layers className="w-6 h-6 text-sky-600" />,
      bg: "bg-sky-50",
      border: "border-sky-200",
      job: "Delegates incoming tasks to the most suitable agent.",
      description:
        "The high-level coordination layer that acts as a traffic controller. It evaluates a request, selects the best agent for the job, and manages the flow of data and events between the system and the caller.",
    },
    {
      title: "Agent",
      icon: <Bot className="w-6 h-6 text-emerald-600" />,
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      job: "Plans and makes autonomous decisions.",
      description:
        "A runtime instance defined by a specific persona and configuration. It analyzes tasks delegated by the orchestrator and decides which tools or skills are required to solve the problem.",
    },
    {
      title: "Skill",
      icon: <Network className="w-6 h-6 text-violet-600" />,
      bg: "bg-violet-50",
      border: "border-violet-200",
      job: "Executes deterministic, step-by-step workflows.",
      description:
        "A pre-defined capability represented by a graph manifest of nodes and edges. Unlike an agent's reasoning, a skill follows a fixed logic path to produce consistent and predictable results every time it is triggered.",
    },
    {
      title: "Tool",
      icon: <Wrench className="w-6 h-6 text-amber-700" />,
      bg: "bg-amber-50",
      border: "border-amber-200",
      job: "Provides a standardized interface for agents to call capabilities.",
      description:
        "The functional bridge between an agent and a specific action. It uses a defined name and schema (rules) to allow agents to interact with local skills, structured LLM prompts, or remote services.",
    },
    {
      title: "MCP (Model Context Protocol)",
      icon: <Server className="w-6 h-6 text-cyan-700" />,
      bg: "bg-cyan-50",
      border: "border-cyan-200",
      job: "Connects the system to externally hosted capabilities.",
      description:
        "A standardized protocol used as a remote integration boundary. It allows the runtime to securely communicate with external servers, mapping remote functions into the system as usable tools.",
    },
  ];

  const faqs = [
    {
      question: "Why won't my Skill save?",
      answer:
        "Check the orchestrator canvas. Every valid graph must contain exactly one Trigger node and at least one Response node. Ensure they are properly connected.",
    },
    {
      question: "MCP Connection shows 'Error / Offline'",
      answer:
        "Ensure the URL provided is reachable from the server hosting Agent Studio. Check that your API key or Bearer token is valid. If it's a local server, ensure CORS and network bindings (e.g., 0.0.0.0) are correctly configured.",
    },
    {
      question: "How do I stop an Infinite Loop?",
      answer:
        "If an Agent gets stuck calling the same tool repeatedly, update the Agent's System Prompt to explicitly forbid repeating actions if they fail twice. For Skills, ensure your conditional edges have a fallback path to the Response node.",
    },
  ];

  const shortcuts = [
    { action: "Delete selected node/edge", keys: "Backspace / Delete" },
    { action: "Copy selection", keys: "Ctrl/Cmd + C" },
    { action: "Paste selection", keys: "Ctrl/Cmd + V" },
    { action: "Undo", keys: "Ctrl/Cmd + Z" },
    { action: "Pan canvas", keys: "Space + Drag" },
  ];

  const searchTerms = searchQuery.toLowerCase().split(" ").filter(Boolean);

  const fuzzyMatch = (text: string) => {
    if (searchTerms.length === 0) return true;
    const lowerText = text.toLowerCase();
    return searchTerms.every((term) => lowerText.includes(term));
  };

  const matchedNav = sidebarNav.filter((nav) => fuzzyMatch(nav.label));
  const matchedTaxonomy = taxonomy.filter(
    (t) =>
      fuzzyMatch(t.title) || fuzzyMatch(t.job) || fuzzyMatch(t.description),
  );
  const matchedFaqs = faqs.filter(
    (f) => fuzzyMatch(f.question) || fuzzyMatch(f.answer),
  );
  const matchedShortcuts = shortcuts.filter(
    (s) => fuzzyMatch(s.action) || fuzzyMatch(s.keys),
  );

  const isSearching = searchTerms.length > 0;
  const hasNoResults =
    matchedNav.length === 0 &&
    matchedTaxonomy.length === 0 &&
    matchedFaqs.length === 0 &&
    matchedShortcuts.length === 0;

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: userMessage },
    ];
    setChatMessages(newMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/help/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.body) throw new Error("No readable stream available");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const dataStr = part.slice(6);
            if (dataStr.trim() === "[DONE]") break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                setChatMessages((prev) => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    content: updated[lastIndex].content + parsed.text,
                  };
                  return updated;
                });
              } else if (parsed.error) {
                console.error(parsed.error);
              }
            } catch (err) {}
          }
        }
      }
    } catch (err) {
      console.error("Chat failed:", err);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "❌ I encountered an error trying to process your request.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar Navigation */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
        <div className="p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <BookOpen className="w-4 h-4 text-indigo-600" />
            </div>
            <h1 className="font-bold text-slate-900">Documentation</h1>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-transparent rounded-lg text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto custom-scrollbar flex-1">
          {sidebarNav.map((nav) => {
            const isActive = activeSection === nav.id && !isSearching;
            return (
              <button
                key={nav.id}
                onClick={() => {
                  setActiveSection(nav.id as DocSection);
                  setSearchQuery("");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <nav.icon
                  className={`w-4 h-4 ${isActive ? nav.color : "text-slate-400"}`}
                />
                {nav.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar flex flex-col">
        <div className="max-w-4xl mx-auto space-y-8 w-full flex-1 flex flex-col pb-12">
          {/* --- SEARCH RESULTS VIEW --- */}
          {isSearching ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-2xl font-bold text-slate-900">
                  Search Results
                </h2>
                <p className="text-slate-500 mt-1">
                  Showing results for "{searchQuery}"
                </p>
              </div>

              {hasNoResults ? (
                <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                  <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">
                    No matches found.
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    Try adjusting your search terms.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {matchedNav.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Documentation Sections
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {matchedNav.map((nav) => (
                          <button
                            key={nav.id}
                            onClick={() => {
                              setActiveSection(nav.id as DocSection);
                              setSearchQuery("");
                            }}
                            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all text-left"
                          >
                            <div className="flex items-center gap-3">
                              <nav.icon className={`w-5 h-5 ${nav.color}`} />
                              <span className="font-bold text-slate-800">
                                {nav.label}
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchedTaxonomy.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Taxonomy & Concepts
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {matchedTaxonomy.map((item) => (
                          <div
                            key={item.title}
                            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center border ${item.bg} ${item.border}`}
                              >
                                {item.icon}
                              </div>
                              <h4 className="font-bold text-slate-900">
                                {item.title}
                              </h4>
                            </div>
                            <p className="text-sm font-semibold text-slate-800 mb-1">
                              {item.job}
                            </p>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchedFaqs.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Troubleshooting (FAQs)
                      </h3>
                      <div className="space-y-3">
                        {matchedFaqs.map((faq, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
                          >
                            <h4 className="font-bold text-slate-800 mb-2">
                              {faq.question}
                            </h4>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {faq.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchedShortcuts.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Keyboard Shortcuts
                      </h3>
                      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {matchedShortcuts.map((sc, idx) => (
                              <tr key={idx}>
                                <td className="px-5 py-3 font-medium">
                                  {sc.action}
                                </td>
                                <td className="px-5 py-3">
                                  <kbd className="bg-slate-100 border border-slate-200 px-2 py-1 rounded font-mono text-xs">
                                    {sc.keys}
                                  </kbd>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* --- NORMAL SECTIONS VIEW --- */
            <>
              {/* SECTION: AI Helper */}
              {activeSection === "ai-helper" && (
                <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="p-5 border-b border-slate-200 bg-slate-50/50">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-fuchsia-600" /> Ask AI
                      Helper
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Get instant answers based strictly on the Agent Studio
                      documentation.
                    </p>
                  </div>

                  <div
                    className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
                    ref={scrollRef}
                  >
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.role === "assistant" && (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm bg-fuchsia-100`}
                          >
                            <Sparkles className="w-4 h-4 text-fuchsia-600" />
                          </div>
                        )}
                        <div
                          className={`p-4 rounded-xl max-w-[85%] w-full shadow-sm ${msg.role === "user" ? "bg-fuchsia-600 text-white" : "bg-white border border-slate-200 text-slate-800"}`}
                        >
                          {msg.role === "user" ? (
                            <p className="text-sm m-0 leading-relaxed whitespace-pre-wrap">
                              {msg.content}
                            </p>
                          ) : (
                            <div className="w-full">
                              <ReactMarkdown components={markdownComponents}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                        {msg.role === "user" && (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm bg-slate-200`}
                          >
                            <User className="w-4 h-4 text-slate-600" />
                          </div>
                        )}
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex gap-3 items-center text-slate-400 pl-11 animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-fuchsia-500" />
                        <span className="text-sm font-semibold text-fuchsia-500">
                          Searching documentation...
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <form onSubmit={handleSendChat} className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask a question about the documentation..."
                        className="flex-1 p-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-fuchsia-500 outline-none disabled:bg-slate-100 shadow-sm transition-all"
                        disabled={isChatLoading}
                      />
                      <button
                        type="submit"
                        disabled={isChatLoading || !chatInput.trim()}
                        className="bg-fuchsia-600 text-white p-3 rounded-xl hover:bg-fuchsia-700 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* SECTION: Taxonomy */}
              {activeSection === "taxonomy" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      Agentic Taxonomy
                    </h2>
                    <p className="text-slate-600">
                      Understanding the building blocks of the system is crucial
                      for effective authoring.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {taxonomy.map((item) => (
                      <div
                        key={item.title}
                        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center border ${item.bg} ${item.border}`}
                          >
                            {item.icon}
                          </div>
                          <h3 className="text-lg font-bold text-slate-900">
                            {item.title}
                          </h3>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {item.job}
                          </p>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === "quickstart" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      Quick Start Guides
                    </h2>
                    <p className="text-slate-600">
                      Learn how to connect the taxonomy concepts together.
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-emerald-700">
                      1. Building Your First Skill
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Skills represent the deterministic logic of your system.
                      To build one:
                    </p>
                    <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-2">
                      <li>
                        Define the <strong>State Schema</strong> (the memory
                        your skill will use).
                      </li>
                      <li>
                        Drop a <strong>Trigger</strong> node onto the
                        Orchestration Canvas to handle inputs.
                      </li>
                      <li>
                        Drop <strong>Tool</strong> nodes to perform actions,
                        mapping the Trigger's data into the Tool.
                      </li>
                      <li>
                        Drop a <strong>Response</strong> node to extract the
                        final result and terminate the graph.
                      </li>
                      <li>Connect them sequentially with edges.</li>
                    </ol>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-emerald-700">
                      2. Creating an Agent
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Once you have Skills, you can attach them to an autonomous
                      Agent.
                    </p>
                    <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
                      <li>Assign your newly created Skills to the Agent.</li>
                      <li>
                        Write a clear <strong>System Prompt</strong> defining
                        the Agent's persona and the rules it must follow when
                        using those skills.
                      </li>
                      <li>
                        Use the Sandbox to test how the Agent delegates your
                        prompts to the assigned Skills.
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-emerald-700">
                      3. Setting up an Orchestrator
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      If you have multiple Agents handling different domains,
                      use an Orchestrator to manage them. Link multiple Agents
                      under a single Orchestrator, and it will act as the master
                      traffic controller for all incoming user requests.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === "canvas" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      Canvas & Editor Guide
                    </h2>
                    <p className="text-slate-600">
                      The Orchestration Canvas is where you define the execution
                      flow of your Skills.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-5 bg-white border border-slate-200 rounded-xl">
                      <h4 className="font-bold text-sky-700 mb-2">
                        ⚡ Trigger (API Input)
                      </h4>
                      <p className="text-sm text-slate-600">
                        Initiates the graph. Use the{" "}
                        <em>Initialization Mapping</em> to map the incoming JSON
                        payload into your specific State Schema variables.
                      </p>
                    </div>
                    <div className="p-5 bg-white border border-slate-200 rounded-xl">
                      <h4 className="font-bold text-purple-700 mb-2">
                        🏁 Response (API Output)
                      </h4>
                      <p className="text-sm text-slate-600">
                        Terminates the graph. Use the{" "}
                        <em>Extraction Mapping</em> to pull specific variables
                        out of the global state to return to the caller.
                      </p>
                    </div>
                    <div className="p-5 bg-white border border-slate-200 rounded-xl">
                      <h4 className="font-bold text-amber-700 mb-2">
                        🤖 Tool / MCP Nodes
                      </h4>
                      <p className="text-sm text-slate-600">
                        Action nodes. <em>Input Mapping</em> pulls data from
                        state to feed into the tool's arguments.{" "}
                        <em>Output Mapping</em> saves the tool's result back
                        into the global state for the next node to use.
                      </p>
                    </div>
                    <div className="p-5 bg-white border border-slate-200 rounded-xl">
                      <h4 className="font-bold text-orange-700 mb-2">
                        ✋ Interrupt (Human-in-the-Loop)
                      </h4>
                      <p className="text-sm text-slate-600">
                        Pauses the graph execution to wait for human feedback.
                        When execution resumes, the feedback is injected into
                        the <code>__human_feedback__</code> channel and mapped
                        to the target state variable.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "state" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      State & Schema Management
                    </h2>
                    <p className="text-slate-600">
                      LangGraph relies on a shared memory object called State.
                      Here is how to manage it.
                    </p>
                  </div>

                  <div className="prose prose-slate max-w-none bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <h4>The Global State</h4>
                    <p className="text-sm">
                      The JSON schema defined in the "State Schema" tab acts as
                      the memory for the entire graph. Every node in your canvas
                      has access to this state object.
                    </p>

                    <h4>Data Flow (Mapping)</h4>
                    <p className="text-sm">
                      Nodes do not pass data directly to each other. Instead:
                    </p>
                    <ul className="text-sm">
                      <li>
                        <strong>Input Mapping:</strong> Pulls data <em>from</em>{" "}
                        the Global State to use in a node.
                      </li>
                      <li>
                        <strong>Output Mapping:</strong> Saves data <em>to</em>{" "}
                        the Global State when a node finishes.
                      </li>
                    </ul>

                    <h4>Types & Arrays</h4>
                    <p className="text-sm">
                      LangGraph treats data types differently when updating
                      state:
                    </p>
                    <ul className="text-sm">
                      <li>
                        <strong>
                          Primitives (Strings, Numbers, Booleans):
                        </strong>{" "}
                        Are overwritten entirely.
                      </li>
                      <li>
                        <strong>Objects:</strong> Are merged together (shallow
                        merge).
                      </li>
                      <li>
                        <strong>Arrays:</strong> Are appended to (e.g., if state
                        has <code>[1]</code> and you output <code>[2]</code>,
                        the new state is <code>[1, 2]</code>).
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeSection === "prompting" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      Prompt Engineering Best Practices
                    </h2>
                    <p className="text-slate-600">
                      Since Orchestrators and Agents rely on LLMs to route
                      logic, prompt design is critical.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                      <h3 className="font-bold text-slate-800 mb-2">
                        Role Definition
                      </h3>
                      <p className="text-sm text-slate-600">
                        Set clear boundaries for the agent. Give it a name, a
                        persona, and strict rules about what it can and cannot
                        do.
                      </p>
                      <pre className="mt-3 bg-slate-50 p-3 rounded text-xs text-slate-700 overflow-x-auto border border-slate-100">
                        "You are a strict QA Agent. You only verify code, you
                        never write it."
                      </pre>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                      <h3 className="font-bold text-slate-800 mb-2">
                        Tool Delegation
                      </h3>
                      <p className="text-sm text-slate-600">
                        Remind Agents that they are <em>managers</em>. They
                        should delegate complex tasks to Skills rather than
                        trying to generate large artifacts directly in the chat.
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                      <h3 className="font-bold text-slate-800 mb-2">
                        Routing Logic (Edges)
                      </h3>
                      <p className="text-sm text-slate-600">
                        When creating conditional edges in the Canvas, write
                        natural language conditions that the LLM can easily
                        evaluate against the current state.
                      </p>
                      <pre className="mt-3 bg-slate-50 p-3 rounded text-xs text-slate-700 overflow-x-auto border border-slate-100">
                        "User sentiment is negative" OR "priority == 'high' and
                        language == 'es'"
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "api" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      API & Integration Reference
                    </h2>
                    <p className="text-slate-600">
                      How to call your published Agents and Skills from external
                      applications.
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div>
                      <h4 className="font-bold text-slate-800 mb-2">
                        Execution Endpoints
                      </h4>
                      <p className="text-sm text-slate-600 mb-2">
                        Send a POST request to the respective run endpoint:
                      </p>
                      <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1 font-mono">
                        <li>/api/skills/[id]/run</li>
                        <li>/api/agents/[id]/run</li>
                        <li>/api/orchestrators/[id]/run</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-800 mb-2">
                        Payload Structure
                      </h4>
                      <pre className="bg-slate-800 text-slate-50 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                        {`{
  "input": "Your prompt or JSON payload here",
  "threadId": "unique-session-123" 
}`}
                      </pre>
                      <p className="text-xs text-slate-500 mt-2">
                        The <code>threadId</code> is required to maintain memory
                        and persistence across multiple calls.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-800 mb-2">
                        Streaming Responses (SSE)
                      </h4>
                      <p className="text-sm text-slate-600">
                        The API returns Server-Sent Events (SSE). You must
                        consume the stream to get real-time node executions,
                        tool arguments, and message chunks.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "troubleshooting" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      Troubleshooting & FAQs
                    </h2>
                    <p className="text-slate-600">
                      Common issues and how to resolve them.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {faqs.map((faq, idx) => (
                      <details
                        key={idx}
                        className="group bg-white rounded-xl border border-slate-200 shadow-sm [&_summary::-webkit-details-marker]:hidden"
                      >
                        <summary className="flex cursor-pointer items-center justify-between p-5 font-bold text-slate-800">
                          {faq.question}
                        </summary>
                        <div className="px-5 pb-5 text-sm text-slate-600">
                          {faq.answer}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === "shortcuts" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      Keyboard Shortcuts
                    </h2>
                    <p className="text-slate-600">
                      Speed up your workflow in the Orchestration Canvas.
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4">Action</th>
                          <th className="px-6 py-4">Shortcut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {shortcuts.map((sc, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-4 font-medium">
                              {sc.action}
                            </td>
                            <td className="px-6 py-4">
                              <kbd className="bg-slate-100 border border-slate-200 px-2 py-1 rounded font-mono text-xs">
                                {sc.keys}
                              </kbd>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
