// src/components/features/workspace/SystemComposerPanel.tsx
"use client";

import React, {
  useState,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  useWorkspace,
  SystemTreeNode,
  EntityType,
} from "@/src/lib/contexts/WorkspaceContext";
import { useProject } from "@/src/lib/contexts/ProjectContext";
import { useToast } from "@/src/components/layout/Toast";
import { DEFAULT_SKILL_CONFIG } from "@/src/lib/types/constants";
import {
  WORKSPACE_ENTITY_DASHED_ADD_BUTTON_CLASS,
  WORKSPACE_ENTITY_DOT_CLASS,
  WORKSPACE_ENTITY_INLINE_ACTION_CLASS,
  WORKSPACE_ENTITY_INLINE_ACTION_SELECTED_CLASS,
  WORKSPACE_ENTITY_THEME,
  WORKSPACE_ENTITY_TREE_EDITING_CLASS,
  WORKSPACE_ENTITY_TREE_SELECTED_CLASS,
  WORKSPACE_ENTITY_TREE_SURFACE_CLASS,
  WORKSPACE_PANEL_CONTROL_CLASS,
  WORKSPACE_PANEL_CONTROL_SHELL_CLASS,
  WORKSPACE_PANEL_THEME,
  WorkspaceEntityThemeKey,
} from "./workspaceEntityTheme";

const DEFAULT_AGENT_CONFIG = {
  name: "New Agent",
  description: "A reasoning agent that can delegate tasks to skills.",
  system_prompt:
    "You are a helpful AI agent. Use the provided skills to fulfill user requests.",
  skills: [],
  sub_agents: [],
};

const DEFAULT_ORCHESTRATOR_CONFIG = {
  name: "New Orchestrator",
  description: "High-level controller for agentic workflows.",
  system_prompt:
    "You are an orchestrator. Route user requests to the most appropriate agent.",
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
  History,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
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

type SkillVersionSummary = {
  id: string;
  version: string;
  status: string;
  updated_at?: string;
};

type SkillListVersion = {
  id: string;
  name: string;
  version: string;
  description?: string;
  status?: "draft" | "published" | "archived";
};

type SkillFamily = {
  id: string;
  name: string;
  description?: string;
  status?: "draft" | "published" | "archived";
  versions?: SkillListVersion[];
};

const TREE_CONNECTOR_HORIZONTAL_CLASS = "w-1.5";
const TREE_NODE_INDENT_CLASS = "pl-2";
const TREE_CHILDREN_OFFSET_CLASS = "ml-3";
const CONTEXT_MENU_WIDTH = 224;
const CONTEXT_SUBMENU_WIDTH = 192;
const CONTEXT_MENU_VIEWPORT_PADDING = 12;
const CONTEXT_MENU_OFFSET = 6;

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
  const isSkill = node.type === "skill";
  const theme =
    WORKSPACE_ENTITY_THEME[node.type as WorkspaceEntityThemeKey] ||
    WORKSPACE_ENTITY_THEME.orchestrator;
  const isDraftSkill = isSkill && node.data?.status !== "published";
  const skillVersionLabel = isSkill ? `v${node.data?.version || "1.0"}` : null;

  // --- In-place Editing State ---
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [isAddSkillMenuOpen, setIsAddSkillMenuOpen] = useState(false);
  const [addSkillMenuRect, setAddSkillMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [availableSkillFamilies, setAvailableSkillFamilies] = useState<
    SkillFamily[]
  >([]);
  const [isLoadingSkillFamilies, setIsLoadingSkillFamilies] = useState(false);
  const [isAttachingExistingSkill, setIsAttachingExistingSkill] =
    useState(false);
  const [selectedSkillFamilyId, setSelectedSkillFamilyId] = useState("");
  const [selectedSkillVersionId, setSelectedSkillVersionId] = useState("");
  const [editValue, setEditValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const addSkillButtonRef = useRef<HTMLButtonElement>(null);
  const addSkillMenuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const skillVersionChipClass = isSkill
    ? isDraftSkill
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-[var(--entity-border)] bg-[var(--entity-50)] text-[var(--entity-700)]"
    : "";
  const entityIconClass =
    isSelected && !isEditing
      ? "border border-[var(--entity-border)] bg-[var(--entity-50)] text-[var(--entity-700)]"
      : "border border-[var(--entity-border-subtle)] bg-[var(--entity-50)] text-[var(--entity-600)]";

  useEffect(() => {
    if (!isMenuOpen) {
      setMenuRect(null);
      return;
    }

    const updateMenuRect = () => {
      const triggerRect = menuTriggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;
      const availableBelow =
        window.innerHeight -
        triggerRect.bottom -
        CONTEXT_MENU_OFFSET -
        CONTEXT_MENU_VIEWPORT_PADDING;
      const availableAbove =
        triggerRect.top -
        CONTEXT_MENU_OFFSET -
        CONTEXT_MENU_VIEWPORT_PADDING;
      const shouldOpenUpward =
        availableBelow < 220 && availableAbove > availableBelow;
      const maxHeight = Math.max(
        120,
        shouldOpenUpward ? availableAbove : availableBelow,
      );

      const left = Math.min(
        Math.max(
          triggerRect.right - CONTEXT_MENU_WIDTH,
          CONTEXT_MENU_VIEWPORT_PADDING,
        ),
        window.innerWidth -
          CONTEXT_MENU_WIDTH -
          CONTEXT_MENU_VIEWPORT_PADDING,
      );

      const top = shouldOpenUpward
        ? Math.max(
            CONTEXT_MENU_VIEWPORT_PADDING,
            triggerRect.top - CONTEXT_MENU_OFFSET - maxHeight,
          )
        : Math.min(
            triggerRect.bottom + CONTEXT_MENU_OFFSET,
            window.innerHeight -
              CONTEXT_MENU_VIEWPORT_PADDING -
              maxHeight,
          );

      setMenuRect({
        top,
        left,
        maxHeight,
      });
    };

    updateMenuRect();
    window.addEventListener("resize", updateMenuRect);
    window.addEventListener("scroll", updateMenuRect, true);

    return () => {
      window.removeEventListener("resize", updateMenuRect);
      window.removeEventListener("scroll", updateMenuRect, true);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isAddSkillMenuOpen) {
      setAddSkillMenuRect(null);
      return;
    }

    const updateAddSkillMenuRect = () => {
      const triggerRect = addSkillButtonRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const width = 320;
      const availableBelow =
        window.innerHeight -
        triggerRect.bottom -
        CONTEXT_MENU_OFFSET -
        CONTEXT_MENU_VIEWPORT_PADDING;
      const availableAbove =
        triggerRect.top -
        CONTEXT_MENU_OFFSET -
        CONTEXT_MENU_VIEWPORT_PADDING;
      const shouldOpenUpward =
        availableBelow < 280 && availableAbove > availableBelow;
      const left = Math.min(
        Math.max(
          triggerRect.left,
          CONTEXT_MENU_VIEWPORT_PADDING,
        ),
        window.innerWidth - width - CONTEXT_MENU_VIEWPORT_PADDING,
      );
      const top = shouldOpenUpward
        ? Math.max(
            CONTEXT_MENU_VIEWPORT_PADDING,
            triggerRect.top - CONTEXT_MENU_OFFSET - 300,
          )
        : Math.min(
            triggerRect.bottom + CONTEXT_MENU_OFFSET,
            window.innerHeight - CONTEXT_MENU_VIEWPORT_PADDING - 300,
          );

      setAddSkillMenuRect({
        top,
        left,
        width,
      });
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isButtonClick = addSkillButtonRef.current?.contains(target);
      const isMenuClick = addSkillMenuRef.current?.contains(target);

      if (!isButtonClick && !isMenuClick) {
        setIsAddSkillMenuOpen(false);
      }
    };

    updateAddSkillMenuRect();
    window.addEventListener("resize", updateAddSkillMenuRect);
    window.addEventListener("scroll", updateAddSkillMenuRect, true);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("resize", updateAddSkillMenuRect);
      window.removeEventListener("scroll", updateAddSkillMenuRect, true);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAddSkillMenuOpen]);

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

  const getSkillFamilyIds = (family: SkillFamily) => [
    family.id,
    ...((family.versions || []).map((version) => version.id) || []),
  ];

  const assignedSkillIds = useMemo(
    () => (Array.isArray(node.data?.skills) ? node.data.skills : []),
    [node.data?.skills],
  );
  const attachableSkillFamilies = useMemo(
    () =>
      availableSkillFamilies.filter((family) => {
        const familyIds = getSkillFamilyIds(family);
        return !familyIds.some((id) => assignedSkillIds.includes(id));
      }),
    [availableSkillFamilies, assignedSkillIds],
  );

  const selectedSkillFamily = useMemo(
    () =>
      attachableSkillFamilies.find((family) => family.id === selectedSkillFamilyId),
    [attachableSkillFamilies, selectedSkillFamilyId],
  );
  const selectedSkillVersionOptions = useMemo(
    () =>
      selectedSkillFamily
        ? [
            {
              id: selectedSkillFamily.id,
              label: "Draft (Latest)",
              badge: "DRAFT",
            },
            ...(selectedSkillFamily.versions || []).map((version) => ({
              id: version.id,
              label: `v${version.version}`,
              badge:
                version.status === "published"
                  ? "LIVE"
                  : version.status?.toUpperCase() || "",
            })),
          ]
        : [],
    [selectedSkillFamily],
  );

  useEffect(() => {
    if (!isAddSkillMenuOpen || node.type !== "agent" || !currentProject?.id) {
      return;
    }

    let isCancelled = false;

    const loadSkillFamilies = async () => {
      setIsLoadingSkillFamilies(true);

      try {
        const response = await fetch(`/api/skills?projectId=${currentProject.id}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load skills");
        }

        if (isCancelled) return;

        const fetchedFamilies = (payload.skills || []) as SkillFamily[];
        setAvailableSkillFamilies(fetchedFamilies);

        const nextAttachableFamilies = fetchedFamilies.filter((family) => {
          const familyIds = getSkillFamilyIds(family);
          return !familyIds.some((id) => assignedSkillIds.includes(id));
        });
        const initialFamily = nextAttachableFamilies[0];

        setSelectedSkillFamilyId(initialFamily?.id || "");
        setSelectedSkillVersionId(initialFamily?.id || "");
      } catch (error) {
        if (!isCancelled) {
          addToast(
            error instanceof Error ? error.message : "Failed to load skills",
            "error",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSkillFamilies(false);
        }
      }
    };

    loadSkillFamilies();

    return () => {
      isCancelled = true;
    };
  }, [isAddSkillMenuOpen, node.type, currentProject?.id, assignedSkillIds, addToast]);

  useEffect(() => {
    if (!selectedSkillFamily) {
      setSelectedSkillVersionId("");
      return;
    }

    const selectedVersionStillExists = selectedSkillVersionOptions.some(
      (option) => option.id === selectedSkillVersionId,
    );

    if (!selectedVersionStillExists) {
      setSelectedSkillVersionId(selectedSkillFamily.id);
    }
  }, [selectedSkillFamily, selectedSkillVersionId, selectedSkillVersionOptions]);

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
      if (!agentRes.ok)
        throw new Error(agentData.error || "Failed to load agent");

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

  const updateAgentSkills = async (
    agentId: string,
    updater: (currentSkills: string[]) => string[],
  ) => {
    const agentResponse = await fetch(
      `/api/agents/${agentId}?projectId=${currentProject.id}`,
    );
    const agentPayload = await agentResponse.json();

    if (!agentResponse.ok) {
      throw new Error(agentPayload.error || "Failed to load agent");
    }

    const agent = agentPayload.agent;
    const currentSkills = Array.isArray(agent?.skills) ? agent.skills : [];
    const nextSkills = updater(currentSkills);

    const updateResponse = await fetch(
      `/api/agents/${agentId}?projectId=${currentProject.id}`,
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

    return { agent, nextSkills };
  };

  const handleCreateSkillForAgent = async () => {
    if (node.type !== "agent") {
      addToast("Select an agent before adding a skill.", "error");
      return;
    }

    if (!currentProject?.id) {
      addToast("Choose a project before creating a skill.", "error");
      return;
    }

    setIsAddingSkill(true);
    setIsAddSkillMenuOpen(false);
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

      await updateAgentSkills(node.id, (currentSkills) =>
        Array.from(new Set([...currentSkills, skillId])),
      );

      if (collapsedNodes.has(node.id)) toggleNode(node.id);
      await refreshTree();
      setSelectedNode({ id: skillId, type: "skill", parentId: node.id });
      addToast(
        `Created ${skillName} under ${agent.name || node.name}.`,
        "success",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add skill.";
      console.error("Failed to add skill:", error);

      if (createdSkillId && currentProject?.id) {
        await fetch(
          `/api/skills/${createdSkillId}?projectId=${currentProject.id}`,
          {
            method: "DELETE",
          },
        );
      }

      addToast(message, "error");
    } finally {
      setIsAddingSkill(false);
    }
  };

  const handleAttachExistingSkill = async () => {
    if (node.type !== "agent") {
      addToast("Select an agent before attaching a skill.", "error");
      return;
    }

    if (!currentProject?.id || !selectedSkillFamily || !selectedSkillVersionId) {
      addToast("Choose a skill and version to attach.", "error");
      return;
    }

    setIsAttachingExistingSkill(true);

    try {
      const familyIds = getSkillFamilyIds(selectedSkillFamily);
      await updateAgentSkills(node.id, (currentSkills) => {
        const assignedFamilyId = familyIds.find((id) => currentSkills.includes(id));

        if (assignedFamilyId) {
          return currentSkills.map((id) =>
            id === assignedFamilyId ? selectedSkillVersionId : id,
          );
        }

        return Array.from(new Set([...currentSkills, selectedSkillVersionId]));
      });

      if (collapsedNodes.has(node.id)) toggleNode(node.id);
      await refreshTree();
      setSelectedNode({
        id: selectedSkillVersionId,
        type: "skill",
        parentId: node.id,
      });
      setIsAddSkillMenuOpen(false);
      addToast(`Attached ${selectedSkillFamily.name}`, "success");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Failed to attach skill",
        "error",
      );
    } finally {
      setIsAttachingExistingSkill(false);
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

      if (!updateResponse.ok)
        throw new Error("Failed to link agent to orchestrator");

      if (collapsedNodes.has(node.id)) toggleNode(node.id);
      await refreshTree();
      setSelectedNode({ id: agentId, type: "agent", parentId: node.id });
      addToast(`Created ${agentName} under ${node.name}.`, "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add agent.";
      console.error("Failed to add agent:", error);
      addToast(message, "error");
    }
  };

  const handleDuplicate = async () => {
    setActiveMenuId(null);
    if (!currentProject?.id) return;

    const createdSkillIds: string[] = [];
    let createdPrimaryEntityId: string | null = null;

    const duplicateSkillRecord = async ({
      skillId,
      nameOverride,
    }: {
      skillId: string;
      nameOverride?: string;
    }) => {
      const sourceRes = await fetch(
        `/api/skills/${skillId}?projectId=${currentProject.id}`,
      );
      const sourceData = await sourceRes.json();

      if (!sourceRes.ok) {
        throw new Error(sourceData.error || "Failed to load skill");
      }

      const sourceSkill = { ...(sourceData.skill || {}) };
      delete sourceSkill.id;
      delete sourceSkill.created_at;
      delete sourceSkill.updated_at;

      const duplicatedSkillId = crypto.randomUUID();
      const duplicatedSkillPayload = {
        ...sourceSkill,
        id: duplicatedSkillId,
        project_id: currentProject.id,
        parent_id: null,
        version: "1",
        status: "draft",
        name:
          nameOverride ||
          sourceData.skill?.name ||
          sourceSkill.name ||
          "Untitled Skill",
      };

      const createRes = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(duplicatedSkillPayload),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(createData.error || "Failed to duplicate skill");
      }

      const persistedSkillId = createData.skill?.id || duplicatedSkillId;
      createdSkillIds.push(persistedSkillId);
      return persistedSkillId;
    };

    try {
      let endpoint = "";
      let createEndpoint = "";
      let newEntity: Record<string, unknown> = {};
      let createdEntityId = "";
      const newId = crypto.randomUUID();

      if (node.type === "orchestrator") {
        endpoint = `/api/orchestrators/${node.id}?projectId=${currentProject.id}`;
        createEndpoint = "/api/orchestrators";
        const res = await fetch(endpoint);
        const data = await res.json();
        const orchestratorData = { ...(data.orchestrator || {}) };
        delete orchestratorData.id;
        delete orchestratorData.created_at;
        delete orchestratorData.updated_at;
        newEntity = {
          ...orchestratorData,
          id: newId,
          project_id: currentProject.id,
          name: `${data.orchestrator.name} (Copy)`,
          agents: Array.isArray(orchestratorData.agents)
            ? [...orchestratorData.agents]
            : [],
        };
      } else if (node.type === "agent") {
        endpoint = `/api/agents/${node.id}?projectId=${currentProject.id}`;
        createEndpoint = "/api/agents";
        const res = await fetch(endpoint);
        const data = await res.json();
        const agentData = { ...(data.agent || {}) };
        delete agentData.id;
        delete agentData.created_at;
        delete agentData.updated_at;
        const visibleAssignedSkillIds = (node.children || [])
          .filter((child) => child.type === "skill")
          .map((child) => child.id);
        newEntity = {
          ...agentData,
          id: newId,
          project_id: currentProject.id,
          name: `${data.agent.name} (Copy)`,
          skills: visibleAssignedSkillIds,
          sub_agents: Array.isArray(agentData.sub_agents)
            ? [...agentData.sub_agents]
            : [],
        };
      } else if (node.type === "skill") {
        createdEntityId = await duplicateSkillRecord({
          skillId: node.id,
          nameOverride: `${node.name} (Copy)`,
        });
      }

      if (node.type !== "skill") {
        // 1. Create the new entity
        const createRes = await fetch(createEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEntity),
        });

        const createData = await createRes.json();

        if (!createRes.ok) {
          throw new Error(createData.error || `Failed to duplicate ${node.type}`);
        }

        if (node.type === "orchestrator") {
          createdEntityId = createData.orchestrator?.id || newId;
        } else if (node.type === "agent") {
          createdEntityId = createData.agent?.id || newId;
        }
      }
      createdPrimaryEntityId = createdEntityId || null;

      // 2. If it's an agent or skill, link it to the parent
      if (parentId) {
        if (node.type === "agent") {
          // Parent is an Orchestrator
          const orchRes = await fetch(
            `/api/orchestrators/${parentId}?projectId=${currentProject.id}`,
          );
          const orchData = await orchRes.json();
          const orchestrator = orchData.orchestrator;
          const nextAgents = Array.from(
            new Set([...(orchestrator.agents || []), createdEntityId]),
          );
          await fetch(
            `/api/orchestrators/${parentId}?projectId=${currentProject.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...orchestrator, agents: nextAgents }),
            },
          );
        } else if (node.type === "skill") {
          // Parent is an Agent
          const agentRes = await fetch(
            `/api/agents/${parentId}?projectId=${currentProject.id}`,
          );
          const agentData = await agentRes.json();
          const agent = agentData.agent;
          const nextSkills = Array.from(
            new Set([...(agent.skills || []), createdEntityId]),
          );
          await fetch(
            `/api/agents/${parentId}?projectId=${currentProject.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...agent, skills: nextSkills }),
            },
          );
        }
      }

      await refreshTree();
      setSelectedNode({ id: createdEntityId || newId, type: node.type, parentId });
      addToast(`Duplicated ${node.name}`, "success");
    } catch (error) {
      console.error("Failed to duplicate:", error);
      if (currentProject?.id) {
        if (createdPrimaryEntityId) {
          const primaryEntityType =
            node.type === "skill" ? "skills" : node.type === "agent" ? "agents" : null;

          if (primaryEntityType) {
            await fetch(
              `/api/${primaryEntityType}/${createdPrimaryEntityId}?projectId=${currentProject.id}`,
              { method: "DELETE" },
            );
          }
        }

        for (const skillId of createdSkillIds) {
          if (skillId === createdPrimaryEntityId) continue;
          await fetch(`/api/skills/${skillId}?projectId=${currentProject.id}`, {
            method: "DELETE",
          });
        }
      }
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
          <div
            className={`absolute left-0 top-[16px] h-px bg-slate-300 ${TREE_CONNECTOR_HORIZONTAL_CLASS}`}
          />
        </>
      )}

      <div className={`${level > 0 ? TREE_NODE_INDENT_CLASS : ""} pb-1`}>
        <div
          onClick={handleSelect}
          onDoubleClick={startEditing}
          style={theme.style}
          className={`group/row relative flex items-center h-8 px-1 rounded-md cursor-pointer select-none transition-all
            ${isSelected && !isEditing ? WORKSPACE_ENTITY_TREE_SELECTED_CLASS : WORKSPACE_ENTITY_TREE_SURFACE_CLASS}
            ${isEditing ? WORKSPACE_ENTITY_TREE_EDITING_CLASS : "border-transparent"}
          `}
        >
          <div className="relative z-10 flex items-center gap-1 min-w-0 w-full">
            {visibleChildren.length > 0 ? (
              <div
                className={`flex h-5 w-4 items-center justify-center rounded cursor-pointer shrink-0 transition-colors
                  ${isSelected && !isEditing ? "text-[var(--entity-500)] hover:text-[var(--entity-700)]" : "text-slate-400 hover:text-slate-600"}
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
            ) : isSkill ? null : (
              <div className="h-5 w-4 shrink-0" />
            )}

            {isSkill ? (
              <div
                className={`flex h-5 shrink-0 items-center justify-center rounded-md border px-1 text-[10px] font-semibold font-mono tracking-tight transition-colors ${skillVersionChipClass}`}
                title={`${isDraftSkill ? "Draft" : "Published"} version: ${skillVersionLabel}`}
              >
                <span className="truncate leading-none">
                  {skillVersionLabel}
                </span>
              </div>
            ) : null}

            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${entityIconClass}`}
            >
              {getEntityIcon(node.type, "w-3.5 h-3.5")}
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
              <div className="flex min-w-0 flex-1 items-center">
                <span
                  className={`truncate text-sm ${isSelected ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}
                  title={node.name}
                >
                  {node.name}
                </span>
              </div>
            )}

            {!isEditing && (
              <div
                className={`flex items-center gap-1 transition-opacity ${isMenuOpen ? "opacity-100" : "opacity-0 group-hover/row:opacity-100"}`}
              >
                {/* Creation Buttons */}
                {node.type === "orchestrator" && (
                  <button
                    onClick={handleAddAgent}
                    style={WORKSPACE_ENTITY_THEME.agent.style}
                    className={`flex items-center justify-center w-6 h-6 rounded-md transition-all shadow-sm ${isSelected ? WORKSPACE_ENTITY_INLINE_ACTION_SELECTED_CLASS : WORKSPACE_ENTITY_INLINE_ACTION_CLASS}`}
                    title="Add Agent"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}

                {node.type === "agent" && (
                  <button
                    ref={addSkillButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(null);
                      setIsAddSkillMenuOpen((current) => !current);
                    }}
                    disabled={isAddingSkill || isAttachingExistingSkill}
                    style={WORKSPACE_ENTITY_THEME.skill.style}
                    className={`flex items-center justify-center w-6 h-6 rounded-md transition-all shadow-sm disabled:cursor-wait disabled:opacity-70 ${isSelected ? WORKSPACE_ENTITY_INLINE_ACTION_SELECTED_CLASS : WORKSPACE_ENTITY_INLINE_ACTION_CLASS}`}
                    title="Add Skill"
                  >
                    {isAddingSkill || isAttachingExistingSkill ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                {node.type === "agent" &&
                  isAddSkillMenuOpen &&
                  addSkillMenuRect &&
                  createPortal(
                    <div
                      ref={addSkillMenuRef}
                      style={{
                        ...WORKSPACE_ENTITY_THEME.skill.style,
                        top: `${addSkillMenuRect.top}px`,
                        left: `${addSkillMenuRect.left}px`,
                        width: `${addSkillMenuRect.width}px`,
                      }}
                      className="fixed z-[10000] animate-in fade-in zoom-in-95 duration-100"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="overflow-hidden rounded-xl border border-[var(--entity-border)] bg-white shadow-2xl shadow-slate-300/35">
                        <div className="border-b border-[var(--entity-border-subtle)] bg-linear-to-r from-[var(--entity-50)] to-white px-4 py-3">
                          <div className="text-sm font-semibold text-slate-800">
                            Add Skill
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            Create a new deterministic workflow or attach an
                            existing skill version.
                          </div>
                        </div>

                        <div className="space-y-4 p-4">
                          <div className="rounded-xl border border-[var(--entity-border-subtle)] bg-[var(--entity-50)]/45 p-3">
                            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--entity-700)]">
                              Create New
                            </div>
                            <button
                              type="button"
                              onClick={handleCreateSkillForAgent}
                              disabled={isAddingSkill || isAttachingExistingSkill}
                              className="flex w-full items-center justify-center gap-2 rounded-lg bg-linear-to-br from-[var(--entity-gradient-from)] to-[var(--entity-gradient-to)] px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_var(--entity-shadow-color)] transition-all hover:from-[var(--entity-gradient-hover-from)] hover:to-[var(--entity-gradient-hover-to)] disabled:cursor-wait disabled:opacity-70"
                            >
                              {isAddingSkill ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                              New Skill
                            </button>
                          </div>

                          <div className="rounded-xl border border-slate-200 p-3">
                            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                              Attach Existing
                            </div>

                            {isLoadingSkillFamilies ? (
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin text-[var(--entity-500)]" />
                                Loading skills...
                              </div>
                            ) : attachableSkillFamilies.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                                No unassigned skills are available. Use the
                                version switcher on an attached skill to change
                                versions.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div>
                                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                    Skill
                                  </label>
                                  <select
                                    value={selectedSkillFamilyId}
                                    onChange={(e) =>
                                      setSelectedSkillFamilyId(e.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition-colors focus:border-[var(--entity-500)]"
                                  >
                                    {attachableSkillFamilies.map((family) => (
                                      <option key={family.id} value={family.id}>
                                        {family.name}
                                      </option>
                                    ))}
                                  </select>
                                  {selectedSkillFamily?.description ? (
                                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                      {selectedSkillFamily.description}
                                    </p>
                                  ) : null}
                                </div>

                                <div>
                                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                    Version
                                  </label>
                                  <select
                                    value={selectedSkillVersionId}
                                    onChange={(e) =>
                                      setSelectedSkillVersionId(e.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition-colors focus:border-[var(--entity-500)]"
                                  >
                                    {selectedSkillVersionOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.label}
                                        {option.badge ? ` - ${option.badge}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <button
                                  type="button"
                                  onClick={handleAttachExistingSkill}
                                  disabled={
                                    isAttachingExistingSkill ||
                                    !selectedSkillFamily ||
                                    !selectedSkillVersionId
                                  }
                                  className="flex w-full items-center justify-center rounded-lg border border-[var(--entity-border)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--entity-700)] shadow-sm transition-all hover:border-[var(--entity-border-strong)] hover:bg-[var(--entity-50)] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isAttachingExistingSkill ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Attach Selected Version"
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )}

                {/* Context Menu Button */}
                <div className="relative">
                  <button
                    ref={menuTriggerRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(isMenuOpen ? null : menuId);
                    }}
                    className={`flex items-center justify-center w-6 h-6 rounded-md transition-all shadow-sm ${isSelected ? (isMenuOpen ? "bg-white text-slate-700 border border-white/80" : "bg-white/85 text-slate-500 border border-white/80 hover:bg-white hover:text-slate-700") : isMenuOpen ? "bg-slate-200 text-slate-800 border border-slate-300" : "bg-white text-slate-400 border border-slate-200 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-300"}`}
                    title="More Actions"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {isMenuOpen &&
                    menuRect &&
                    createPortal(
                      <div
                        className="context-menu-container fixed z-[10000] w-56 animate-in fade-in zoom-in-95 duration-100"
                        style={{
                          ...theme.style,
                          top: `${menuRect.top}px`,
                          left: `${menuRect.left}px`,
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="overflow-visible rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-300/35">
                          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/80 rounded-t-lg">
                            <div className="font-semibold text-slate-800 text-sm break-words leading-tight">
                              {node.name}
                            </div>
                            <div className="text-slate-500 capitalize text-[10px] mt-0.5 flex items-center gap-1.5 font-medium">
                              <span
                                className={`w-2 h-2 rounded-full inline-block ${WORKSPACE_ENTITY_DOT_CLASS}`}
                              ></span>
                              {node.type}
                            </div>
                          </div>

                          <div
                            className="p-1 overflow-y-auto rounded-b-lg"
                            style={{ maxHeight: `${menuRect.maxHeight}px` }}
                          >
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

                            {node.type === "skill" &&
                              node.data?.allVersions?.length > 1 && (
                                <div className="relative group/submenu">
                                  <button className="w-full text-left px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md flex items-center justify-between transition-colors">
                                    <div className="flex items-center gap-2">
                                      <History className="w-3.5 h-3.5" />{" "}
                                      Switch Version
                                    </div>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>

                                  <div
                                    className="absolute top-0 hidden group-hover/submenu:block animate-in fade-in slide-in-from-left-2 duration-150 p-1 rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-300/35"
                                    style={{
                                      left: `calc(100% + ${CONTEXT_MENU_OFFSET}px)`,
                                      width: `${CONTEXT_SUBMENU_WIDTH}px`,
                                      maxHeight: `${menuRect.maxHeight}px`,
                                      overflowY: "auto",
                                    }}
                                  >
                                    <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 mb-1">
                                      Available Versions
                                    </div>
                                    {(
                                      node.data.allVersions as SkillVersionSummary[]
                                    ).map((v) => (
                                      <button
                                        key={v.id}
                                        style={WORKSPACE_ENTITY_THEME.skill.style}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (v.id === node.id) return;

                                          if (!parentId || !currentProject?.id)
                                            return;
                                          try {
                                            const agentRes = await fetch(
                                              `/api/agents/${parentId}?projectId=${currentProject.id}`,
                                            );
                                            const agentData =
                                              await agentRes.json();
                                            if (!agentRes.ok)
                                              throw new Error(
                                                "Failed to load agent",
                                              );

                                            const agent = agentData.agent;
                                            const nextSkills = (
                                              agent.skills || []
                                            ).map((sid: string) =>
                                              sid === node.id ? v.id : sid,
                                            );

                                            const updateRes = await fetch(
                                              `/api/agents/${parentId}?projectId=${currentProject.id}`,
                                              {
                                                method: "PUT",
                                                headers: {
                                                  "Content-Type":
                                                    "application/json",
                                                },
                                                body: JSON.stringify({
                                                  ...agent,
                                                  skills: nextSkills,
                                                }),
                                              },
                                            );

                                            if (!updateRes.ok)
                                              throw new Error(
                                                "Failed to update agent skill version",
                                              );

                                            addToast(
                                              `Switched ${node.name} to v${v.version}`,
                                              "success",
                                            );
                                            await refreshTree();
                                            setSelectedNode({
                                              id: v.id,
                                              type: "skill",
                                              parentId,
                                            });
                                            setActiveMenuId(null);
                                          } catch (err) {
                                            addToast(
                                              err instanceof Error
                                                ? err.message
                                                : "Failed to switch skill version",
                                              "error",
                                            );
                                          }
                                        }}
                                        className={`w-full text-left px-2 py-1.5 text-xs rounded-md flex items-center justify-between transition-colors ${
                                          v.id === node.id
                                            ? "bg-[var(--entity-50)] text-[var(--entity-700)] font-semibold"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span>v{v.version}</span>
                                          <span
                                            className={`text-[9px] uppercase px-1 rounded ${
                                              v.status === "published"
                                                ? "bg-slate-100 text-slate-500"
                                                : "bg-emerald-100 text-emerald-600"
                                            }`}
                                          >
                                            {v.status}
                                          </span>
                                        </div>
                                        {v.id === node.id && (
                                          <Check className="w-3 h-3" />
                                        )}
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
                                <Unlink className="w-3.5 h-3.5" /> Remove from
                                Agent
                              </button>
                            ) : (
                              <button
                                onClick={handleDelete}
                                className="w-full text-left px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md flex items-center gap-2 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete{" "}
                                {node.type}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>,
                      document.body,
                    )}
                </div>
              </div>
            )}
          </div>
        </div>

        {isExpanded && visibleChildren.length > 0 && (
          <ul className={`relative mt-1 ${TREE_CHILDREN_OFFSET_CLASS}`}>
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

interface SystemComposerPanelProps {
  isMinimized: boolean;
  onToggleMinimized: () => void;
}

export function SystemComposerPanel({
  isMinimized,
  onToggleMinimized,
}: SystemComposerPanelProps) {
  const { projectTree, refreshTree, setActiveOrchestratorId, setSelectedNode } =
    useWorkspace();
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
        <div
          className={`mb-4 flex ${isMinimized ? "px-2 justify-center" : "px-4 items-start justify-between gap-3"}`}
        >
          {isMinimized ? (
            <div
              style={WORKSPACE_PANEL_THEME.composer.style}
              className={`flex flex-col items-center gap-3 rounded-2xl border border-slate-200 px-2 py-3 ${WORKSPACE_PANEL_CONTROL_SHELL_CLASS}`}
            >
              <button
                onClick={onToggleMinimized}
                title="Maximize panel"
                className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-all ${WORKSPACE_PANEL_CONTROL_CLASS}`}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400"
                style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
              >
                Composer
              </span>
            </div>
          ) : (
            <>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  System Hierarchy
                </h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  Manage the system structure without crowding the canvas.
                </p>
              </div>
              <button
                onClick={onToggleMinimized}
                title="Minimize panel"
                style={WORKSPACE_PANEL_THEME.composer.style}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all ${WORKSPACE_PANEL_CONTROL_CLASS} ${WORKSPACE_PANEL_CONTROL_SHELL_CLASS}`}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <div
          className={`flex-1 overflow-y-auto pb-8 transition-all duration-200 ${isMinimized ? "pointer-events-none opacity-0 px-0" : "px-2 opacity-100"}`}
          aria-hidden={isMinimized}
        >
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
                  style={WORKSPACE_ENTITY_THEME.orchestrator.style}
                  className={`flex items-center h-8 px-3 rounded-md text-xs font-semibold border border-dashed shadow-sm transition-all ${WORKSPACE_ENTITY_DASHED_ADD_BUTTON_CLASS} hover:scale-[1.02] active:scale-[0.98]`}
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
