"use client";

import {
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from "react";
import {
  ReactFlow,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ReactFlowProvider,
  useReactFlow,
  Node,
  MarkerType,
  useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  Settings2,
  Hand,
  Trash2,
  GitMerge,
  Code2,
  ArrowRightLeft,
  Zap,
  Flag,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";
import { ToolConfig } from "@/src/lib/types/constants";
import { useToast } from "../../layout/Toast";
import { SchemaNode } from "../../shared/json-tools/SchemaEditor";
import { SchemaViewer } from "../../shared/json-tools/SchemaViewer";
import { ShiftEdge } from "../canvas/edges/ShiftEdge";
import { ResponseNode } from "../canvas/nodes/ResponseNode";
import { TriggerNode } from "../canvas/nodes/TriggerNode";
import { WorkflowNode } from "../canvas/nodes/WorkflowNode";

const nodeTypes = {
  skill: WorkflowNode,
  interrupt: WorkflowNode,
  trigger: TriggerNode,
  response: ResponseNode,
};
const edgeTypes = { shiftEdge: ShiftEdge };

const COLUMN_WIDTH = 350;
const ROW_HEIGHT = 200;

export interface OrchestrationCanvasRef {
  getCanvasData: () => any;
}

export interface OrchestrationCanvasProps {
  initialData?: any;
  globalStateSchema?: Record<string, string>;
  availableSkills?: ToolConfig[];
  activeNodeId?: string | null;
}

const flattenSchemaKeys = (schema: any, prefix = ""): string[] => {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return [];
  let keys: string[] = [];
  for (const [key, value] of Object.entries(schema)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    keys.push(currentPath);
    // Recurse if the value is a nested object (and not an array)
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys = keys.concat(flattenSchemaKeys(value, currentPath));
    }
  }
  return keys;
};

const getId = (type: string) => `${type}_${crypto.randomUUID()}`;

const parseSchema = (schema: any): SchemaNode[] => {
  if (!schema) return [];
  return Object.entries(schema).map(([key, val]) => {
    if (Array.isArray(val) && typeof val[0] === "object") {
      return {
        id: Math.random().toString(),
        key,
        typeHint: "array<object>",
        isNullable: false,
        children: parseSchema(val[0]),
      };
    }
    if (typeof val === "object" && val !== null) {
      return {
        id: Math.random().toString(),
        key,
        typeHint: "object",
        isNullable: false,
        children: parseSchema(val),
      };
    }
    const strVal = String(val);
    const isNullable = strVal.endsWith("?");
    return {
      id: Math.random().toString(),
      key,
      typeHint: isNullable ? strVal.slice(0, -1) : strVal,
      isNullable,
    };
  });
};

const compileSchema = (nodes: SchemaNode[]): any => {
  const result: any = {};
  nodes.forEach((n) => {
    if (!n.key.trim()) return;
    const typeLower = n.typeHint.toLowerCase().trim();
    if ((typeLower === "object" || typeLower === "dict") && n.children) {
      result[n.key.trim()] = compileSchema(n.children);
    } else if (
      (typeLower === "array<object>" || typeLower === "object[]") &&
      n.children
    ) {
      result[n.key.trim()] = [compileSchema(n.children)];
    } else {
      result[n.key.trim()] = n.typeHint + (n.isNullable ? "?" : "");
    }
  });
  return result;
};

const CanvasEditor = forwardRef<
  OrchestrationCanvasRef,
  OrchestrationCanvasProps
>((props, ref) => {
  const startingNodes = props.initialData?.nodes || [];
  const startingEdges = props.initialData?.edges || [];
  const skillsList = props.availableSkills || [];

  const [nodes, setNodes, onNodesChange] = useNodesState(startingNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(startingEdges);
  const { screenToFlowPosition, toObject, setViewport } = useReactFlow();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [dragPreview, setDragPreview] = useState<{
    x: number;
    y: number;
    type: string;
  } | null>(null);

  const [inspectorSchema, setInspectorSchema] = useState<SchemaNode[]>([]);
  const [lastLoadedNodeId, setLastLoadedNodeId] = useState<string | null>(null);

  const { x, y, zoom } = useViewport();
  const { addToast } = useToast();

  useImperativeHandle(ref, () => ({
    getCanvasData: () => toObject(),
  }));

  useEffect(() => {
    if (props.activeNodeId !== undefined) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, active: n.id === props.activeNodeId },
        })),
      );
    }
  }, [props.activeNodeId, setNodes]);

  useEffect(() => {
    if (props.initialData?.viewport) {
      setViewport(props.initialData.viewport);
    }
  }, [props.initialData, setViewport]);

  useEffect(() => {
    if (selectedNodeId !== lastLoadedNodeId) {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (node?.type === "trigger") {
        setInspectorSchema(parseSchema(node.data.expected_payload || {}));
      } else if (node?.type === "response") {
        setInspectorSchema(parseSchema(node.data.response_payload || {}));
      } else {
        setInspectorSchema([]);
      }
      setLastLoadedNodeId(selectedNodeId);
    }
  }, [selectedNodeId, lastLoadedNodeId, nodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      const { source, target } = params;
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);

      if (sourceNode?.type === "response") {
        addToast(
          "Response nodes are terminal and cannot have outgoing connections.",
          "error",
        );
        return;
      }
      if (targetNode?.type === "trigger") {
        addToast(
          "Trigger nodes are entry points and cannot receive incoming connections.",
          "error",
        );
        return;
      }

      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "shiftEdge",
            animated: true,
            style: { strokeWidth: 2 },
            data: { shift: 0 },
          },
          eds,
        ),
      );
    },
    [nodes, setEdges, addToast],
  );

  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, _node: Node, currentNodes: Node[]) => {
      const draggedNodeIds = new Set(currentNodes.map((n) => n.id));
      setEdges((eds) =>
        eds.map((edge) => {
          if (
            draggedNodeIds.has(edge.source) ||
            draggedNodeIds.has(edge.target)
          ) {
            if (edge.data?.shift !== 0)
              return { ...edge, data: { ...edge.data, shift: 0 } };
          }
          return edge;
        }),
      );
    },
    [setEdges],
  );

  const deleteSelected = () => {
    if (selectedNodeId) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
      setEdges((eds) =>
        eds.filter(
          (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
        ),
      );
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    }
  };

  const onDragStart = (
    event: React.DragEvent,
    nodeType: string,
    skillId?: string,
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    if (skillId) event.dataTransfer.setData("application/skillId", skillId);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const hasReactFlowData = event.dataTransfer.types.includes(
        "application/reactflow",
      );
      if (!hasReactFlowData) return;

      const position = screenToFlowPosition(
        { x: event.clientX, y: event.clientY },
        { snapToGrid: false },
      );
      const snappedX = Math.floor(position.x / COLUMN_WIDTH) * COLUMN_WIDTH;
      const snappedY = Math.floor(position.y / ROW_HEIGHT) * ROW_HEIGHT;

      setDragPreview({ x: snappedX, y: snappedY, type: "generic" });
    },
    [screenToFlowPosition],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragPreview(null);
      const type = event.dataTransfer.getData("application/reactflow");
      const skillId = event.dataTransfer.getData("application/skillId");

      if (!type) return;

      // FIX: Moved the validation outside of the setNodes state updater to prevent double-firing toasts in Strict Mode
      if (type === "trigger" && nodes.some((n) => n.type === "trigger")) {
        addToast("You can only have one Trigger node per Agent.", "error");
        return;
      }

      const position = screenToFlowPosition(
        { x: event.clientX, y: event.clientY },
        { snapToGrid: false },
      );
      const snappedX = Math.floor(position.x / COLUMN_WIDTH) * COLUMN_WIDTH;
      const snappedY = Math.floor(position.y / ROW_HEIGHT) * ROW_HEIGHT;

      let newNodeData: any = { label: `new_${type}` };

      if (type === "skill" && skillId) {
        const skill = skillsList.find((s) => s.id === skillId);
        if (skill) {
          newNodeData = {
            label: skill.name,
            skillId: skill.id,
            description: skill.description,
            input_mapping: {},
            output_mapping: {},
          };
        }
      } else if (type === "trigger") {
        newNodeData = {
          label: "Trigger",
          expected_payload: {},
          initialization_mapping: {},
        };
      } else if (type === "response") {
        newNodeData = {
          label: "Response",
          response_payload: {},
          extraction_mapping: {},
        };
      }

      const newNode: Node = {
        id: getId(type),
        type,
        position: { x: snappedX, y: snappedY },
        data: newNodeData,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, addToast, nodes, skillsList],
  ); // <-- Added 'nodes' to dependencies

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  const handleNodeChange = (field: string, value: any) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, [field]: value } }
          : n,
      ),
    );
  };

  const handleNodesChange = useCallback(
    (changes: any[]) => {
      onNodesChange(changes);
      changes.forEach((change) => {
        // If a node is removed via keyboard (Backspace/Delete), clear it from the inspector
        if (change.type === "remove" && change.id === selectedNodeId) {
          setSelectedNodeId(null);
        }
      });
    },
    [onNodesChange, selectedNodeId],
  );

  const handleMappingChange = (
    type:
      | "input_mapping"
      | "output_mapping"
      | "initialization_mapping"
      | "extraction_mapping",
    key: string,
    value: string | string[],
  ) => {
    if (!selectedNodeId || !selectedNode) return;
    const currentMapping =
      (selectedNode.data[type] as Record<string, string>) || {};
    handleNodeChange(type, { ...currentMapping, [key]: value });
  };

  const handleSchemaChange = (newNodes: SchemaNode[]) => {
    setInspectorSchema(newNodes);
    const compiled = compileSchema(newNodes);

    if (!selectedNodeId || !selectedNode) return;

    if (selectedNode.type === "trigger") {
      // Clean up orphaned initialization mappings
      const currentMapping =
        (selectedNode.data.initialization_mapping as Record<string, string>) ||
        {};
      const cleanMapping = { ...currentMapping };

      Object.keys(cleanMapping).forEach((key) => {
        if (!(key in compiled)) {
          delete cleanMapping[key];
        }
      });

      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  expected_payload: compiled,
                  initialization_mapping: cleanMapping,
                },
              }
            : n,
        ),
      );
    } else if (selectedNode.type === "response") {
      // Clean up orphaned extraction mappings
      const currentMapping =
        (selectedNode.data.extraction_mapping as Record<string, string>) || {};
      const cleanMapping = { ...currentMapping };

      Object.keys(cleanMapping).forEach((key) => {
        if (!(key in compiled)) {
          delete cleanMapping[key];
        }
      });

      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  response_payload: compiled,
                  extraction_mapping: cleanMapping,
                },
              }
            : n,
        ),
      );
    }
  };

  const handleEdgeChange = (field: string, value: any) => {
    if (!selectedEdgeId) return;
    setEdges((eds) =>
      eds.map((e) =>
        e.id === selectedEdgeId
          ? { ...e, data: { ...e.data, [field]: value } }
          : e,
      ),
    );
  };

  const stateKeys = flattenSchemaKeys(props.globalStateSchema);
  const activeSkill =
    selectedNode?.type === "skill"
      ? skillsList.find((s) => s.id === selectedNode.data.skillId)
      : null;

  return (
    <div className="flex h-full w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-inner relative">
      <div className="flex-1 h-full relative border-r border-slate-200 overflow-hidden bg-slate-50">
        {/* DRAG TOOLBAR */}
        <div
          className={`absolute top-4 left-4 z-20 flex flex-col gap-2 bg-white/90 backdrop-blur p-3 rounded-lg shadow-xl border border-slate-200 transition-all ${isPaletteOpen ? "w-[220px] max-h-[80%] overflow-y-auto custom-scrollbar" : "w-auto"}`}
        >
          <div className="flex items-center justify-between mb-1 px-1 gap-6">
            <p
              className={`text-[10px] font-bold text-slate-400 uppercase tracking-wider`}
            >
              {isPaletteOpen ? "Skill Palette" : "Node Palette"}
            </p>
            <button
              onClick={() => setIsPaletteOpen(!isPaletteOpen)}
              className="p-1 rounded transition-colors text-slate-400 hover:bg-slate-100"
              title={isPaletteOpen ? "Minimize Palette" : "Expand Palette"}
            >
              {isPaletteOpen ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {isPaletteOpen && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              {skillsList.map((skill) => (
                <div
                  key={skill.id}
                  className="p-2 border border-blue-200 bg-white text-blue-700 rounded cursor-grab flex flex-col gap-1 hover:bg-blue-50 transition-colors shadow-sm"
                  onDragStart={(e) => onDragStart(e, "skill", skill.id)}
                  draggable
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-semibold truncate">
                      {skill.name}
                    </span>
                  </div>
                </div>
              ))}

              <div className="mt-4 pt-2 border-t border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                  API Contract
                </p>
                <div
                  className="p-2 border border-emerald-200 bg-white text-emerald-700 rounded cursor-grab flex items-center gap-2 hover:bg-emerald-50 transition-colors shadow-sm mb-1.5"
                  onDragStart={(e) => onDragStart(e, "trigger")}
                  draggable
                >
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-semibold">Trigger (Input)</span>
                </div>
                <div
                  className="p-2 border border-purple-200 bg-white text-purple-700 rounded cursor-grab flex items-center gap-2 hover:bg-purple-50 transition-colors shadow-sm mb-4"
                  onDragStart={(e) => onDragStart(e, "response")}
                  draggable
                >
                  <Flag className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-semibold">
                    Response (Output)
                  </span>
                </div>

                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 border-t border-slate-200 pt-2">
                  Flow Control
                </p>
                <div
                  className="p-2 border border-orange-200 bg-white text-orange-700 rounded cursor-grab flex items-center gap-2 hover:bg-orange-50 transition-colors shadow-sm"
                  onDragStart={(e) => onDragStart(e, "interrupt")}
                  draggable
                >
                  <Hand className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-semibold">
                    Interrupt (Wait)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={onNodeDragStart}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={() => setDragPreview(null)}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
          }}
          onEdgeClick={(_, edge) => {
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null);
          }}
          onPaneClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
          }}
          snapToGrid={true}
          snapGrid={[COLUMN_WIDTH, ROW_HEIGHT]}
          defaultEdgeOptions={{
            type: "shiftEdge",
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
          fitView
        >
          {dragPreview && (
            <div
              className="absolute pointer-events-none border-2 border-dashed border-slate-400 rounded-xl bg-slate-200/50 z-50 flex items-center justify-center animate-pulse"
              style={{
                width: 240,
                height: 124,
                left: 0,
                top: 0,
                transform: `translate(${x + dragPreview.x * zoom}px, ${y + dragPreview.y * zoom}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                Drop Node
              </span>
            </div>
          )}
          <Controls className="bg-white border-slate-200 shadow-sm mb-4 ml-4" />
        </ReactFlow>
      </div>

      {/* INSPECTOR PANE */}
      {(selectedNode || selectedEdge) && (
        <div className="w-[340px] h-full bg-white flex flex-col shrink-0 border-l border-slate-200">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {selectedNode ? "Node Settings" : "Edge Settings"}
              </h2>
            </div>
            <button
              onClick={deleteSelected}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
            {selectedNode ? (
              <div className="space-y-6 animate-in fade-in">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Node Label
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data.label as string}
                      onChange={(e) =>
                        handleNodeChange("label", e.target.value)
                      }
                      className="w-full p-2 text-sm border border-slate-300 rounded outline-none focus:border-blue-500 font-mono text-slate-900"
                    />
                  </div>

                  {/* SKILL INSPECTOR */}
                  {selectedNode.type === "skill" && activeSkill && (
                    <>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Node-Specific Instructions
                        </label>
                        <p className="text-[10px] text-slate-500 leading-tight mb-1">
                          Add extra context or rules that only apply to this
                          specific step in the workflow.
                        </p>
                        <textarea
                          placeholder="e.g. Only return bullet points for this step..."
                          value={
                            (selectedNode.data.custom_instructions as string) ||
                            ""
                          }
                          onChange={(e) =>
                            handleNodeChange(
                              "custom_instructions",
                              e.target.value,
                            )
                          }
                          className="w-full p-2.5 text-sm border border-slate-300 rounded outline-none focus:border-blue-500 text-slate-900 min-h-[100px] bg-slate-50"
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-indigo-600 mb-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Input Mapping
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mb-2">
                          Map the Agent's global state to the inputs expected by{" "}
                          <strong className="font-mono">
                            {activeSkill.name}
                          </strong>
                          .
                        </p>

                        {Object.keys(activeSkill.input_schema).map(
                          (inputKey) => {
                            // Safely determine the type hint, as it might be an object or array instead of a string
                            const rawHint = activeSkill.input_schema[inputKey];
                            const typeHint =
                              typeof rawHint === "string"
                                ? rawHint.toLowerCase()
                                : Array.isArray(rawHint)
                                  ? "array<object>"
                                  : "object";

                            const isArrayType =
                              typeHint.includes("array") ||
                              typeHint.includes("[]");
                            const currentVal = (
                              selectedNode.data.input_mapping as Record<
                                string,
                                any
                              >
                            )?.[inputKey];

                            return (
                              <div
                                key={inputKey}
                                className="flex flex-col gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-mono font-semibold text-slate-700">
                                    {inputKey}
                                  </span>
                                  <span className="text-[9px] text-slate-400 bg-white px-1 border border-slate-100 rounded uppercase font-bold tracking-wider">
                                    {typeHint}
                                  </span>
                                </div>

                                {isArrayType ? (
                                  <div className="space-y-1.5 mt-1">
                                    {(Array.isArray(currentVal)
                                      ? currentVal
                                      : currentVal
                                        ? [currentVal]
                                        : []
                                    ).map((val, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-1.5"
                                      >
                                        <select
                                          value={val}
                                          onChange={(e) => {
                                            const newArr = Array.isArray(
                                              currentVal,
                                            )
                                              ? [...currentVal]
                                              : currentVal
                                                ? [currentVal]
                                                : [];
                                            newArr[idx] = e.target.value;
                                            handleMappingChange(
                                              "input_mapping",
                                              inputKey,
                                              newArr,
                                            );
                                          }}
                                          className="flex-1 p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-indigo-500 bg-white text-slate-900"
                                        >
                                          <option value="">
                                            -- Select State Variable --
                                          </option>
                                          {stateKeys.map((k) => (
                                            <option key={k} value={k}>
                                              {k}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          onClick={() => {
                                            const newArr = (
                                              Array.isArray(currentVal)
                                                ? currentVal
                                                : [currentVal]
                                            ).filter((_, i) => i !== idx);
                                            handleMappingChange(
                                              "input_mapping",
                                              inputKey,
                                              newArr,
                                            );
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => {
                                        const newArr = Array.isArray(currentVal)
                                          ? [...currentVal, ""]
                                          : currentVal
                                            ? [currentVal, ""]
                                            : [""];
                                        handleMappingChange(
                                          "input_mapping",
                                          inputKey,
                                          newArr,
                                        );
                                      }}
                                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1"
                                    >
                                      <Plus className="w-3 h-3" /> Add mapped
                                      variable
                                    </button>
                                  </div>
                                ) : (
                                  <select
                                    value={currentVal || ""}
                                    onChange={(e) =>
                                      handleMappingChange(
                                        "input_mapping",
                                        inputKey,
                                        e.target.value,
                                      )
                                    }
                                    className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-indigo-500 bg-white"
                                  >
                                    <option value="">
                                      -- Select State Variable --
                                    </option>
                                    {stateKeys.map((k) => (
                                      <option key={k} value={k}>
                                        {k}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            );
                          },
                        )}
                        {Object.keys(activeSkill.input_schema).length === 0 && (
                          <div className="text-xs text-slate-400 italic">
                            This skill expects no inputs.
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-600 mb-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Output Mapping
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mb-2">
                          Map the data returned by this skill back into the
                          Agent's state.
                        </p>

                        {Object.keys(activeSkill.output_schema).map(
                          (outputKey) => {
                            const currentVal =
                              (
                                selectedNode.data.output_mapping as Record<
                                  string,
                                  string
                                >
                              )?.[outputKey] || "";
                            return (
                              <div
                                key={outputKey}
                                className="flex flex-col gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                              >
                                <span className="text-xs font-mono font-semibold text-slate-700">
                                  {outputKey}
                                </span>
                                <select
                                  value={currentVal}
                                  onChange={(e) =>
                                    handleMappingChange(
                                      "output_mapping",
                                      outputKey,
                                      e.target.value,
                                    )
                                  }
                                  className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-emerald-500 bg-white"
                                >
                                  <option value="">
                                    -- Select Target State --
                                  </option>
                                  {stateKeys.map((k) => (
                                    <option key={k} value={k}>
                                      {k}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          },
                        )}
                        {Object.keys(activeSkill.output_schema).length ===
                          0 && (
                          <div className="text-xs text-slate-400 italic">
                            This skill returns no outputs.
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* TRIGGER INSPECTOR */}
                  {selectedNode.type === "trigger" && (
                    <>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Node-Specific Instructions
                        </label>
                        <p className="text-[10px] text-slate-500 leading-tight mb-1">
                          Add extra context or rules for extracting the user's
                          input.
                        </p>
                        <textarea
                          placeholder="e.g. If the user doesn't specify a language, default to Spanish..."
                          value={
                            (selectedNode.data.custom_instructions as string) ||
                            ""
                          }
                          onChange={(e) =>
                            handleNodeChange(
                              "custom_instructions",
                              e.target.value,
                            )
                          }
                          className="w-full p-2.5 text-sm border border-slate-300 rounded outline-none focus:border-emerald-500 text-slate-900 min-h-[100px] bg-slate-50"
                        />
                      </div>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-600 mb-2">
                          <Zap className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Expected Payload
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mb-2">
                          Define the JSON schema the external caller must
                          provide to start this agent.
                        </p>
                        <SchemaViewer
                          title="Expected Payload"
                          nodes={inspectorSchema}
                          setNodes={handleSchemaChange}
                          addButtonText="Add Input Field"
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-indigo-600 mb-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Initialization Mapping
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mb-2">
                          Map the incoming payload fields to the Agent's global
                          state.
                        </p>

                        {Object.keys(
                          selectedNode.data.expected_payload || {},
                        ).map((payloadKey) => {
                          const currentVal =
                            (
                              selectedNode.data
                                .initialization_mapping as Record<
                                string,
                                string
                              >
                            )?.[payloadKey] || "";
                          return (
                            <div
                              key={payloadKey}
                              className="flex flex-col gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                            >
                              <span className="text-xs font-mono font-semibold text-slate-700">
                                {payloadKey}
                              </span>
                              <select
                                value={currentVal}
                                onChange={(e) =>
                                  handleMappingChange(
                                    "initialization_mapping",
                                    payloadKey,
                                    e.target.value,
                                  )
                                }
                                className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-indigo-500 bg-white"
                              >
                                <option value="">
                                  -- Select State Variable --
                                </option>
                                {stateKeys.map((k) => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                        {Object.keys(selectedNode.data.expected_payload || {})
                          .length === 0 && (
                          <div className="text-xs text-slate-400 italic">
                            No payload fields defined yet.
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* RESPONSE INSPECTOR */}
                  {selectedNode.type === "response" && (
                    <>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Node-Specific Instructions
                        </label>
                        <p className="text-[10px] text-slate-500 leading-tight mb-1">
                          Add extra context or rules for formatting the final
                          output.
                        </p>
                        <textarea
                          placeholder="e.g. Summarize the output in 3 concise bullet points..."
                          value={
                            (selectedNode.data.custom_instructions as string) ||
                            ""
                          }
                          onChange={(e) =>
                            handleNodeChange(
                              "custom_instructions",
                              e.target.value,
                            )
                          }
                          className="w-full p-2.5 text-sm border border-slate-300 rounded outline-none focus:border-purple-500 text-slate-900 min-h-[100px] bg-slate-50"
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-purple-600 mb-2">
                          <Flag className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Response Payload
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mb-2">
                          Define the JSON schema this agent will return to the
                          caller.
                        </p>
                        <SchemaViewer
                          title="Response Payload"
                          nodes={inspectorSchema}
                          setNodes={handleSchemaChange}
                          addButtonText="Add Output Field"
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-indigo-600 mb-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Extraction Mapping
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mb-2">
                          Select which variables from the global state should be
                          returned.
                        </p>

                        {Object.keys(
                          selectedNode.data.response_payload || {},
                        ).map((payloadKey) => {
                          const currentVal =
                            (
                              selectedNode.data.extraction_mapping as Record<
                                string,
                                string
                              >
                            )?.[payloadKey] || "";
                          return (
                            <div
                              key={payloadKey}
                              className="flex flex-col gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                            >
                              <span className="text-xs font-mono font-semibold text-slate-700">
                                {payloadKey}
                              </span>
                              <select
                                value={currentVal}
                                onChange={(e) =>
                                  handleMappingChange(
                                    "extraction_mapping",
                                    payloadKey,
                                    e.target.value,
                                  )
                                }
                                className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-indigo-500 bg-white text-slate-900"
                              >
                                <option value="">
                                  -- Select State Variable --
                                </option>
                                {stateKeys.map((k) => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                        {Object.keys(selectedNode.data.response_payload || {})
                          .length === 0 && (
                          <div className="text-xs text-slate-400 italic">
                            No response fields defined yet.
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* INTERRUPT INSPECTOR */}
                  {selectedNode.type === "interrupt" && (
                    <>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-orange-600 mb-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Output Mapping
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mb-2">
                          Map the human's input to a global state variable to
                          use it later in the workflow.
                        </p>

                        <div className="flex flex-col gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-xs font-mono font-semibold text-slate-700">
                            human_input
                          </span>
                          <select
                            value={
                              (
                                selectedNode.data.output_mapping as Record<
                                  string,
                                  string
                                >
                              )?.[`human_input`] || ""
                            }
                            onChange={(e) =>
                              handleMappingChange(
                                "output_mapping",
                                "human_input",
                                e.target.value,
                              )
                            }
                            className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-orange-500 bg-white"
                          >
                            <option value="">-- Select Target State --</option>
                            {stateKeys.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : selectedEdge ? (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-sm font-mono text-slate-600">
                  <span className="flex-1 truncate">{selectedEdge.source}</span>
                  <GitMerge className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="flex-1 truncate text-right">
                    {selectedEdge.target}
                  </span>
                </div>
                <div className="space-y-1.5 mt-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Condition
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. priority == 'high'"
                    value={(selectedEdge.data?.label as string) || ""}
                    onChange={(e) => handleEdgeChange("label", e.target.value)}
                    className="w-full p-2 text-sm border border-slate-300 rounded outline-none focus:border-orange-500 font-mono text-slate-900"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
});

CanvasEditor.displayName = "CanvasEditor";

export const OrchestrationCanvas = forwardRef<
  OrchestrationCanvasRef,
  OrchestrationCanvasProps
>((props, ref) => {
  return (
    <ReactFlowProvider>
      <CanvasEditor ref={ref} {...props} />
    </ReactFlowProvider>
  );
});

OrchestrationCanvas.displayName = "OrchestrationCanvas";
