"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Bot,
  Network,
  Loader2,
  BrainCircuit,
  FileText,
  Trash2,
  Database,
  Save,
  ArrowLeft,
  Edit2,
  X,
  UserSquare,
} from "lucide-react";
import { useToast } from "@/src/components/layout/Toast";

interface AgentConfig {
  id?: string;
  name: string;
  description: string;
  system_prompt: string;
  skills: string[];
  sub_agents: string[];
}

interface Skill {
  id: string;
  name: string;
  description: string;
}

interface AgentFile {
  id: string;
  filename: string;
  usage_type: "instruction" | "reference";
  created_at: string;
}

export default function AgentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const isNew = params.id === "new";
  const id = isNew ? null : (params.id as string);

  // --- CORE STATE ---
  const [agent, setAgent] = useState<AgentConfig>({
    name: "",
    description: "",
    system_prompt: "", // Kept in state for backend compatibility, but hidden from UI
    skills: [],
    sub_agents: [],
  });

  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- FILE STATE ---
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // New state for Drag & Drop
  const [dragInstruction, setDragInstruction] = useState(false);
  const [dragReference, setDragReference] = useState(false);

  // --- FILE EDITOR STATE ---
  const [editingFile, setEditingFile] = useState<AgentFile | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isFetchingFile, setIsFetchingFile] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({});

  // Separate refs for the hidden inputs
  const instructionRef = useRef<HTMLInputElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);

  // --- DATA FETCHING ---
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch dependencies (skills)
        const skillsRes = await fetch("/api/skills");
        const skillsData = await skillsRes.json();

        if (skillsData.skills) setAvailableSkills(skillsData.skills);

        // Fetch current agent & its files
        if (!isNew) {
          const [agentRes, filesRes] = await Promise.all([
            fetch(`/api/agents/${id}`),
            fetch(`/api/agents/${id}/files`),
          ]);

          const agentData = await agentRes.json();
          const filesData = await filesRes.json();

          if (agentData.agent) setAgent(agentData.agent);
          if (filesData.files) setFiles(filesData.files);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [id, isNew]);

  // --- SAVE HANDLER ---
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Save the Agent Configuration
      const url = isNew ? "/api/agents" : `/api/agents/${id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agent),
      });

      // Safely parse the response
      const responseText = await res.text();
      let data: any = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error("Non-JSON response from server:", responseText);
        }
      }

      if (!res.ok) {
        throw new Error(
          data.error ||
            `Server Error ${res.status}: ${responseText.substring(0, 100)}`,
        );
      }

      const savedAgentId = data.agent?.id || agent.id;

      // 2. Process any pending file edits
      const editPromises = Object.entries(pendingEdits).map(
        ([fileId, newText]) => {
          return fetch(`/api/agents/${savedAgentId}/files/${fileId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: newText }),
          }).then(async (res) => {
            // Safely parse file saves too
            const fileResponseText = await res.text();
            let fileData: any = {};
            if (fileResponseText) {
              try {
                fileData = JSON.parse(fileResponseText);
              } catch (e) {}
            }

            if (!res.ok) {
              throw new Error(
                `Failed to save file ${fileId}: ${fileData.error || res.statusText}`,
              );
            }
          });
        },
      );

      // Wait for all file vectorization and saving to finish
      await Promise.all(editPromises);

      // 3. Clear local edits since they are now synced with the server
      setPendingEdits({});

      if (isNew) {
        addToast("Agent created successfully!", "success");
        router.push(`/agents/${savedAgentId}`);
      } else {
        addToast("Agent and files saved successfully!", "success");
      }
    } catch (error: any) {
      addToast(`Save failed: ${error.message}`, "error");
    } finally {
      setIsSaving(false);
    }
  };

  // --- UPLOAD HANDLERS ---
  const processUpload = async (
    file: File,
    usageType: "instruction" | "reference",
  ) => {
    if (!agent.id) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("usageType", usageType);

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
      addToast(`Upload failed: ${err.message}`, "error");
    } finally {
      setIsUploading(false);
      if (instructionRef.current) instructionRef.current.value = "";
      if (referenceRef.current) referenceRef.current.value = "";
    }
  };

  const handleDrop = (
    e: React.DragEvent,
    usageType: "instruction" | "reference",
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (usageType === "instruction") setDragInstruction(false);
    else setDragReference(false);

    const file = e.dataTransfer.files?.[0];
    if (file) processUpload(file, usageType);
  };

  const handleDragOver = (
    e: React.DragEvent,
    usageType: "instruction" | "reference",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (usageType === "instruction") setDragInstruction(true);
    else setDragReference(true);
  };

  const handleDragLeave = (
    e: React.DragEvent,
    usageType: "instruction" | "reference",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (usageType === "instruction") setDragInstruction(false);
    else setDragReference(false);
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    usageType: "instruction" | "reference",
  ) => {
    const file = e.target.files?.[0];
    if (file) processUpload(file, usageType);
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!agent.id) return;
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

  const handleEditClick = async (file: AgentFile) => {
    if (!agent.id) return;
    setEditingFile(file);
    setEditContent("");

    // 1. If we already have unsaved local changes, load those instead of fetching!
    if (pendingEdits[file.id] !== undefined) {
      setEditContent(pendingEdits[file.id]);
      return;
    }

    // 2. Otherwise, fetch the original text from the server
    setIsFetchingFile(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/files/${file.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditContent(data.text);
    } catch (err: any) {
      addToast(`Failed to load file content: ${err.message}`, "error");
      setEditingFile(null);
    } finally {
      setIsFetchingFile(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editingFile) return;

    // Simply save the changes locally to our pendingEdits map!
    // We DO NOT hit the database or trigger vectorization here.
    setPendingEdits((prev) => ({
      ...prev,
      [editingFile.id]: editContent,
    }));

    setEditingFile(null);
  };

  // --- TOGGLE HANDLERS FOR CAPABILITIES ---
  const toggleSkill = (skillId: string) => {
    setAgent((prev) => ({
      ...prev,
      skills: prev.skills.includes(skillId)
        ? prev.skills.filter((id) => id !== skillId)
        : [...prev.skills, skillId],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const instructionFiles = files.filter((f) => f.usage_type === "instruction");
  const referenceFiles = files.filter((f) => f.usage_type === "reference");

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/agents")}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-100 flex items-center justify-center text-fuchsia-600">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {isNew ? "Create Agent" : agent.name || "Untitled Agent"}
              </h1>
              <p className="text-sm text-slate-500">
                Configure persona and capabilities
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-900 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? "Saving..." : "Save Agent"}
        </button>
      </div>

      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* PANEL 1: General Info */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-2">
              <UserSquare className="w-4 h-4 text-fuchsia-500" /> Agent Profile
            </h2>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Agent Name
              </label>
              <input
                type="text"
                value={agent.name}
                onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 focus:bg-white transition-all text-sm"
                placeholder="e.g., Data Analyst"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Short Description
              </label>
              <input
                type="text"
                value={agent.description}
                onChange={(e) =>
                  setAgent({ ...agent, description: e.target.value })
                }
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 focus:bg-white transition-all text-sm"
                placeholder="What is this agent's primary purpose?"
              />
            </div>
          </div>

          {/* PANEL 2: KNOWLEDGE & MEMORY SECTION */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-fuchsia-500" /> Cognitive
              Foundation
            </h2>
            <p className="text-xs text-slate-500">
              Upload text or markdown files to shape the agent's logic.{" "}
              <b>Instructions</b> dictate behavior and rules. <b>References</b>{" "}
              serve as searchable context and data.
            </p>

            {isNew ? (
              <div className="p-8 mt-4 text-sm text-slate-400 italic text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                You must save the agent first before uploading files.
              </div>
            ) : (
              <div className="space-y-6 mt-4">
                {/* DUAL DROPZONE UPLOAD CONTROLS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ZONE A: Instructions */}
                  <div
                    onDragOver={(e) => handleDragOver(e, "instruction")}
                    onDragLeave={(e) => handleDragLeave(e, "instruction")}
                    onDrop={(e) => handleDrop(e, "instruction")}
                    onClick={() =>
                      !isUploading && instructionRef.current?.click()
                    }
                    className={`relative p-8 border-2 border-dashed rounded-xl text-center flex flex-col items-center justify-center transition-all duration-200 ${
                      isUploading
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                    } ${
                      dragInstruction
                        ? "border-fuchsia-500 bg-fuchsia-50 scale-[1.02]"
                        : "border-slate-200 hover:border-fuchsia-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".txt,.md"
                      className="hidden"
                      ref={instructionRef}
                      onChange={(e) => handleFileSelect(e, "instruction")}
                      disabled={isUploading}
                    />
                    <BrainCircuit
                      className={`w-8 h-8 mb-3 transition-colors ${dragInstruction ? "text-fuchsia-600" : "text-slate-400"}`}
                    />
                    <h3 className="text-sm font-bold text-slate-800">
                      Core Instruction
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-[200px] leading-relaxed">
                      Upload a prompt or rule file. Directly governs the agent's
                      behavior.
                    </p>
                    {isUploading && dragInstruction && (
                      <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
                      </div>
                    )}
                  </div>

                  {/* ZONE B: References */}
                  <div
                    onDragOver={(e) => handleDragOver(e, "reference")}
                    onDragLeave={(e) => handleDragLeave(e, "reference")}
                    onDrop={(e) => handleDrop(e, "reference")}
                    onClick={() =>
                      !isUploading && referenceRef.current?.click()
                    }
                    className={`relative p-8 border-2 border-dashed rounded-xl text-center flex flex-col items-center justify-center transition-all duration-200 ${
                      isUploading
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                    } ${
                      dragReference
                        ? "border-blue-500 bg-blue-50 scale-[1.02]"
                        : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".txt,.md"
                      className="hidden"
                      ref={referenceRef}
                      onChange={(e) => handleFileSelect(e, "reference")}
                      disabled={isUploading}
                    />
                    <Database
                      className={`w-8 h-8 mb-3 transition-colors ${dragReference ? "text-blue-600" : "text-slate-400"}`}
                    />
                    <h3 className="text-sm font-bold text-slate-800">
                      Reference Document
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-[200px] leading-relaxed">
                      Upload knowledge bases. Searchable via internal RAG.
                    </p>
                    {isUploading && !dragInstruction && (
                      <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      </div>
                    )}
                  </div>
                </div>

                {/* SEPARATED TWO-COLUMN FILE LIST */}
                {files.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                    {/* Instruction Files Column */}
                    <div className="space-y-3">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <BrainCircuit className="w-3.5 h-3.5 text-fuchsia-500" />{" "}
                        Uploaded Instructions
                      </h3>
                      <div className="space-y-2">
                        {instructionFiles.length === 0 ? (
                          <p className="text-sm text-slate-400 italic p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                            No instruction files uploaded.
                          </p>
                        ) : (
                          instructionFiles.map((file) => {
                            const hasUnsavedChanges = Object.keys(
                              pendingEdits,
                            ).includes(file.id);
                            return (
                              <div
                                key={file.id}
                                className="group flex items-start justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 hover:shadow-md transition-all"
                              >
                                <div className="flex items-start gap-3 overflow-hidden">
                                  <div className="p-2 rounded-lg bg-fuchsia-50 text-fuchsia-600 shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="flex flex-col min-w-0 mt-0.5">
                                    <span className="text-sm font-bold text-slate-800 break-words leading-tight">
                                      {file.filename}
                                      {pendingEdits[file.id] !== undefined && (
                                        <span
                                          className="w-2 h-2 rounded-full bg-amber-400"
                                          title="Unsaved edits pending"
                                        />
                                      )}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold tracking-wider mt-1.5 text-slate-400">
                                      {new Date(
                                        file.created_at,
                                      ).toLocaleDateString()}
                                      {hasUnsavedChanges && (
                                        <span className="text-amber-500 ml-1.5">
                                          - Unsaved changes
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleEditClick(file)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit File"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFile(file.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete File"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Reference Files Column */}
                    <div className="space-y-3">
                      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-blue-500" />{" "}
                        Uploaded References
                      </h3>
                      <div className="space-y-2">
                        {referenceFiles.length === 0 ? (
                          <p className="text-sm text-slate-400 italic p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                            No reference files uploaded.
                          </p>
                        ) : (
                          referenceFiles.map((file) => {
                            const hasUnsavedChanges = Object.keys(
                              pendingEdits,
                            ).includes(file.id);
                            return (
                              <div
                                key={file.id}
                                className="group flex items-start justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 hover:shadow-md transition-all"
                              >
                                <div className="flex items-start gap-3 overflow-hidden">
                                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="flex flex-col min-w-0 mt-0.5">
                                    <span className="text-sm font-bold text-slate-800 break-words leading-tight">
                                      {file.filename}
                                      {pendingEdits[file.id] !== undefined && (
                                        <span
                                          className="w-2 h-2 rounded-full bg-amber-400"
                                          title="Unsaved edits pending"
                                        />
                                      )}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold tracking-wider mt-1.5 text-slate-400">
                                      {new Date(
                                        file.created_at,
                                      ).toLocaleDateString()}
                                      {hasUnsavedChanges && (
                                        <span className="text-amber-500 ml-1.5">
                                          - Unsaved changes
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleEditClick(file)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit File"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFile(file.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete File"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PANEL 3: Assigned Skills (Full Width) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-fuchsia-500" /> Assigned Skills
              </h2>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {agent.skills.length} Selected
              </span>
            </div>
            <p className="text-xs text-slate-500 -mt-2">
              Select the tools and workflows this agent is permitted to use.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-2">
              {availableSkills.map((skill) => (
                <label
                  key={skill.id}
                  className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                    agent.skills.includes(skill.id)
                      ? "border-fuchsia-500 bg-fuchsia-50/50 ring-1 ring-fuchsia-500/20"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={agent.skills.includes(skill.id)}
                    onChange={() => toggleSkill(skill.id)}
                    className="mt-1 rounded text-fuchsia-600 focus:ring-fuchsia-500 border-slate-300 w-4 h-4 transition-colors"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate">
                      {skill.name}
                    </div>
                    <div className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {skill.description}
                    </div>
                  </div>
                </label>
              ))}
              {availableSkills.length === 0 && (
                <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-sm text-slate-500 italic">
                    No skills available.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- FILE EDITOR MODAL --- */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${editingFile.usage_type === "instruction" ? "bg-fuchsia-100 text-fuchsia-600" : "bg-blue-100 text-blue-600"}`}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 leading-none">
                    {editingFile.filename}
                  </h3>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {editingFile.usage_type} File
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditingFile(null)}
                className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-6 relative">
              {isFetchingFile ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              ) : (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full p-4 font-mono text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800 resize-none"
                  placeholder="File content..."
                />
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingFile(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isFetchingFile || isSavingEdit}
                className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50"
              >
                {isSavingEdit ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
