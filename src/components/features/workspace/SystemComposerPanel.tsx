// src/components/features/workspace/SystemComposerPanel.tsx
"use client";

import React, {
  useState,
  createContext,
  useContext,
  useEffect,
  useRef,
} from "react";
import {
  useWorkspace,
  SystemTreeNode,
  EntityType,
} from "@/src/lib/contexts/WorkspaceContext";
import { useProject } from "@/src/lib/contexts/ProjectContext";
import { useToast } from "@/src/components/layout/Toast";
import { DEFAULT_SKILL_CONFIG } from "@/src/lib/types/constants";


const DEFAULT_AGENT_CONFIG = {
  name: "New Agent",
  description: "A reasoning agent that can delegate tasks to skills.",
  system_prompt: "You are a helpful AI agent. Use the provided skills to fulfill user requests.",
  skills: [],
  sub_agents: [],
};

const DEFAULT_ORCHESTRATOR_CONFIG = {
  name: "New Orchestrator",
  description: "High-level controller for agentic workflows.",
  system_prompt: "You are an orchestrator. Route user requests to the most appropriate agent.",
  agents: [],
};

import {
  ChevronRight,
  ChevronDown,
  Layers,
  Bot,
  Network,
  Plus,
  Loader2,
  MoreHorizontal,
  Trash2,
  Unlink,
  Copy,
  Edit2,
  Lock,
  History,
  Check,
} from "lucide-react";

// --- TREE STATE MANAGEMENT ---
type TreeContextType = {
  collapsedNodes: Set<string>;
  toggleNode: (id: string) => void;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
};

const TreeContext = createContext<TreeContextType | null>(null);

const useTreeContext = () => {
  const ctx = useContext(TreeContext);
  if (!ctx) throw new Error("useTreeContext must be used within TreeProvider");
  return ctx;
};

const ENTITY_THEME = {
  orchestrator: {
    icon: "text-sky-600",
    defaultClass:
      "bg-sky-50 border-transparent hover:bg-sky-100 text-slate-700",
    selectedClass: "bg-sky-600 border-sky-700 shadow-md text-white",
    addBtn:
      "text-sky-700 border-sky-300 bg-white hover:bg-sky-50 hover:border-sky-400",
  },
  agent: {
    icon: "text-fuchsia-600",
    defaultClass:
      "bg-fuchsia-50 border-transparent hover:bg-fuchsia-100 text-slate-700",
    selectedClass: "bg-fuchsia-600 border-fuchsia-700 shadow-md text-white",
    addBtn:
      "text-fuchsia-700 border-fuchsia-300 bg-white hover:bg-fuchsia-50 hover:border-fuchsia-400",
  },
  skill: {
    icon: "text-violet-600",
    defaultClass:
      "bg-violet-50 border-transparent hover:bg-violet-100 text-slate-700",
    selectedClass: "bg-violet-600 border-violet-700 shadow-md text-white",
    addBtn:
      "text-violet-700 border-violet-300 bg-white hover:bg-violet-50 hover:border-violet-400",
  },
};

const getEntityIcon = (type: EntityType, className?: string) => {
  const baseClass = className || "w-4 h-4";
  switch (type) {
    case "orchestrator":
      return <Layers className={baseClass} />;
    case "agent":
      return <Bot className={baseClass} />;
    case "skill":
      return <Network className={baseClass} />;
    default:
      return <div className={baseClass} />;
  }
};

function TreeNode({
  node,
  level = 0,
  isLast = true,
  parentId,
}: {
  node: SystemTreeNode;
  level?: number;
  isLast?: boolean;
  parentId?: string;
}) {
  const {
    selectedNode,
    setSelectedNode,
    refreshTree,
    activeOrchestratorId,
    setActiveOrchestratorId,
  } = useWorkspace();
  const { currentProject } = useProject();
  const { addToast } = useToast();
  const { collapsedNodes, toggleNode, activeMenuId, setActiveMenuId } =
    useTreeContext();

  const menuId = `${node.type}:${node.id}:${parentId || "root"}`;
  const isExpanded = !collapsedNodes.has(node.id);
  const isMenuOpen = activeMenuId === menuId;
  const isSelected =
    selectedNode?.id === node.id && selectedNode?.type === node.type;
  const theme =
    ENTITY_THEME[node.type as keyof typeof ENTITY_THEME] ||
    ENTITY_THEME.orchestrator;

  // --- In-place Editing State ---
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // UseEffect to handle focus and selection timing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return;
    setSelectedNode({ id: node.id, type: node.type, parentId });

    if (node.type === "orchestrator") {
      setActiveOrchestratorId(node.id);
    }

    if (collapsedNodes.has(node.id)) toggleNode(node.id);
    setActiveMenuId(null);
  };

  const handleDelete = async () => {
    if (!currentProject?.id) return;
    if (!confirm(`Are you sure you want to delete this ${node.type}?`)) return;

    try {
      if (node.type === "orchestrator") {
        const res = await fetch(
          `/api/orchestrators/${node.id}?projectId=${currentProject.id}`,
          {
            method: "DELETE",
          },
        );
        if (!res.ok) throw new Error("Failed to delete orchestrator");
        addToast("Orchestrator deleted", "success");
        if (activeOrchestratorId === node.id) {
          // If we deleted the active one, we should probably reset it
          // refreshTree will pick a new one if available
        }
      } else if (node.type === "agent") {
        // 1. Unlink from parent orchestrator if parentId is provided
        if (parentId) {
          const orchRes = await fetch(
            `/api/orchestrators/${parentId}?projectId=${currentProject.id}`,
          );
          const orchData = await orchRes.json();
          const updatedAgents = (orchData.orchestrator.agents || []).filter(
            (id: string) => id !== node.id,
          );

          await fetch(
            `/api/orchestrators/${parentId}?projectId=${currentProject.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...orchData.orchestrator,
                agents: updatedAgents,
              }),
            },
          );
        }

        // 2. Delete the agent record
        const res = await fetch(
          `/api/agents/${node.id}?projectId=${currentProject.id}`,
          {
            method: "DELETE",
          },
        );
        if (!res.ok) throw new Error("Failed to delete agent");
        addToast("Agent deleted", "success");
      }

      if (refreshTree) await refreshTree();
      setActiveMenuId(null);
    } catch (error) {
      console.error("Delete failed:", error);
      addToast(`Failed to delete ${node.type}`, "error");
    }
  };

  const handleRemoveFromAgent = async () => {
    if (!currentProject?.id || !parentId) return;
    setActiveMenuId(null);

    try {
      // In our tree, parentId of a skill is the agent id
      const agentRes = await fetch(
        `/api/agents/${parentId}?projectId=${currentProject.id}`,
      );
      const agentData = await agentRes.json();
      if (!agentRes.ok) throw new Error(agentData.error || "Failed to load agent");

      const agent = agentData.agent;
      const currentSkills = Array.isArray(agent?.skills) ? agent.skills : [];
      const updatedSkills = currentSkills.filter(
        (id: string) => id !== node.id,
      );

      if (updatedSkills.length === currentSkills.length) {
        addToast(`${node.name} is not assigned to this agent.`, "info");
        return;
      }

      await fetch(`/api/agents/${parentId}?projectId=${currentProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...agent, skills: updatedSkills }),
      });

      addToast("Skill removed from agent", "success");
      if (refreshTree) await refreshTree();
    } catch (error) {
      console.error("Remove failed:", error);
      addToast("Failed to remove skill", "error");
    }
  };

  const startEditing = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setActiveMenuId(null);
    setEditValue(node.name);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditValue(node.name);
  };

  const handleRenameSubmit = async () => {
    if (editValue.trim() === "" || editValue === node.name) {
      cancelEditing();
      return;
    }
    setIsEditing(false);
    if (!currentProject?.id) return;

    try {
      let endpoint = "";
      let body = {};

      if (node.type === "orchestrator") {
        endpoint = `/api/orchestrators/${node.id}?projectId=${currentProject.id}`;
        // We need to fetch the current orchestrator first to avoid overwriting other fields
        // or just send the name if the API supports partial updates.
        // Looking at the API, it expects the full body.
        const res = await fetch(endpoint);
        const data = await res.json();
        body = { ...data.orchestrator, name: editValue };
      } else if (node.type === "agent") {
        endpoint = `/api/agents/${node.id}?projectId=${currentProject.id}`;
        const res = await fetch(endpoint);
        const data = await res.json();
        body = { ...data.agent, name: editValue };
      } else if (node.type === "skill") {
        endpoint = `/api/skills/${node.id}?projectId=${currentProject.id}`;
        const res = await fetch(endpoint);
        const data = await res.json();
        body = { ...data.skill, name: editValue };
      }

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to rename");

      if (refreshTree) await refreshTree();
      addToast(`Renamed to ${editValue}`, "success");
    } catch (error) {
      console.error("Failed to rename:", error);
      setEditValue(node.name);
      addToast("Failed to rename", "error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") handleRenameSubmit();
    if (e.key === "Escape") cancelEditing();
  };

  const getNewSkillName = () => {
    const existingSkillNames = (node.children || [])
      .filter((child) => child.type === "skill")
      .map((child) => child.name);

    if (!existingSkillNames.includes("New Skill")) {
      return "New Skill";
    }

    let suffix = 2;
    while (existingSkillNames.includes(`New Skill ${suffix}`)) {
      suffix += 1;
    }

    return `New Skill ${suffix}`;
  };

  const handleAddSkill = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setActiveMenuId(null);

    if (node.type !== "agent") {
      addToast("Select an agent before adding a skill.", "error");
      return;
    }

    if (!currentProject?.id) {
      addToast("Choose a project before creating a skill.", "error");
      return;
    }

    setIsAddingSkill(true);
    let createdSkillId: string | null = null;

    try {
      const agentResponse = await fetch(
        `/api/agents/${node.id}?projectId=${currentProject.id}`,
      );
      const agentPayload = await agentResponse.json();

      if (!agentResponse.ok) {
        throw new Error(agentPayload.error || "Failed to load agent");
      }

      const agent = agentPayload.agent;
      const skillId = crypto.randomUUID();
      createdSkillId = skillId;
      const skillName = getNewSkillName();

      const createResponse = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...DEFAULT_SKILL_CONFIG,
          id: skillId,
          project_id: currentProject.id,
          name: skillName,
          description: `Deterministic workflow for ${agent.name || node.name}.`,
          system_prompt:
            "Define this skill as a deterministic, state-aware workflow.",
          orchestration: {
            nodes: [],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          },
        }),
      });
      const createPayload = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(createPayload.error || "Failed to create skill");
      }

      const currentSkills = Array.isArray(agent?.skills) ? agent.skills : [];
      const nextSkills = Array.from(new Set([...currentSkills, skillId]));

      const updateResponse = await fetch(
        `/api/agents/${node.id}?projectId=${currentProject.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: agent.name || "",
            description: agent.description || "",
            system_prompt: agent.system_prompt || "",
            skills: nextSkills,
            sub_agents: agent.sub_agents || [],
          }),
        },
      );
      const updatePayload = await updateResponse.json();

      if (!updateResponse.ok) {
        throw new Error(updatePayload.error || "Failed to assign skill to agent");
      }

      if (collapsedNodes.has(node.id)) toggleNode(node.id);
      await refreshTree();
      setSelectedNode({ id: skillId, type: "skill", parentId: node.id });
      addToast(`Created ${skillName} under ${agent.name || node.name}.`, "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add skill.";
      console.error("Failed to add skill:", error);

      if (createdSkillId && currentProject?.id) {
        await fetch(`/api/skills/${createdSkillId}?projectId=${currentProject.id}`, {
          method: "DELETE",
        });
      }

      addToast(message, "error");
    } finally {
      setIsAddingSkill(false);
    }
  };

  const handleAddAgent = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setActiveMenuId(null);

    if (node.type !== "orchestrator") {
      addToast("Select an orchestrator before adding an agent.", "error");
      return;
    }

    if (!currentProject?.id) {
      addToast("Choose a project before creating an agent.", "error");
      return;
    }

    try {
      const agentId = crypto.randomUUID();
      const agentName = "New Agent";

      // 1. Create the agent
      const createResponse = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...DEFAULT_AGENT_CONFIG,
          id: agentId,
          project_id: currentProject.id,
          name: agentName,
        }),
      });

      if (!createResponse.ok) {
        const err = await createResponse.json();
        throw new Error(err.error || "Failed to create agent");
      }

      // 2. Fetch current orchestrator to get its agents list
      const orchResponse = await fetch(
        `/api/orchestrators/${node.id}?projectId=${currentProject.id}`,
      );
      if (!orchResponse.ok) throw new Error("Failed to load orchestrator");
      const orchData = await orchResponse.json();
      const orchestrator = orchData.orchestrator;

      // 3. Update orchestrator with the new agent
      const currentAgents = Array.isArray(orchestrator.agents)
        ? orchestrator.agents
        : [];
      const nextAgents = [...currentAgents, agentId];

      const updateResponse = await fetch(
        `/api/orchestrators/${node.id}?projectId=${currentProject.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...orchestrator,
            agents: nextAgents,
          }),
        },
      );

      if (!updateResponse.ok) throw new Error("Failed to link agent to orchestrator");

      if (collapsedNodes.has(node.id)) toggleNode(node.id);
      await refreshTree();
      setSelectedNode({ id: agentId, type: "agent", parentId: node.id });
      addToast(`Created ${agentName} under ${node.name}.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add agent.";
      console.error("Failed to add agent:", error);
      addToast(message, "error");
    }
  };

  const handleDuplicate = async () => {
    setActiveMenuId(null);
    if (!currentProject?.id) return;

    try {
      let endpoint = "";
      let createEndpoint = "";
      let newEntity: any = {};
      const newId = crypto.randomUUID();

      if (node.type === "orchestrator") {
        endpoint = `/api/orchestrators/${node.id}?projectId=${currentProject.id}`;
        createEndpoint = "/api/orchestrators";
        const res = await fetch(endpoint);
        const data = await res.json();
        newEntity = {
          ...data.orchestrator,
          id: newId,
          name: `${data.orchestrator.name} (Copy)`,
        };
      } else if (node.type === "agent") {
        endpoint = `/api/agents/${node.id}?projectId=${currentProject.id}`;
        createEndpoint = "/api/agents";
        const res = await fetch(endpoint);
        const data = await res.json();
        newEntity = {
          ...data.agent,
          id: newId,
          name: `${data.agent.name} (Copy)`,
        };
      } else if (node.type === "skill") {
        endpoint = `/api/skills/${node.id}?projectId=${currentProject.id}`;
        createEndpoint = "/api/skills";
        const res = await fetch(endpoint);
        const data = await res.json();
        newEntity = {
          ...data.skill,
          id: newId,
          name: `${data.skill.name} (Copy)`,
          status: "draft", // Always duplicate as draft
        };
        // Remove DB specific fields if any
        delete newEntity.created_at;
        delete newEntity.updated_at;
      }

      // 1. Create the new entity
      const createRes = await fetch(createEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntity),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || `Failed to duplicate ${node.type}`);
      }

      // 2. If it's an agent or skill, link it to the parent
      if (parentId) {
        if (node.type === "agent") {
          // Parent is an Orchestrator
          const orchRes = await fetch(
            `/api/orchestrators/${parentId}?projectId=${currentProject.id}`,
          );
          const orchData = await orchRes.json();
          const orchestrator = orchData.orchestrator;
          const nextAgents = [...(orchestrator.agents || []), newId];
          await fetch(`/api/orchestrators/${parentId}?projectId=${currentProject.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...orchestrator, agents: nextAgents }),
          });
        } else if (node.type === "skill") {
          // Parent is an Agent
          const agentRes = await fetch(
            `/api/agents/${parentId}?projectId=${currentProject.id}`,
          );
          const agentData = await agentRes.json();
          const agent = agentData.agent;
          const nextSkills = [...(agent.skills || []), newId];
          await fetch(`/api/agents/${parentId}?projectId=${currentProject.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...agent, skills: nextSkills }),
          });
        }
      }

      await refreshTree();
      setSelectedNode({ id: newId, type: node.type, parentId });
      addToast(`Duplicated ${node.name}`, "success");
    } catch (error) {
      console.error("Failed to duplicate:", error);
      addToast("Failed to duplicate", "error");
    }
  };

  const visibleChildren = (node.children || []).filter((child) =>
    ["orchestrator", "agent", "skill"].includes(child.type),
  );

  return (
    <li className="relative group/node list-none">
      {level > 0 && (
        <>
          <div
            className={`absolute left-0 top-0 w-px bg-slate-300 ${isLast ? "h-[16px]" : "h-full"}`}
          />
          <div className="absolute left-0 top-[16px] w-[14px] h-px bg-slate-300" />
        </>
      )}

      <div className={`${level > 0 ? "pl-5" : ""} pb-1`}>
        <div
          onClick={handleSelect}
          onDoubleClick={startEditing}
          className={`group/row relative flex items-center h-8 px-1.5 rounded-md cursor-pointer select-none transition-all border
            ${isSelected && !isEditing ? theme.selectedClass : theme.defaultClass}
            ${isEditing ? "bg-white border-sky-300 shadow-sm ring-2 ring-sky-100" : ""}
          `}
        >
          {visibleChildren.length > 0 ? (
            <div
              className={`w-5 h-5 flex items-center justify-center mr-0.5 rounded cursor-pointer shrink-0 transition-colors
                ${isSelected && !isEditing ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-slate-600"}
                ${isEditing ? "opacity-50 pointer-events-none" : ""}
              `}
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          ) : (
            <div className="w-5 h-5 mr-0.5 shrink-0" />
          )}

          <div
            className={`mr-2 flex-shrink-0 ${isSelected && !isEditing ? "text-white" : theme.icon}`}
          >
            {getEntityIcon(node.type)}
          </div>

          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-slate-800 border-none outline-none p-0 m-0 focus:ring-0"
              spellCheck={false}
            />
          ) : (
            <span
              className={`truncate flex-1 text-sm ${isSelected ? "font-semibold text-white" : "font-medium"}`}
            >
              {node.name}
              {node.type === "skill" && node.data?.version && (
                <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-md font-mono border ${isSelected
                  ? "bg-white/20 border-white/30 text-white"
                  : node.data?.status === "published"
                    ? "bg-slate-100 border-slate-200 text-slate-500"
                    : "bg-violet-100 border-violet-200 text-violet-600"
                  }`}>
                  v{node.data.version}
                </span>
              )}
            </span>
          )}

          {node.type === "skill" && node.data?.status === "published" && (
            <Lock className={`w-3 h-3 mr-2 ${isSelected ? "text-white/60" : "text-slate-400"}`} />
          )}

          {!isEditing && (
            <div
              className={`flex items-center gap-1 transition-opacity ${isMenuOpen ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"}`}
            >
              {/* Creation Buttons */}
              {node.type === "orchestrator" && (
                <button
                  onClick={handleAddAgent}
                  className={`flex items-center justify-center w-6 h-6 rounded-md transition-all shadow-sm ${isSelected ? "text-white/80 hover:text-white hover:bg-black/20" : "bg-white text-slate-400 border border-slate-200 hover:text-fuchsia-600 hover:bg-fuchsia-50 hover:border-fuchsia-200"}`}
                  title="Add Agent"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}


              {node.type === "agent" && (
                <button
                  onClick={handleAddSkill}
                  disabled={isAddingSkill}
                  className={`flex items-center justify-center w-6 h-6 rounded-md transition-all shadow-sm disabled:cursor-wait disabled:opacity-70 ${isSelected ? "text-white/80 hover:text-white hover:bg-black/20" : "bg-white text-slate-400 border border-slate-200 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-200"}`}
                  title="Add Skill"
                >
                  {isAddingSkill ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              {/* Context Menu Button */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(isMenuOpen ? null : menuId);
                  }}
                  className={`flex items-center justify-center w-6 h-6 rounded-md transition-all shadow-sm ${isSelected ? (isMenuOpen ? "bg-black/30 text-white" : "text-white/80 hover:text-white hover:bg-black/20") : isMenuOpen ? "bg-slate-200 text-slate-800 border border-slate-300" : "bg-white text-slate-400 border border-slate-200 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-300"}`}
                  title="More Actions"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>

                {isMenuOpen && (
                  <div
                    className="context-menu-container absolute right-0 top-full mt-1.5 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-[100] animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/80">
                      <div className="font-semibold text-slate-800 text-sm break-words leading-tight">
                        {node.name}
                      </div>
                      <div className="text-slate-500 capitalize text-[10px] mt-0.5 flex items-center gap-1.5 font-medium">
                        <span
                          className={`w-2 h-2 rounded-full inline-block ${theme.icon.replace("text-", "bg-")}`}
                        ></span>
                        {node.type}
                      </div>
                    </div>

                    <div className="p-1">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startEditing();
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md flex items-center gap-2 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Rename
                      </button>

                      {node.type === "skill" && node.data?.allVersions?.length > 1 && (
                        <div className="relative group/submenu">
                          <button
                            className="w-full text-left px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <History className="w-3.5 h-3.5" /> Switch Version
                            </div>
                            <ChevronRight className="w-3 h-3" />
                          </button>

                          <div className="absolute left-full top-0 ml-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 hidden group-hover/submenu:block animate-in fade-in slide-in-from-left-2 duration-150 p-1">
                            <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 mb-1">
                              Available Versions
                            </div>
                            {node.data.allVersions.map((v: any) => (
                              <button
                                key={v.id}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (v.id === node.id) return;

                                  // TRIGGER SWITCH
                                  if (!parentId || !currentProject?.id) return;
                                  try {
                                    const agentRes = await fetch(`/api/agents/${parentId}?projectId=${currentProject.id}`);
                                    const agentData = await agentRes.json();
                                    if (!agentRes.ok) throw new Error("Failed to load agent");

                                    const agent = agentData.agent;
                                    const nextSkills = (agent.skills || []).map((sid: string) =>
                                      sid === node.id ? v.id : sid
                                    );

                                    const updateRes = await fetch(`/api/agents/${parentId}?projectId=${currentProject.id}`, {
                                      method: "PUT",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ ...agent, skills: nextSkills })
                                    });

                                    if (!updateRes.ok) throw new Error("Failed to update agent skill version");

                                    addToast(`Switched ${node.name} to v${v.version}`, "success");
                                    await refreshTree();
                                    setSelectedNode({ id: v.id, type: "skill", parentId });
                                    setActiveMenuId(null);
                                  } catch (err: any) {
                                    addToast(err.message, "error");
                                  }
                                }}
                                className={`w-full text-left px-2 py-1.5 text-xs rounded-md flex items-center justify-between transition-colors ${v.id === node.id
                                  ? "bg-violet-50 text-violet-700 font-semibold"
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                  }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span>v{v.version}</span>
                                  <span className={`text-[9px] uppercase px-1 rounded ${v.status === "published" ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-600"
                                    }`}>
                                    {v.status}
                                  </span>
                                </div>
                                {v.id === node.id && <Check className="w-3 h-3" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleDuplicate}
                        className="w-full text-left px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md flex items-center gap-2 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" /> Duplicate
                      </button>

                      <div className="h-px bg-slate-100 my-1 mx-1"></div>
                      {node.type === "skill" ? (
                        <button
                          onClick={handleRemoveFromAgent}
                          className="w-full text-left px-2 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 hover:text-amber-800 rounded-md flex items-center gap-2 transition-colors"
                        >
                          <Unlink className="w-3.5 h-3.5" /> Remove from Agent
                        </button>
                      ) : (
                        <button
                          onClick={handleDelete}
                          className="w-full text-left px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete {node.type}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {isExpanded && visibleChildren.length > 0 && (
          <ul className="relative mt-1 ml-3.5">
            {visibleChildren.map((child, index) => {
              const isLastChild = index === visibleChildren.length - 1;
              return (
                <TreeNode
                  key={child.id}
                  node={child}
                  level={level + 1}
                  isLast={isLastChild}
                  parentId={node.id}
                />
              );
            })}
          </ul>
        )}
      </div>
    </li>
  );
}

export function SystemComposerPanel() {
  const {
    projectTree,
    refreshTree,
    setActiveOrchestratorId,
    setSelectedNode,
  } = useWorkspace();
  const { currentProject } = useProject();
  const { addToast } = useToast();
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const toggleNode = (id: string) => {

    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateOrchestrator = async () => {
    if (!currentProject?.id) {
      addToast("Select a project first.", "error");
      return;
    }

    try {
      const newId = crypto.randomUUID();
      const response = await fetch("/api/orchestrators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...DEFAULT_ORCHESTRATOR_CONFIG,
          id: newId,
          project_id: currentProject.id,
        }),
      });

      if (!response.ok) throw new Error("Failed to create orchestrator");

      addToast("Created new orchestrator", "success");
      setActiveOrchestratorId(newId);
      setSelectedNode({ id: newId, type: "orchestrator" });
      if (refreshTree) await refreshTree();
    } catch (error) {
      console.error("Failed to create orchestrator:", error);
      addToast("Failed to create orchestrator", "error");
    }
  };

  // Global click listener to close menu when clicking outside
  useEffect(() => {
    if (!activeMenuId) return;
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".context-menu-container")) {
        setActiveMenuId(null);
      }
    };
    window.addEventListener("mousedown", handleGlobalClick);
    return () => window.removeEventListener("mousedown", handleGlobalClick);
  }, [activeMenuId]);

  return (
    <TreeContext.Provider
      value={{ collapsedNodes, toggleNode, activeMenuId, setActiveMenuId }}
    >
      <div className="h-full flex flex-col pt-4 bg-white relative z-10">
        <div className="px-4 mb-4 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            System Hierarchy
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-8">
          <ul className="m-0 p-0">
            {projectTree?.children?.map((orch, index) => (
              <TreeNode
                key={orch.id}
                node={orch}
                level={0}
                isLast={index === projectTree.children!.length - 1}
              />
            ))}
            <li className="relative list-none mt-2">
              <div className="pb-1 flex items-center h-8">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateOrchestrator();
                  }}
                  className={`flex items-center h-8 px-3 rounded-md text-xs font-semibold border border-dashed shadow-sm transition-all ${ENTITY_THEME.orchestrator.addBtn} hover:scale-[1.02] active:scale-[0.98]`}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Orchestrator
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </TreeContext.Provider>
  );
}
