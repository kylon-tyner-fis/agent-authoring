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
  selectedNode: SelectedNode | null;
  setSelectedNode: (node: SelectedNode | null) => void;
  validationReadiness: ValidationReadiness | null;
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
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [validationReadiness, setValidationReadiness] =
    useState<ValidationReadiness | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshTree = async () => {
    if (!activeOrchestratorId || !currentProject?.id) return;
    setIsLoading(true);

    try {
      // Call our new assembled tree endpoint
      const response = await fetch(
        `/api/orchestrators/${activeOrchestratorId}/tree?projectId=${currentProject.id}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch system tree from server");
      }

      const data = await response.json();

      if (data.tree) {
        setSystemTree(data.tree);

        // Auto-select the orchestrator if nothing is selected
        if (!selectedNode) {
          setSelectedNode({ id: data.tree.id, type: "orchestrator" });
        }
      }
    } catch (error) {
      console.error("Failed to fetch system tree:", error);
      // Optional: Add a toast notification here to warn the user
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshTree();
  }, [activeOrchestratorId]);

  return (
    <WorkspaceContext.Provider
      value={{
        activeOrchestratorId,
        setActiveOrchestratorId,
        systemTree,
        selectedNode,
        setSelectedNode,
        validationReadiness,
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
