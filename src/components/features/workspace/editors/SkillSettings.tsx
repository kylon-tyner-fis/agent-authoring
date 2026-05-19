// src/components/features/workspace/editors/SkillSettings.tsx
"use client";

import React from "react";
import { Cpu, MessageSquare, Info, ChevronDown } from "lucide-react";
import { Dropdown, DropdownOption } from "@/src/components/ui/Dropdown";
import {
  WORKSPACE_ENTITY_FIELD_FOCUS_CLASS,
  WORKSPACE_ENTITY_SECTION_ICON_SHELL_CLASS,
} from "../workspaceEntityTheme";

interface SkillSettingsProps {
  data: any;
  onChange: (field: string, value: any) => void;
  readOnly?: boolean;
}

const SUPPORTED_PROVIDERS = [
  { id: "openai", label: "OpenAI", description: "GPT-4o and GPT-4o-mini" },
  { id: "anthropic", label: "Anthropic", description: "Claude 3.5 Sonnet and Haiku" },
  { id: "google", label: "Google", description: "Gemini 1.5 Pro and Flash" },
];

const SUPPORTED_MODELS: Record<string, { id: string, label: string }[]> = {
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-20240620", label: "Claude 3.5 Sonnet" },
    { id: "claude-3-haiku", label: "Claude 3 Haiku" },
  ],
  google: [
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
};

export function SkillSettings({ data, onChange, readOnly }: SkillSettingsProps) {
  return (
    <div className="p-8 space-y-10">
      {/* 1. General Info */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm ${WORKSPACE_ENTITY_SECTION_ICON_SHELL_CLASS}`}
          >
            <MessageSquare className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.15em]">General Information</h3>
        </div>
        
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
            Skill Description
          </label>
          <textarea
            value={data.description || ""}
            disabled={readOnly}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="What does this skill accomplish? This helps the Orchestrator decide when to call this agent."
            className={`w-full p-4 text-sm border border-slate-200 rounded-2xl outline-none min-h-[100px] transition-all resize-none shadow-sm ${WORKSPACE_ENTITY_FIELD_FOCUS_CLASS} ${readOnly ? "bg-slate-50/50 text-slate-500 cursor-not-allowed" : "bg-white text-slate-700 hover:border-slate-300"}`}
          />
        </div>
      </section>

      {/* 2. Logic & Reasoning */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shadow-sm">
            <Info className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.15em]">Logic & Reasoning</h3>
        </div>
        
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
            Instructions (System Prompt)
          </label>
          <p className="text-[10px] text-slate-500 italic mb-2 ml-1">
            Define the persona, boundaries, and internal reasoning steps for the Agent at the heart of this skill.
          </p>
          <textarea
            value={data.system_prompt || ""}
            disabled={readOnly}
            onChange={(e) => onChange("system_prompt", e.target.value)}
            placeholder="Define the internal logic for this skill..."
            className={`w-full p-4 text-sm border border-slate-200 rounded-2xl outline-none min-h-[160px] font-mono transition-all shadow-sm ${WORKSPACE_ENTITY_FIELD_FOCUS_CLASS} ${readOnly ? "bg-slate-50/50 text-slate-500 cursor-not-allowed" : "bg-white text-slate-700 hover:border-slate-300"}`}
          />
        </div>
      </section>

      {/* 3. AI Model Config */}
      <section className="space-y-4 pb-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
            <Cpu className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.15em]">AI Model Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
              Provider
            </label>
            <Dropdown
              value={data.model?.provider || "openai"}
              options={SUPPORTED_PROVIDERS}
              disabled={readOnly}
              onChange={(providerId) =>
                onChange("model", {
                  ...data.model,
                  provider: providerId,
                  model_name: SUPPORTED_MODELS[providerId][0].id,
                })
              }
              trigger={(selected, isOpen) => (
                <div className={`w-full flex items-center justify-between p-3 border rounded-2xl transition-all shadow-sm
                  ${readOnly 
                    ? "bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" 
                    : isOpen 
                      ? "bg-white border-[var(--entity-500)] ring-2 ring-[var(--entity-focus-soft)]" 
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}>
                  <span className="text-sm font-bold text-slate-700">{selected?.label || "Select Provider"}</span>
                  {!readOnly && <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                </div>
              )}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
              Model Name
            </label>
            <Dropdown
              value={data.model?.model_name || ""}
              options={SUPPORTED_MODELS[data.model?.provider || "openai"] || []}
              disabled={readOnly}
              onChange={(modelId) =>
                onChange("model", { ...data.model, model_name: modelId })
              }
              trigger={(selected, isOpen) => (
                <div className={`w-full flex items-center justify-between p-3 border rounded-2xl transition-all shadow-sm
                  ${readOnly 
                    ? "bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed" 
                    : isOpen 
                      ? "bg-white border-[var(--entity-500)] ring-2 ring-[var(--entity-focus-soft)]" 
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}>
                  <span className="text-sm font-bold text-slate-700">{selected?.label || "Select Model"}</span>
                  {!readOnly && <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                </div>
              )}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
