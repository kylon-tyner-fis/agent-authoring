// src/components/features/workspace/SystemInspectorPanel.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useWorkspace, SystemTreeNode } from "@/src/lib/contexts/WorkspaceContext";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Play,
  Cpu,
  Server,
  Database,
  XCircle,
  Network,
  Bot,
  Wrench,
  ChevronDown,
  Info,
  History,
  Lock,
  Check,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Dropdown } from "../../ui/Dropdown";
import { useToast } from "../../layout/Toast";
import { useProject } from "@/src/lib/contexts/ProjectContext";
import {
  WORKSPACE_PANEL_BADGE_INFO_CLASS,
  WORKSPACE_PANEL_CONTROL_CLASS,
  WORKSPACE_PANEL_CONTROL_SHELL_CLASS,
  WORKSPACE_PANEL_PRIMARY_BUTTON_CLASS,
  WORKSPACE_PANEL_SECONDARY_BUTTON_CLASS,
  WORKSPACE_PANEL_SECONDARY_ICON_CLASS,
  WORKSPACE_PANEL_THEME,
  WORKSPACE_PANEL_TITLE_ICON_CLASS,
  WORKSPACE_ENTITY_SECTION_ICON_CLASS,
  WORKSPACE_ENTITY_STAT_CARD_CLASS,
  WORKSPACE_ENTITY_THEME,
} from "./workspaceEntityTheme";

interface SystemInspectorPanelProps {
  isMinimized: boolean;
  onToggleMinimized: () => void;
}

export function SystemInspectorPanel({
  isMinimized,
  onToggleMinimized,
}: SystemInspectorPanelProps) {
  const { systemTree, selectedNode, setSelectedNode, refreshTree } = useWorkspace();
  const { currentProject } = useProject();
  const { addToast } = useToast();
  const [isChecksExpanded, setIsChecksExpanded] = useState(false);
  const [isSchemaExpanded, setIsSchemaExpanded] = useState(false);
  const [isUnmappedExpanded, setIsUnmappedExpanded] = useState(false);

  const {
    agentCount,
    skillCount,
    toolCount,
    issues,
    passedSchemaChecks,
    models,
    externalApis
  } = useMemo(() => {
    let aCount = 0;
    let sCount = 0;

    const issuesList: { type: "error" | "warning" | "info"; title: string; desc: React.ReactNode; data?: any }[] = [];
    const passedSchemaChecks: { skillName: string; key: string; reads: number; writes: number }[] = [];
    const unmappedFields: { skillName: string; nodeLabel: string; field: string; type: "Input" | "Output" }[] = [];
    const modelSet = new Set<string>();
    const apiSet = new Set<string>();
    const toolSet = new Set<string>();

    if (!systemTree) {
      return {
        agentCount: 0,
        skillCount: 0,
        toolCount: 0,
        issues: [],
        passedSchemaChecks: [],
        models: [],
        externalApis: []
      };
    }

    // Check orchestrator
    if (!systemTree.children || systemTree.children.length === 0) {
      issuesList.push({
        type: "error",
        title: "No Agents",
        desc: "Your orchestrator has no agents assigned. It cannot route requests.",
      });
    }

    const agents = systemTree.children || [];
    aCount = agents.length;

    agents.forEach(agentNode => {
      if (!agentNode.children || agentNode.children.length === 0) {
        issuesList.push({
          type: "error",
          title: "Unassigned Agent",
          desc: (
            <>
              Agent <strong>"{agentNode.name}"</strong> has no skills assigned to it.
            </>
          ),
        });
      }

      const skills = agentNode.children || [];
      sCount += skills.length;

      skills.forEach(skillNode => {
        const skillData = skillNode.data || {};

        // Count model
        if (skillData.model?.model_name) {
          modelSet.add(skillData.model.model_name);
        }

        const graphNodes = skillData.graph?.nodes || {};
        const orchNodes = skillData.orchestration?.nodes || [];

        // Normalize all nodes to have an id for tracking
        const allNodes = [
          ...Object.entries(graphNodes).map(([id, node]: [string, any]) => ({ ...node, id })),
          ...orchNodes
        ];

        // Track state schema reads/writes per skill dynamically
        const schemaUsage = new Map<string, { reads: Set<string>; writes: Set<string> }>();

        const registerSchemaUsage = (key: string, isRead: boolean, nodeId: string) => {
          if (typeof key !== 'string' || !key.trim()) return;
          const cleanKey = key.trim();
          if (!schemaUsage.has(cleanKey)) {
            schemaUsage.set(cleanKey, { reads: new Set(), writes: new Set() });
          }
          if (isRead) schemaUsage.get(cleanKey)!.reads.add(nodeId);
          else schemaUsage.get(cleanKey)!.writes.add(nodeId);
        };

        // Build lookups for tool/mcp schemas from the tree
        const skillToolSchemas = new Map<string, any>(); // Map<skillId, Map<toolId, ToolConfig>>

        const currentSkillTools = new Map<string, any>();
        skillNode.children?.forEach(group => {
          if (group.type === "group" && group.name === "Tools") {
            group.children?.forEach(tool => {
              currentSkillTools.set(tool.id, tool.data);
            });
          }
        });
        skillToolSchemas.set(skillNode.id, currentSkillTools);

        // Parse nodes for tools, MCPs, and dynamically infer state mappings
        allNodes.forEach((node: any) => {
          const toolId = node.toolId || node.data?.toolId;
          const serverId = node.serverId || node.data?.serverId;
          const toolName = node.toolName || node.data?.toolName;
          const nodeId = node.id;
          const nodeLabel = node.label || node.data?.label || "Untitled Node";

          if (node.type === "tool" && toolId) {
            toolSet.add(toolId);
          }
          if (node.type === "mcp_node" && serverId) {
            apiSet.add(toolName || serverId);
          }

          // Map locations (from either graph node root or orch node data)
          const inputMapping = node.input_mapping || node.data?.input_mapping || {};
          const extractionMapping = node.extraction_mapping || node.data?.extraction_mapping || {};
          const outputMapping = node.output_mapping || node.data?.output_mapping || {};
          const initMapping = node.initialization_mapping || node.data?.initialization_mapping || {};

          // Validate unmapped fields
          if (node.type === "trigger") {
            const schema = node.expected_payload || node.data?.expected_payload || {};
            Object.keys(schema).forEach(field => {
              if (!initMapping[field]) {
                unmappedFields.push({
                  skillName: skillNode.name,
                  nodeLabel: nodeLabel,
                  field: field,
                  type: "Output"
                });
              }
            });
          }

          if (node.type === "response") {
            const schema = node.response_payload || node.data?.response_payload || node.expected_payload || node.data?.expected_payload || {};
            Object.keys(schema).forEach(field => {
              if (!extractionMapping[field]) {
                unmappedFields.push({
                  skillName: skillNode.name,
                  nodeLabel: nodeLabel,
                  field: field,
                  type: "Input"
                });
              }
            });
          }

          if (node.type === "tool" && toolId) {
            const toolConfig = currentSkillTools.get(toolId);
            if (toolConfig) {
              const inputSchema = toolConfig.input_schema || {};
              const outputSchema = toolConfig.output_schema || {};

              Object.keys(inputSchema).forEach(field => {
                if (!inputMapping[field]) {
                  unmappedFields.push({
                    skillName: skillNode.name,
                    nodeLabel: nodeLabel,
                    field: field,
                    type: "Input"
                  });
                }
              });

              Object.keys(outputSchema).forEach(field => {
                if (!outputMapping[field]) {
                  unmappedFields.push({
                    skillName: skillNode.name,
                    nodeLabel: nodeLabel,
                    field: field,
                    type: "Output"
                  });
                }
              });
            }
          }

          // Track state variable reads
          if (inputMapping) {
            Object.values(inputMapping).flat().forEach((val: any) => registerSchemaUsage(val, true, nodeId));
          }
          if (extractionMapping) {
            Object.values(extractionMapping).forEach((val: any) => registerSchemaUsage(val, true, nodeId));
          }

          // Track state variable writes
          if (outputMapping) {
            Object.values(outputMapping).forEach((val: any) => registerSchemaUsage(val, false, nodeId));
          }
          if (initMapping) {
            Object.values(initMapping).forEach((val: any) => registerSchemaUsage(val, false, nodeId));
          }
        });

        // Generate Schema Validation Issues
        schemaUsage.forEach((usage, key) => {
          const readCount = usage.reads.size;
          const writeCount = usage.writes.size;

          if (readCount === 0 && writeCount === 0) {
            issuesList.push({
              type: "error",
              title: "Unused State Variable",
              desc: <>Skill <strong>"{skillNode.name}"</strong> defines <code>{key}</code> but never reads or writes to it.</>
            });
          } else if (readCount === 0) {
            issuesList.push({
              type: "error",
              title: "State Variable Never Read",
              desc: <>In <strong>"{skillNode.name}"</strong>, <code>{key}</code> is written to, but never read by any node.</>
            });
          } else if (writeCount === 0) {
            issuesList.push({
              type: "error",
              title: "State Variable Never Written",
              desc: <>In <strong>"{skillNode.name}"</strong>, <code>{key}</code> is expected by a node, but never written to.</>
            });
          } else if (readCount === 1 && writeCount === 1 && Array.from(usage.reads)[0] === Array.from(usage.writes)[0]) {
            issuesList.push({
              type: "warning",
              title: "Isolated State Variable",
              desc: <>In <strong>"{skillNode.name}"</strong>, <code>{key}</code> is only accessed by a single node. It is not passed between different nodes.</>
            });
          } else {
            passedSchemaChecks.push({
              skillName: skillNode.name,
              key,
              reads: readCount,
              writes: writeCount
            });
          }
        });
      });
    });

    if (unmappedFields.length > 0) {
      issuesList.push({
        type: "info",
        title: "Unmapped Fields Detected",
        desc: <>There are <strong>{unmappedFields.length}</strong> input/output fields across your system that are not currently mapped to any state variables.</>,
        data: unmappedFields
      });
    }

    return {
      agentCount: aCount,
      skillCount: sCount,
      toolCount: toolSet.size,
      issues: issuesList,
      passedSchemaChecks,
      models: Array.from(modelSet),
      externalApis: Array.from(apiSet)
    };
  }, [systemTree]);

  const isReady = issues.filter(i => i.type === "error").length === 0 && systemTree !== null;

  return (
    <div className="flex flex-col h-full bg-white animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div
        className={`border-b border-slate-100 shrink-0 bg-slate-50/50 ${isMinimized ? "px-2 py-4" : "p-5"}`}
      >
        {isMinimized ? (
          <div
            style={WORKSPACE_PANEL_THEME.inspector.style}
            className={`flex flex-col items-center gap-3 rounded-2xl border border-slate-200 px-2 py-3 ${WORKSPACE_PANEL_CONTROL_SHELL_CLASS}`}
          >
            <button
              onClick={onToggleMinimized}
              title="Maximize panel"
              className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition-all ${WORKSPACE_PANEL_CONTROL_CLASS}`}
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400"
              style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
            >
              Inspector
            </span>
          </div>
        ) : (
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div
                style={WORKSPACE_PANEL_THEME.inspector.style}
                className="flex items-center gap-2 text-slate-700"
              >
                <Activity className={`w-5 h-5 ${WORKSPACE_PANEL_TITLE_ICON_CLASS}`} />
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  System Inspector
                </h2>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Check readiness and system health without occupying extra space.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                style={WORKSPACE_PANEL_THEME.inspector.style}
                className={`text-[10px] font-bold px-2 py-1 rounded-full border uppercase tracking-wider ${isReady
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : WORKSPACE_PANEL_BADGE_INFO_CLASS
                  }`}
              >
                {isReady ? "Ready" : "Incomplete"}
              </span>
              <button
                onClick={onToggleMinimized}
                title="Minimize panel"
                style={WORKSPACE_PANEL_THEME.inspector.style}
                className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-all ${WORKSPACE_PANEL_CONTROL_CLASS} ${WORKSPACE_PANEL_CONTROL_SHELL_CLASS}`}
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      <div
        className={`flex-1 overflow-y-auto custom-scrollbar space-y-8 transition-all duration-200 ${isMinimized ? "pointer-events-none opacity-0 p-0" : "p-5 opacity-100"}`}
        aria-hidden={isMinimized}
      >
        {/* System Validation & Warnings */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Linting & Validation</span>
            {issues.length > 0 && (
              <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full text-[9px]">{issues.length} Issues</span>
            )}
          </h3>
          <div className="space-y-2">
            {issues.length === 0 ? (
              <div className="border border-slate-200 bg-white rounded-lg shadow-sm overflow-hidden">
                <div
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setIsChecksExpanded(!isChecksExpanded)}
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-[13px] font-medium text-slate-600">
                      All checks passed
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isChecksExpanded ? "rotate-180" : ""}`} />
                </div>
                {isChecksExpanded && (
                  <div className="px-3 pb-3 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-600">Orchestrator Routing</p>
                        <p className="text-[10px] text-slate-500">Verified orchestrator has attached agents.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-600">Agent Capabilities</p>
                        <p className="text-[10px] text-slate-500">Verified all agents have assigned skills.</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 mt-1">
                      <div
                        className="flex items-start justify-between cursor-pointer group"
                        onClick={() => setIsSchemaExpanded(!isSchemaExpanded)}
                      >
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[11px] font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">State Schema Integrity</p>
                            <p className="text-[10px] text-slate-500">Verified all state variables have valid read/write paths.</p>
                          </div>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSchemaExpanded ? "rotate-180" : ""}`} />
                      </div>

                      {isSchemaExpanded && (
                        <div className="pl-6 space-y-1.5 mt-1 pb-1">
                          {passedSchemaChecks.length > 0 ? (
                            passedSchemaChecks.map((check, idx) => (
                              <div key={idx} className="bg-white border border-slate-200 rounded p-2 shadow-sm text-[10px] text-slate-600">
                                Validated <code className="bg-slate-100 px-1 rounded text-slate-700">{check.key}</code> in <strong>{check.skillName}</strong>:
                                <span className="block mt-0.5 text-slate-400">
                                  Written by {check.writes} node{check.writes !== 1 ? "s" : ""}, Read by {check.reads} node{check.reads !== 1 ? "s" : ""}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="text-[10px] text-slate-400 italic">
                              No state variables are currently defined in this system.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg shadow-sm transition-all flex flex-col overflow-hidden ${issue.type === "error"
                    ? "border-red-200 bg-red-50 hover:border-red-300"
                    : issue.type === "warning"
                      ? "border-amber-200 bg-amber-50 hover:border-amber-300"
                      : "border-blue-200 bg-blue-50 hover:border-blue-300"
                    }`}
                >
                  <div
                    className={`p-3 flex items-start gap-2.5 ${issue.type === "info" ? "cursor-pointer" : ""}`}
                    onClick={issue.type === "info" ? () => setIsUnmappedExpanded(!isUnmappedExpanded) : undefined}
                  >
                    {issue.type === "error" ? (
                      <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    ) : issue.type === "warning" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-[13px] font-semibold ${issue.type === "error" ? "text-red-900" : issue.type === "warning" ? "text-amber-900" : "text-blue-900"
                            }`}
                        >
                          {issue.title}
                        </p>
                        {issue.type === "info" && (
                          <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform ${isUnmappedExpanded ? "rotate-180" : ""}`} />
                        )}
                      </div>
                      <p
                        className={`text-[11px] mt-1 leading-relaxed ${issue.type === "error" ? "text-red-700/80" : issue.type === "warning" ? "text-amber-700/80" : "text-blue-700/80"
                          }`}
                      >
                        {issue.desc}
                      </p>
                    </div>
                  </div>

                  {issue.type === "info" && isUnmappedExpanded && issue.data && (
                    <div className="px-3 pb-3 pt-2 border-t border-blue-100 bg-blue-50/30 space-y-2">
                      {(issue.data as any[]).map((field, fIdx) => (
                        <div key={fIdx} className="bg-white border border-blue-100 rounded p-2 shadow-sm text-[10px] text-slate-600">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-blue-700">{field.skillName}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${field.type === "Input" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {field.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-medium">{field.nodeLabel}:</span>
                            <code className="bg-slate-50 px-1 rounded text-slate-700 border border-slate-100">{field.field}</code>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Aggregate Resources */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            System Weight
          </h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div
              style={WORKSPACE_ENTITY_THEME.agent.style}
              className={`rounded-lg p-3 flex flex-col items-center justify-center gap-1 shadow-sm ${WORKSPACE_ENTITY_STAT_CARD_CLASS}`}
            >
              <Bot className={`w-4 h-4 ${WORKSPACE_ENTITY_SECTION_ICON_CLASS}`} />
              <span className="text-lg font-bold text-slate-700">{agentCount}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Agents</span>
            </div>
            <div
              style={WORKSPACE_ENTITY_THEME.skill.style}
              className={`rounded-lg p-3 flex flex-col items-center justify-center gap-1 shadow-sm ${WORKSPACE_ENTITY_STAT_CARD_CLASS}`}
            >
              <Network className={`w-4 h-4 ${WORKSPACE_ENTITY_SECTION_ICON_CLASS}`} />
              <span className="text-lg font-bold text-slate-700">{skillCount}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Skills</span>
            </div>
            <div className="bg-linear-to-br from-amber-50 to-white border border-amber-100 rounded-lg p-3 flex flex-col items-center justify-center gap-1 shadow-sm">
              <Wrench className="w-4 h-4 text-amber-500" />
              <span className="text-lg font-bold text-slate-700">{toolCount}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tools</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-2 font-medium">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" /> LLM Engines
              </span>
              <div className="flex flex-col items-end gap-1">
                {models.length > 0 ? models.map(m => (
                  <span key={m} className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[10px]">{m}</span>
                )) : <span className="text-[10px] text-slate-400">None</span>}
              </div>
            </div>
            <div className="h-px bg-slate-100 w-full" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-2 font-medium">
                <Database className="w-3.5 h-3.5 text-emerald-400" /> External APIs
              </span>
              <div className="flex flex-col items-end gap-1">
                {externalApis.length > 0 ? externalApis.map(api => (
                  <span key={api} className="font-semibold text-slate-700 bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                    {api}
                  </span>
                )) : <span className="text-[10px] text-slate-400">None</span>}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Actions */}
      <div
        className={`border-t border-slate-200 shrink-0 space-y-3 bg-slate-50/50 transition-all duration-200 ${isMinimized ? "pointer-events-none opacity-0 p-0" : "p-5 opacity-100"}`}
        aria-hidden={isMinimized}
      >
        <button
          style={WORKSPACE_PANEL_THEME.inspector.style}
          className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${WORKSPACE_PANEL_SECONDARY_BUTTON_CLASS}`}
        >
          <Play className={`w-4 h-4 ${WORKSPACE_PANEL_SECONDARY_ICON_CLASS}`} />
          Test in Sandbox
        </button>
        <button
          disabled={!isReady}
          style={WORKSPACE_PANEL_THEME.inspector.style}
          className={`w-full py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all ${WORKSPACE_PANEL_PRIMARY_BUTTON_CLASS}`}
        >
          Publish System
        </button>
      </div>
    </div>
  );
}
