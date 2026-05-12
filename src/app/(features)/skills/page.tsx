"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  Network,
  Brain,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useProject } from "@/src/lib/contexts/ProjectContext";
import { ModelConfig } from "@/src/lib/types/constants";

interface SkillListItem {
  id: string;
  name: string;
  version: string;
  description: string;
  model: ModelConfig;
  updated_at: string;
  in_use?: boolean; // ADDED: Usage flag from API
  versions?: SkillListItem[];
}

export default function SkillsDashboard() {
  const router = useRouter();
  const { currentProject } = useProject();
  const [skills, setSkills] = useState<SkillListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  useEffect(() => {
    if (!currentProject) return;

    const fetchSkills = async () => {
      try {
        const skillsRes = await fetch(
          `/api/skills?projectId=${currentProject.id}`,
        );
        const skillsData = await skillsRes.json();
        if (skillsData.skills) setSkills(skillsData.skills);
      } catch (error) {
        console.error("Failed to fetch skills", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSkills();
  }, [currentProject]);

  const confirmDelete = async () => {
    if (!deletingId || !currentProject) return;

    try {
      const res = await fetch(
        `/api/skills/${deletingId}?projectId=${currentProject.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      if (!res.ok) {
        // Log or show toast for the conflict error
        alert(data.error || "Failed to delete skill");
        setDeletingId(null);
        return;
      }

      setSkills(skills.filter((s) => s.id !== deletingId));
    } catch (error) {
      console.error("Failed to delete skill", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Network className="w-6 h-6 text-violet-600" /> Skills
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Pre-determined, orchestrated workflows. Combine tools, logic
              routing, and state management into repeatable multi-step
              processes.
            </p>
          </div>
          <button
            onClick={() => router.push("/skills/new")}
            className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" /> Create Skill
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {isLoading ? (
            <div className="flex justify-center items-center p-12 text-slate-400 bg-white rounded-xl border border-slate-200">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center bg-white rounded-xl border border-slate-200">
              <p className="text-slate-900 font-bold">No skills found</p>
            </div>
          ) : (
            skills.map((skill) => {
              // LOGIC: Filter versions to Top 3 OR currently in use
              const displayVersions =
                skill.versions?.filter((v, index) => index < 3 || v.in_use) ||
                [];
              const archivedCount =
                (skill.versions?.length || 0) - displayVersions.length;

              return (
                <div
                  key={skill.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all"
                >
                  {/* --- MAIN CARD HEADER (The active Draft) --- */}
                  <div className="p-5 flex items-center justify-between bg-white relative z-10 group">
                    <div className="flex items-center gap-6 min-w-0 flex-1">
                      <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center border bg-violet-50 border-violet-200">
                        <Network className="w-5 h-5 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-slate-900 text-lg truncate">
                            {skill.name}
                          </h3>
                          <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                            v{skill.version}
                          </span>
                        </div>

                        <p className="text-sm text-slate-500 mt-1 line-clamp-1">
                          {skill.description}
                        </p>

                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <Brain className="w-3.5 h-3.5" />
                            <span>
                              {skill.model?.model_name || "No model set"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {new Date(skill.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* The Accordion Toggle Button */}
                      {displayVersions.length > 0 && (
                        <button
                          onClick={() => toggleExpand(skill.id)}
                          className={`px-3 py-2 text-sm font-semibold rounded-lg flex items-center gap-1 transition-colors ${
                            expandedId === skill.id
                              ? "bg-slate-100 text-slate-900"
                              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {displayVersions.length} Published Versions{" "}
                          {expandedId === skill.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => router.push(`/skills/${skill.id}`)}
                        className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors whitespace-nowrap shadow-sm"
                      >
                        Edit Skill
                      </button>
                      {/* The Delete Button (Update the onClick and styling) */}
                      <button
                        onClick={() => {
                          if (skill.in_use) {
                            // Optional: Trigger a toast notification explaining why they can't delete
                            alert(
                              "Cannot delete an active skill. Please remove it from all Agents first.",
                            );
                            return;
                          }
                          setDeletingId(skill.id);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          skill.in_use
                            ? "text-slate-300 cursor-not-allowed" // Disabled visual state
                            : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                        }`}
                        title={
                          skill.in_use
                            ? "Cannot delete while in use by an Agent"
                            : "Delete Skill"
                        }
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* --- EXPANDED VERSIONS LIST (The immutable Snapshots) --- */}
                  {expandedId === skill.id && displayVersions.length > 0 && (
                    <div className="bg-slate-50 border-t border-slate-100 p-4 space-y-2 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between mb-3 px-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Published History
                        </p>
                      </div>

                      {displayVersions.map((version) => (
                        <div
                          key={version.id}
                          className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm ml-8"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                              {/* DYNAMIC DOT: Green pulse if in use, solid grey if unused */}
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  version.in_use
                                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"
                                    : "bg-slate-300"
                                }`}
                              ></div>

                              <span className="font-mono text-sm font-bold text-slate-700 flex items-center gap-2">
                                v{version.version}
                                {version.in_use && (
                                  <span className="text-[9px] uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                    Active
                                  </span>
                                )}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />{" "}
                              {new Date(
                                version.updated_at || "",
                              ).toLocaleString()}
                            </span>
                          </div>
                          <button
                            onClick={() => router.push(`/skills/${version.id}`)}
                            className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                          >
                            View Snapshot
                          </button>
                        </div>
                      ))}

                      {/* Info text if older versions were archived by your logic */}
                      {archivedCount > 0 && (
                        <p className="text-xs text-slate-400 italic text-center pt-2">
                          + {archivedCount} older unused{" "}
                          {archivedCount === 1 ? "version" : "versions"}{" "}
                          archived.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Delete Skill?
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to permanently delete this skill? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
