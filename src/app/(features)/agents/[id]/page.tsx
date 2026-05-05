"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Network,
  Loader2,
  Trash2,
  BrainCircuit,
  FileText,
  Upload,
} from "lucide-react";
import { AgentConfig, SkillConfig } from "@/src/lib/types/constants";
import { v4 as uuidv4 } from "uuid";
import { AgentPlayground } from "@/src/components/features/agent-editor/AgentPlayground";
import { EditorTopPanel } from "@/src/components/layout/EditorTopPanel";

interface AgentFile {
  id: string;
  filename: string;
  usage_type: "instruction" | "reference";
  created_at: string;
}

export default function AgentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const isNew = id === "new";

  const [agent, setAgent] = useState<AgentConfig>({
    id: "",
    project_id: "",
    name: "",
    description: "",
    skills: [],
    status: "active",
    system_prompt: "",
  });

  const [availableSkills, setAvailableSkills] = useState<SkillConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const [files, setFiles] = useState<AgentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadUsageType, setUploadUsageType] = useState<
    "instruction" | "reference"
  >("reference");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyConfig = async () => {
    try {
      const snapshot = {
        ...agent,
        skills: agent.skills.map(
          (skillId) => availableSkills.find((s) => s.id === skillId) || skillId,
        ),
      };

      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const skillsData = await fetch("/api/skills").then((res) => res.json());

        if (skillsData.skills) setAvailableSkills(skillsData.skills);

        if (!isNew) {
          const agentData = await fetch(`/api/agents/${id}`).then((res) =>
            res.json(),
          );
          if (agentData.agent) setAgent(agentData.agent);

          const filesData = await fetch(`/api/agents/${id}/files`).then((res) =>
            res.json(),
          );
          if (filesData.files) setFiles(filesData.files);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, isNew]);

  const handleSave = async () => {
    setIsSaving(true);
    const finalAgent = { ...agent, id: agent.id || uuidv4() };

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalAgent),
      });

      if (res.ok) router.push("/agents");
    } catch (error) {
      console.error("Error saving agent:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    setAgent((prev) => ({
      ...prev,
      skills: prev.skills.includes(skillId)
        ? prev.skills.filter((id) => id !== skillId)
        : [...prev.skills, skillId],
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agent.id) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("usageType", uploadUsageType);

    try {
      const res = await fetch(`/api/agents/${agent.id}/files`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      if (data.file) {
        setFiles([data.file, ...files]);
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to permanently delete this file?"))
      return;
    try {
      const res = await fetch(`/api/agents/${agent.id}/files/${fileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFiles(files.filter((f) => f.id !== fileId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <EditorTopPanel
        backUrl="/agents"
        backLabel="Back to Agents"
        onCopy={handleCopyConfig}
        isCopied={isCopied}
        onTest={() => setIsPlaygroundOpen(true)}
        testLabel="Test Agent"
        onSave={handleSave}
        saveLabel="Save Agent"
        isSaving={isSaving}
        themeColor="emerald"
      />
      {isLoading ? (
        <div className="h-screen w-full flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div
            className={`flex-1 overflow-y-auto p-8 transition-all duration-300 ${isPlaygroundOpen ? "w-[60%]" : "w-full"}`}
          >
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-500" /> General
                  Information
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-gray-600">
                      Agent Name
                    </label>
                    <input
                      type="text"
                      value={agent.name}
                      onChange={(e) =>
                        setAgent({ ...agent, name: e.target.value })
                      }
                      className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500"
                      placeholder="e.g. Sales Assistant"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-gray-600">
                      Description
                    </label>
                    <input
                      type="text"
                      value={agent.description}
                      onChange={(e) =>
                        setAgent({ ...agent, description: e.target.value })
                      }
                      className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-gray-600 flex justify-between">
                      <span>Agent Prompt / Role</span>
                      <span className="text-gray-400 font-normal">
                        Base Persona & Instructions
                      </span>
                    </label>
                    <textarea
                      rows={8}
                      value={agent.system_prompt || ""}
                      onChange={(e) =>
                        setAgent({ ...agent, system_prompt: e.target.value })
                      }
                      className="w-full p-3 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500 min-h-[150px] bg-slate-50 text-slate-900"
                      placeholder="e.g. You are a Goals, Outcomes, and Objectives agent for technical education..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">
                      Status
                    </label>
                    <select
                      value={agent.status}
                      onChange={(e) =>
                        setAgent({
                          ...agent,
                          status: e.target.value as "active" | "inactive",
                        })
                      }
                      className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-emerald-500 bg-white"
                    >
                      <option value="active">🟢 Active</option>
                      <option value="inactive">⚪ Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Network className="w-4 h-4 text-violet-500" /> Assigned
                  Skills (Workflows)
                </h2>
                <p className="text-xs text-slate-500">
                  Select the orchestration workflows this agent is allowed to
                  execute.
                </p>

                <div className="grid grid-cols-2 gap-4 mt-2">
                  {availableSkills.map((skill) => (
                    <div
                      key={skill.id}
                      onClick={() => toggleSkill(skill.id)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all ${agent.skills.includes(skill.id) ? "border-violet-500 bg-violet-50/30 ring-1 ring-violet-500" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm text-slate-800 truncate">
                          {skill.name}
                        </span>
                        <input
                          type="checkbox"
                          checked={agent.skills.includes(skill.id)}
                          readOnly
                          className="mt-1"
                        />
                      </div>
                      <span className="text-xs text-slate-500 line-clamp-2">
                        {skill.description}
                      </span>
                    </div>
                  ))}
                  {availableSkills.length === 0 && (
                    <div className="col-span-2 p-6 text-sm text-slate-400 italic text-center border border-dashed border-slate-300 rounded-xl">
                      No skills available. Create one in the Skills tab first.
                    </div>
                  )}
                </div>
              </div>

              {/* --- KNOWLEDGE & MEMORY SECTION --- */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-fuchsia-500" />{" "}
                  Knowledge & Memory
                </h2>
                <p className="text-xs text-slate-500">
                  Upload text or markdown files. <b>Instruction</b> files are
                  appended to the system prompt. <b>Reference</b> files are
                  chunked, vectorized, and accessible via the agent's internal
                  search tool.
                </p>

                {isNew ? (
                  <div className="p-6 text-sm text-slate-400 italic text-center border border-dashed border-slate-300 rounded-xl bg-slate-50">
                    You must save the agent first before uploading files.
                  </div>
                ) : (
                  <div className="space-y-4 mt-2">
                    {/* Upload Controls */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <select
                        value={uploadUsageType}
                        onChange={(e) =>
                          setUploadUsageType(
                            e.target.value as "instruction" | "reference",
                          )
                        }
                        className="p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-fuchsia-500 bg-white font-semibold text-slate-700"
                        disabled={isUploading}
                      >
                        <option value="reference">
                          📚 Reference Document (RAG)
                        </option>
                        <option value="instruction">🧠 Core Instruction</option>
                      </select>

                      <input
                        type="file"
                        accept=".txt,.md"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                      />

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-900 transition-colors disabled:opacity-50 text-sm"
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {isUploading
                          ? "Processing & Embedding..."
                          : "Upload File"}
                      </button>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 mt-4">
                        {files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div
                                className={`p-2 rounded-lg ${file.usage_type === "instruction" ? "bg-fuchsia-50 text-fuchsia-600" : "bg-blue-50 text-blue-600"}`}
                              >
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-bold text-slate-800 truncate">
                                  {file.filename}
                                </span>
                                <span
                                  className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 ${file.usage_type === "instruction" ? "text-fuchsia-500" : "text-blue-500"}`}
                                >
                                  {file.usage_type}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteFile(file.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete File"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isPlaygroundOpen && (
            <div className="w-[40%] min-w-[450px] h-full shadow-2xl z-20 bg-white animate-in slide-in-from-right-8 duration-300 border-l border-slate-200">
              <AgentPlayground
                config={agent}
                apiEndpoint="/api/agents/simulate"
                onClose={() => setIsPlaygroundOpen(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
