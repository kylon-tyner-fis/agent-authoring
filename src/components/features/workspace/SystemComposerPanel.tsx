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
import {
  ChevronRight,
  ChevronDown,
  Layers,
  Bot,
  Network,
  Plus,
  MoreHorizontal,
  Trash2,
  Unlink,
  Copy,
  Edit2,
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
  const { selectedNode, setSelectedNode, refreshTree } = useWorkspace();
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
    if (collapsedNodes.has(node.id)) toggleNode(node.id);
    setActiveMenuId(null);
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
    try {
      // Mock API call - integrate your actual logic here
      console.log(`Renaming ${node.type} to: ${editValue}`);
      if (refreshTree) await refreshTree();
    } catch (error) {
      console.error("Failed to rename:", error);
      setEditValue(node.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") handleRenameSubmit();
    if (e.key === "Escape") cancelEditing();
  };

  const handleRemoveFromAgent = async () => {
    setActiveMenuId(null);

    if (node.type !== "skill" || !parentId) {
      addToast("Select a skill assigned to an agent before removing it.", "error");
      return;
    }

    if (!currentProject?.id) {
      addToast("Choose a project before updating agent assignments.", "error");
      return;
    }

    try {
      const agentResponse = await fetch(
        `/api/agents/${parentId}?projectId=${currentProject.id}`,
      );
      const agentPayload = await agentResponse.json();

      if (!agentResponse.ok) {
        throw new Error(agentPayload.error || "Failed to load parent agent");
      }

      const agent = agentPayload.agent;
      const currentSkills = Array.isArray(agent?.skills) ? agent.skills : [];
      const nextSkills = currentSkills.filter(
        (skillId: string) => skillId !== node.id,
      );

      if (nextSkills.length === currentSkills.length) {
        addToast(`${node.name} is not assigned to this agent.`, "info");
        return;
      }

      const updateResponse = await fetch(
        `/api/agents/${parentId}?projectId=${currentProject.id}`,
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
        throw new Error(updatePayload.error || "Failed to update agent");
      }

      if (selectedNode?.id === node.id && selectedNode.type === "skill") {
        setSelectedNode({ id: parentId, type: "agent" });
      }

      await refreshTree();
      addToast(`Removed ${node.name} from ${agent.name || "agent"}.`, "success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to remove skill from agent.";
      console.error("Failed to remove skill from agent:", error);
      addToast(message, "error");
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
            </span>
          )}

          {!isEditing && (
            <div
              className={`flex items-center gap-1 transition-opacity ${isMenuOpen ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"}`}
            >
              {/* Creation Buttons */}
              {node.type === "orchestrator" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    alert(`Adding Agent to ${node.name}...`);
                  }}
                  className={`flex items-center justify-center w-6 h-6 rounded-md transition-all shadow-sm ${isSelected ? "text-white/80 hover:text-white hover:bg-black/20" : "bg-white text-slate-400 border border-slate-200 hover:text-fuchsia-600 hover:bg-fuchsia-50 hover:border-fuchsia-200"}`}
                  title="Add Agent"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}

              {node.type === "agent" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    alert(`Adding Skill to ${node.name}...`);
                  }}
                  className={`flex items-center justify-center w-6 h-6 rounded-md transition-all shadow-sm ${isSelected ? "text-white/80 hover:text-white hover:bg-black/20" : "bg-white text-slate-400 border border-slate-200 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-200"}`}
                  title="Add Skill"
                >
                  <Plus className="w-3.5 h-3.5" />
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
                      <button
                        onClick={() => {
                          alert(`Duplicate ${node.name}`);
                          setActiveMenuId(null);
                        }}
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
                          onClick={() => {
                            alert(`Deleting ${node.type}...`);
                            setActiveMenuId(null);
                          }}
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
  const { systemTree } = useWorkspace();
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
            {systemTree && (
              <TreeNode node={systemTree} level={0} isLast={true} />
            )}
            <li className="relative list-none mt-2">
              <div className="pb-1 flex items-center h-8">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    alert("Creating new Orchestrator...");
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
