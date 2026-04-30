"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react"; // Added useState
import { PRIMARY_NAV, resolvePrimarySection } from "@/src/lib/navigation";
import { useProject } from "@/src/lib/contexts/ProjectContext"; // Added useProject
import {
  Layers,
  Bot,
  Network,
  Wrench,
  Server,
  HelpCircle,
  Bell,
  User,
  FolderKanban,
  Search,
  ChevronDown,
  Check,
  Plus,
  Trash2,
  Pencil, // Added Plus icon
} from "lucide-react";
import Image from "next/image";

const activeThemeMap: Record<string, string> = {
  dashboard: "bg-slate-800 text-slate-100 border-slate-200 shadow-sm",
  orchestrators: "bg-sky-100 text-sky-800 border-sky-200 shadow-sm",
  agents: "bg-emerald-100 text-emerald-800 border-emerald-200 shadow-sm",
  skills: "bg-violet-100 text-violet-800 border-violet-200 shadow-sm",
  tools: "bg-amber-100 text-amber-800 border-amber-200 shadow-sm",
  mcpServers: "bg-cyan-100 text-cyan-800 border-cyan-200 shadow-sm",
};

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const activeSection = resolvePrimarySection(pathname);
  const isHelpActive = pathname.startsWith("/help");

  const {
    currentProject,
    projects,
    setCurrentProject,
    refreshProjects,
    updateProject,
    deleteProject,
  } = useProject();
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()),
  );

  // 1. Create a ref to the dropdown container
  const menuRef = useRef<HTMLDivElement>(null);

  // 2. Add listener to close if clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProjectMenuOpen(false);
      }
    };

    if (isProjectMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProjectMenuOpen]);

  // Function to handle project creation
  const handleCreateProject = async () => {
    const name = window.prompt("Enter new project name:");
    if (!name?.trim()) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        await refreshProjects();
        if (data.project) {
          setCurrentProject(data.project);
          setIsProjectMenuOpen(false);
        }
      }
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  };

  const getNavIcon = (key: string, isActive: boolean) => {
    const className = `w-4 h-4 shrink-0 transition-colors ${
      isActive ? "" : "text-slate-400 group-hover:text-slate-600"
    }`;
    switch (key) {
      case "orchestrators":
        return <Layers className={className} />;
      case "agents":
        return <Bot className={className} />;
      case "skills":
        return <Network className={className} />;
      case "tools":
        return <Wrench className={className} />;
      case "mcpServers":
        return <Server className={className} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-50">
      <header className="h-16 shrink-0 sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur flex items-center">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-5 max-w-full">
          <div className="flex items-center gap-6">
            <nav className="h-16 flex items-center gap-1.5 overflow-x-auto">
              {PRIMARY_NAV.map((item) => {
                const isActive = item.key === activeSection && !isHelpActive;
                const activeClass =
                  activeThemeMap[item.key] || activeThemeMap.dashboard;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`group rounded-lg px-3 py-2 text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 border ${
                      isActive
                        ? activeClass
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-transparent"
                    }`}
                  >
                    {item.key === "dashboard" ? (
                      <Image
                        src="/logo.svg"
                        width={20}
                        height={20}
                        alt="Logo"
                        className={isActive ? "opacity-100" : "opacity-70"}
                      />
                    ) : (
                      getNavIcon(item.key, isActive)
                    )}
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div
              className="relative border-l border-slate-200 pl-6 h-8 flex items-center"
              ref={menuRef}
            >
              <button
                onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 transition-all text-sm font-semibold text-slate-700 shadow-sm"
              >
                <FolderKanban className="w-4 h-4 text-indigo-500" />
                <span className="truncate max-w-[150px]">
                  {currentProject?.name || "Select Project"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isProjectMenuOpen && (
                <div className="absolute top-10 left-6 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search projects..."
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                    {filteredProjects.map((p) => (
                      <div
                        key={p.id}
                        className="group/item flex items-center gap-1 pr-1"
                      >
                        <button
                          onClick={() => {
                            setCurrentProject(p);
                            setIsProjectMenuOpen(false);
                          }}
                          className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-slate-50 text-slate-700 transition-colors text-left"
                        >
                          <span className="truncate">{p.name}</span>
                          {currentProject?.id === p.id && (
                            <Check className="w-4 h-4 text-indigo-600" />
                          )}
                        </button>

                        {/* Settings Actions - Only show on hover for non-Default projects */}
                        {p.name !== "Default Project" && (
                          <div className="flex opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newName = window.prompt(
                                  "Rename project:",
                                  p.name,
                                );
                                if (newName) updateProject(p.id, newName);
                              }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50"
                              title="Rename"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    `Delete project "${p.name}"? All associated Agents and Orchestrators must be deleted first.`,
                                  )
                                ) {
                                  try {
                                    await deleteProject(p.id);
                                  } catch (err: any) {
                                    alert(err.message);
                                  }
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredProjects.length === 0 && (
                      <div className="px-3 py-4 text-center text-xs text-slate-400 italic">
                        No projects found
                      </div>
                    )}
                  </div>

                  {/* Create Project Button at the bottom */}
                  <div className="p-1 bg-slate-50 border-t border-slate-100">
                    <button
                      onClick={handleCreateProject}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-indigo-600 hover:bg-indigo-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Create New Project
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 pl-4 border-l border-slate-200">
            <Link
              href="/help"
              className={`p-2 rounded-full transition-colors ${isHelpActive ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"}`}
              title="Help & Docs"
            >
              <HelpCircle className="w-5 h-5" />
            </Link>
            <button
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button
              className="ml-2 w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
              title="User Settings"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-4rem)] flex flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
