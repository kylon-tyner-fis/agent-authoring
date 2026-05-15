// src/lib/contexts/WorkspaceContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useProject } from "./ProjectContext";

// ---> ADDED "group" TO ENTITY TYPE
export type EntityType =
  | "orchestrator"
  | "agent"
  | "skill"
  | "tool"
  | "mcp_server"
  | "document"
  | "group";

export interface SelectedNode {
  id: string;
  type: EntityType;
  parentId?: string;
}

export interface SystemTreeNode {
  id: string;
  type: EntityType;
  name: string;
  children?: SystemTreeNode[];
  data?: any; // We will use this to tell a "group" node what it is grouping
}

export interface ValidationReadiness {
  score: number;
  requirements: {
    id: string;
    label: string;
    passed: boolean;
    subRequirements?: { id: string; label: string; passed: boolean }[];
  }[];
}

interface WorkspaceContextType {
  activeOrchestratorId: string | null;
  setActiveOrchestratorId: (id: string) => void;
  systemTree: SystemTreeNode | null;
  projectTree: SystemTreeNode | null;
  selectedNode: SelectedNode | null;
  setSelectedNode: (node: SelectedNode | null) => void;
  validationReadiness: ValidationReadiness | null;
  lastUpdated: number;
  isLoading: boolean;
  refreshTree: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { currentProject } = useProject();
  const [activeOrchestratorId, setActiveOrchestratorId] = useState<
    string | null
  >(null);
  const [systemTree, setSystemTree] = useState<SystemTreeNode | null>(null);
  const [projectTree, setProjectTree] = useState<SystemTreeNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [validationReadiness, setValidationReadiness] =
    useState<ValidationReadiness | null>(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);

  const refreshTree = async () => {
    if (!currentProject?.id) return;
    setIsLoading(true);
    setLastUpdated(Date.now());

    try {
      // 1. Fetch all orchestrators for this project
      const orchListResponse = await fetch(
        `/api/orchestrators?projectId=${currentProject.id}`,
      );
      if (!orchListResponse.ok) throw new Error("Failed to fetch orchestrators");
      const orchListData = await orchListResponse.json();
      const orchestrators = orchListData.orchestrators || [];

      if (orchestrators.length === 0) {
        setProjectTree(null);
        setSystemTree(null);
        return;
      }

      // 2. If no active orchestrator is set, or current one is missing (deleted), pick the first one
      const activeExists = orchestrators.some(
        (o: any) => o.id === activeOrchestratorId,
      );
      if ((!activeOrchestratorId || !activeExists) && orchestrators.length > 0) {
        const nextId = orchestrators[0].id;
        setActiveOrchestratorId(nextId);
        // Important: return early because the setActiveOrchestratorId will trigger a re-run
        // or just continue with the new ID for this run to avoid flicker
      }

      // 3. Fetch full trees for all orchestrators
      const treePromises = orchestrators.map((o: any) =>
        fetch(
          `/api/orchestrators/${o.id}/tree?projectId=${currentProject.id}`,
        ).then((r) => r.json()),
      );

      const treeResults = await Promise.all(treePromises);
      const trees = treeResults.map((r) => r.tree).filter(Boolean);

      // Create a virtual root for the sidebar
      const virtualRoot: SystemTreeNode = {
        id: "project-root",
        type: "group",
        name: currentProject.name,
        children: trees,
      };
      setProjectTree(virtualRoot);

      // 4. Set the systemTree to the active one for Inspector/Editor
      if (activeOrchestratorId) {
        const activeTree = trees.find((t) => t.id === activeOrchestratorId);
        if (activeTree) {
          setSystemTree(activeTree);

          // Auto-select the active orchestrator if nothing is selected
          if (!selectedNode) {
            setSelectedNode({ id: activeTree.id, type: "orchestrator" });
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch system tree:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshTree();
  }, [currentProject?.id, activeOrchestratorId]);

  return (
    <WorkspaceContext.Provider
      value={{
        activeOrchestratorId,
        setActiveOrchestratorId,
        systemTree,
        projectTree,
        selectedNode,
        setSelectedNode,
        validationReadiness,
        lastUpdated,
        isLoading,
        refreshTree,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context)
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return context;
};
