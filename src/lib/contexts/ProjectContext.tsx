"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Project } from "../types/constants";

interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  setCurrentProject: (project: Project) => void;
  isLoading: boolean;
  refreshProjects: () => Promise<void>;
  updateProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  const updateProject = async (id: string, name: string) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      await fetchProjects();
    }
  };

  const deleteProject = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchProjects();
      // If we deleted the current project, switch to default
      if (currentProject?.id === id) {
        const defaultProj =
          projects.find((p) => p.name === "Default Project") || projects[0];
        if (defaultProj) setCurrentProject(defaultProj);
      }
    } else {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete project");
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);

        // Auto-select the last project or the Default Project
        const savedProjectId = localStorage.getItem("selectedProjectId");
        const lastProject = data.projects.find(
          (p: Project) => p.id === savedProjectId,
        );
        const defaultProject = data.projects.find(
          (p: Project) => p.name === "Default Project",
        );

        setCurrentProjectState(
          lastProject || defaultProject || data.projects[0] || null,
        );
      }
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const setCurrentProject = (project: Project) => {
    setCurrentProjectState(project);
    localStorage.setItem("selectedProjectId", project.id);
  };

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        projects,
        setCurrentProject,
        isLoading,
        refreshProjects: fetchProjects,
        updateProject,
        deleteProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context)
    throw new Error("useProject must be used within ProjectProvider");
  return context;
};
