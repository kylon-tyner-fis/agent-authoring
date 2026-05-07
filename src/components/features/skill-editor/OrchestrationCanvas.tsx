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
  Database,
  Server,
  Loader2,
  Cpu,
  FileText,
} from "lucide-react";
import { ToolConfig, MCPServerConfig } from "@/src/lib/types/constants";
import { useToast } from "../../layout/Toast";
import { SchemaNode } from "../../shared/json-tools/SchemaEditor";
import { SchemaViewer } from "../../shared/json-tools/SchemaViewer";
import { ShiftEdge } from "../canvas/edges/ShiftEdge";
import { ResponseNode } from "../canvas/nodes/ResponseNode";
import { TriggerNode } from "../canvas/nodes/TriggerNode";
import { WorkflowNode } from "../canvas/nodes/WorkflowNode";
import { MCPNode } from "../canvas/nodes/MCPNode";
import { McpClient } from "@/src/lib/api-clients/mcp-client";

const SUPPORTED_PROVIDERS = ["openai", "anthropic"];
const SUPPORTED_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-5.4-nano"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-haiku"],
};

const nodeTypes = {
  tool: WorkflowNode,
  interrupt: WorkflowNode,
  trigger: TriggerNode,
  response: ResponseNode,
  mcp_node: MCPNode,
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
  availableTools?: ToolConfig[];
  availableServers?: MCPServerConfig[];
  activeNodeId?: string | null;
}

const flattenSchemaKeys = (schema: any, prefix = ""): string[] => {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return [];
  let keys: string[] = [];
  for (const [key, value] of Object.entries(schema)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    keys.push(currentPath);
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
  const toolsList = props.availableTools || [];
  const serversList = props.availableServers || [];

  const [nodes, setNodes, onNodesChange] = useNodesState(startingNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(startingEdges);
  const { screenToFlowPosition, toObject, setViewport } = useReactFlow();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [dragPreview, setDragPreview] = useState<{
    x: number;
    y: number;
    type: string;
  } | null>(null);

  const [inspectorSchema, setInspectorSchema] = useState<SchemaNode[]>([]);
  const [lastLoadedNodeId, setLastLoadedNodeId] = useState<string | null>(null);

  const [mcpToolsCache, setMcpToolsCache] = useState<Record<string, any[]>>({});
  const [isLoadingMcp, setIsLoadingMcp] = useState(false);

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
    if (isFullScreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isFullScreen]);

  useEffect(() => {
    if (selectedNodeId !== lastLoadedNodeId) {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (node?.type === "trigger") {
        setInspectorSchema(parseSchema(node.data.expected_payload || {}));
      } else if (node?.type === "response") {
        setInspectorSchema(parseSchema(node.data.response_payload || {}));
      } else if (node?.type === "mcp_node" && node.data.serverId) {
        console.log(`[ORCHESTRATION DEBUG] Found MCP Node ${node.data}`);
        const serverId = node.data.serverId as string;
        if (!mcpToolsCache[serverId]) {
          setIsLoadingMcp(true);
          const serverConfig = serversList.find((s) => s.id === serverId);
          if (serverConfig) {
            const client = new McpClient(serverConfig);
            client
              .listTools()
              .then((result) => {
                if (result.success) {
                  setMcpToolsCache((prev) => ({
                    ...prev,
                    [serverId]: result.data as any[],
                  }));
                } else {
                  addToast(
                    `Failed to load server tools: ${result.error}`,
                    "error",
                  );
                }
              })
              .catch((err) => {
                console.error("Failed to load MCP tools", err);
                addToast("Connection to MCP server failed.", "error");
              })
              .finally(() => setIsLoadingMcp(false));
          }
        }
      } else {
        setInspectorSchema([]);
      }
      setLastLoadedNodeId(selectedNodeId);
    }
  }, [
    selectedNodeId,
    lastLoadedNodeId,
    nodes,
    mcpToolsCache,
    addToast,
    serversList,
  ]);

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
    itemId?: string,
  ) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    if (itemId) event.dataTransfer.setData("application/itemId", itemId);
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
      const itemId = event.dataTransfer.getData("application/itemId");

      if (!type) return;

      if (type === "trigger" && nodes.some((n) => n.type === "trigger")) {
        addToast("You can only have one Trigger node per Skill.", "error");
        return;
      }

      const position = screenToFlowPosition(
        { x: event.clientX, y: event.clientY },
        { snapToGrid: false },
      );
      const snappedX = Math.floor(position.x / COLUMN_WIDTH) * COLUMN_WIDTH;
      const snappedY = Math.floor(position.y / ROW_HEIGHT) * ROW_HEIGHT;

      let newNodeData: any = { label: `new_${type}` };

      if (type === "tool" && itemId) {
        const tool = toolsList.find((t) => t.id === itemId);
        if (tool) {
          newNodeData = {
            label: tool.name,
            toolId: tool.id,
            description: tool.description,
            input_mapping: {},
            output_mapping: {},
          };
        }
      } else if (type === "mcp_node" && itemId) {
        const server = serversList.find((s) => s.id === itemId);
        if (server) {
          newNodeData = {
            label: server.name,
            serverId: server.id,
            toolName: "",
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
          exports: [],
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
    [screenToFlowPosition, setNodes, addToast, nodes, toolsList, serversList],
  );

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
  const activeTool =
    selectedNode?.type === "tool"
      ? toolsList.find((t) => t.id === selectedNode.data.toolId)
      : null;

  const activeServerId =
    selectedNode?.type === "mcp_node"
      ? (selectedNode.data.serverId as string)
      : null;
  const availableMcpTools = activeServerId
    ? mcpToolsCache[activeServerId] || []
    : [];
  const selectedMcpToolName =
    selectedNode?.type === "mcp_node"
      ? (selectedNode.data.toolName as string)
      : null;
  const selectedMcpToolDef = availableMcpTools.find(
    (t) => t.name === selectedMcpToolName,
  );

  return (
    <div
      className={
        isFullScreen
          ? "fixed inset-0 z-[100] flex bg-white"
          : "flex h-full w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-inner relative"
      }
    >
      <div className="flex-1 h-full relative border-r border-slate-200 overflow-hidden bg-slate-50">
        <div
          className={`absolute top-4 left-4 z-20 flex flex-col gap-2 bg-white/90 backdrop-blur p-3 rounded-lg shadow-xl border border-slate-200 transition-all ${isPaletteOpen ? "w-[220px] max-h-[80%] overflow-y-auto custom-scrollbar" : "w-auto"}`}
        >
          <div className="flex items-center justify-between mb-1 px-1 gap-6">
            <p
              className={`text-[10px] font-bold text-slate-400 uppercase tracking-wider`}
            >
              Node Palette
            </p>
            <button
              onClick={() => setIsPaletteOpen(!isPaletteOpen)}
              className="p-1 rounded transition-colors text-slate-400 hover:bg-slate-100"
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
              {/* LLM Tools */}
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 border-t border-slate-200 pt-2">
                Tools
              </p>
              {toolsList.map((tool) => (
                <div
                  key={tool.id}
                  className="p-2 border border-amber-200 bg-white text-amber-700 rounded cursor-grab flex flex-col gap-1 hover:bg-amber-50 transition-colors shadow-sm"
                  onDragStart={(e) => onDragStart(e, "tool", tool.id)}
                  draggable
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-semibold truncate">
                      {tool.name}
                    </span>
                  </div>
                </div>
              ))}
              {toolsList.length === 0 && (
                <p className="text-xs text-slate-400 px-1 italic">
                  No tools found.
                </p>
              )}

              {/* MCP Servers */}
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 border-t border-slate-200 pt-2">
                External APIs (MCP)
              </p>
              {serversList.map((server) => (
                <div
                  key={server.id}
                  className="p-2 border border-emerald-200 bg-white text-emerald-700 rounded cursor-grab flex flex-col gap-1 hover:bg-emerald-50 transition-colors shadow-sm"
                  onDragStart={(e) => onDragStart(e, "mcp_node", server.id)}
                  draggable
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs font-semibold truncate">
                      {server.name}
                    </span>
                  </div>
                </div>
              ))}
              {serversList.length === 0 && (
                <p className="text-xs text-slate-400 px-1 italic">
                  No servers found.
                </p>
              )}

              {/* API Contract & Control */}
              <div className="mt-4 pt-2 border-t border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                  API Contract
                </p>
                <div
                  className="p-2 border border-sky-200 bg-white text-sky-700 rounded cursor-grab flex items-center gap-2 hover:bg-sky-50 transition-colors shadow-sm mb-1.5"
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
          minZoom={0.1}
          maxZoom={4}
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
                      className="w-full p-2 text-sm border border-slate-300 rounded outline-none focus:border-sky-500 font-mono text-slate-900"
                    />
                  </div>

                  {/* MCP NODE INSPECTOR */}
                  {selectedNode.type === "mcp_node" && (
                    <>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Select External Action
                        </label>
                        {isLoadingMcp ? (
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin" />{" "}
                            Fetching Server Tools...
                          </div>
                        ) : availableMcpTools.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            No tools found on this server.
                          </p>
                        ) : (
                          <select
                            value={(selectedNode.data.toolName as string) || ""}
                            onChange={(e) => {
                              handleNodeChange("toolName", e.target.value);
                              handleNodeChange("input_mapping", {}); // reset mappings
                            }}
                            className="w-full p-2.5 text-sm border border-slate-300 rounded outline-none focus:border-emerald-500 bg-white"
                          >
                            <option value="">-- Choose an action --</option>
                            {availableMcpTools.map((t) => (
                              <option key={t.name} value={t.name}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {selectedMcpToolDef && (
                          <p className="text-[10px] text-slate-500 leading-tight bg-slate-50 p-2 rounded border border-slate-100">
                            {selectedMcpToolDef.description}
                          </p>
                        )}
                      </div>

                      {selectedMcpToolDef && (
                        <>
                          <div className="pt-4 border-t border-slate-100 space-y-3">
                            <div className="flex items-center gap-2 text-emerald-700 mb-2">
                              <ArrowRightLeft className="w-4 h-4" />
                              <h3 className="text-xs font-bold uppercase tracking-wider">
                                Input Mapping
                              </h3>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight mb-2">
                              Map state variables to the external API's
                              arguments.
                            </p>

                            {Object.keys(
                              selectedMcpToolDef.inputSchema?.properties || {},
                            ).map((inputKey) => {
                              const currentVal =
                                (
                                  selectedNode.data.input_mapping as Record<
                                    string,
                                    string
                                  >
                                )?.[inputKey] || "";
                              return (
                                <div
                                  key={inputKey}
                                  className="flex flex-col gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                                >
                                  <span className="text-xs font-mono font-semibold text-slate-700">
                                    {inputKey}
                                  </span>
                                  <select
                                    value={currentVal}
                                    onChange={(e) =>
                                      handleMappingChange(
                                        "input_mapping",
                                        inputKey,
                                        e.target.value,
                                      )
                                    }
                                    className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-emerald-500 bg-white"
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
                          </div>

                          <div className="pt-4 border-t border-slate-100 space-y-3">
                            <div className="flex items-center gap-2 text-emerald-700 mb-2">
                              <ArrowRightLeft className="w-4 h-4" />
                              <h3 className="text-xs font-bold uppercase tracking-wider">
                                Output Mapping
                              </h3>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight mb-2">
                              Save the raw JSON response to state.
                            </p>

                            <div className="flex flex-col gap-1.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                              <span className="text-xs font-mono font-semibold text-slate-700">
                                mcp_response
                              </span>
                              <select
                                value={
                                  (
                                    selectedNode.data.output_mapping as Record<
                                      string,
                                      string
                                    >
                                  )?.[`mcp_response`] || ""
                                }
                                onChange={(e) =>
                                  handleMappingChange(
                                    "output_mapping",
                                    "mcp_response",
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
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* LLM TOOL INSPECTOR */}
                  {selectedNode.type === "tool" && activeTool && (
                    <>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Node-Specific Instructions
                        </label>
                        <p className="text-[10px] text-slate-500 leading-tight mb-1">
                          Add extra context or rules that only apply to this
                          specific step.
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
                          className="w-full p-2.5 text-sm border border-slate-300 rounded outline-none focus:border-amber-500 text-slate-900 min-h-[100px] bg-slate-50"
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-purple-600 mb-2">
                          <Cpu className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            AI Engine Override
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mb-2">
                          By default, this node uses the Skill's global AI
                          Engine. Enable override to specify a different model
                          for this step.
                        </p>

                        {!selectedNode.data.model_config ? (
                          <button
                            onClick={() =>
                              handleNodeChange("model_config", {
                                provider: "openai",
                                model_name: "gpt-4o-mini",
                                temperature: 0.7,
                                max_tokens: 4096,
                              })
                            }
                            className="w-full py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded transition-colors"
                          >
                            + Enable Model Override
                          </button>
                        ) : (
                          <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Custom Engine
                              </span>
                              <button
                                onClick={() =>
                                  handleNodeChange("model_config", undefined)
                                }
                                className="text-[10px] text-red-500 hover:text-red-700 font-semibold hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-semibold text-gray-600">
                                Provider
                              </label>
                              <select
                                value={
                                  (selectedNode.data.model_config as any)
                                    .provider
                                }
                                onChange={(e) =>
                                  handleNodeChange("model_config", {
                                    ...(selectedNode.data.model_config as any),
                                    provider: e.target.value,
                                    model_name:
                                      SUPPORTED_MODELS[e.target.value][0],
                                  })
                                }
                                className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none bg-white text-slate-900"
                              >
                                {SUPPORTED_PROVIDERS.map((p) => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-semibold text-gray-600">
                                Model Name
                              </label>
                              <select
                                value={
                                  (selectedNode.data.model_config as any)
                                    .model_name
                                }
                                onChange={(e) =>
                                  handleNodeChange("model_config", {
                                    ...(selectedNode.data.model_config as any),
                                    model_name: e.target.value,
                                  })
                                }
                                className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none bg-white text-slate-900"
                              >
                                {SUPPORTED_MODELS[
                                  (selectedNode.data.model_config as any)
                                    .provider
                                ]?.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold text-gray-600">
                                  Temp
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="2"
                                  step="0.1"
                                  value={
                                    (selectedNode.data.model_config as any)
                                      .temperature
                                  }
                                  onChange={(e) =>
                                    handleNodeChange("model_config", {
                                      ...(selectedNode.data
                                        .model_config as any),
                                      temperature:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none bg-white font-mono text-slate-900"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold text-gray-600">
                                  Max Tokens
                                </label>
                                <input
                                  type="number"
                                  min="256"
                                  step="1"
                                  value={
                                    (selectedNode.data.model_config as any)
                                      .max_tokens
                                  }
                                  onChange={(e) =>
                                    handleNodeChange("model_config", {
                                      ...(selectedNode.data
                                        .model_config as any),
                                      max_tokens:
                                        parseInt(e.target.value) || 256,
                                    })
                                  }
                                  className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none bg-white font-mono text-slate-900"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-amber-700 mb-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Input Mapping
                          </h3>
                        </div>

                        {Object.keys(activeTool.input_schema).map(
                          (inputKey) => {
                            const rawHint = activeTool.input_schema[inputKey];
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
                                          className="flex-1 p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-amber-500 bg-white text-slate-900"
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
                                      className="text-[10px] font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 py-1"
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
                                    className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-amber-500 bg-white"
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
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-amber-700 mb-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Output Mapping
                          </h3>
                        </div>

                        {Object.keys(activeTool.output_schema).map(
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
                                  className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-amber-500 bg-white"
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
                      </div>
                    </>
                  )}

                  {selectedNode.type === "trigger" && (
                    <>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Node-Specific Instructions
                        </label>
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
                          className="w-full p-2.5 text-sm border border-slate-300 rounded outline-none focus:border-sky-500 text-slate-900 min-h-[100px] bg-slate-50"
                        />
                      </div>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-sky-700 mb-2">
                          <Zap className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Expected Payload
                          </h3>
                        </div>
                        <SchemaViewer
                          title="Expected Payload"
                          nodes={inspectorSchema}
                          setNodes={handleSchemaChange}
                          addButtonText="Add Input Field"
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-sky-700 mb-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Initialization Mapping
                          </h3>
                        </div>

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
                                className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-sky-500 bg-white"
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
                      </div>
                    </>
                  )}

                  {selectedNode.type === "response" && (
                    <>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Node-Specific Instructions
                        </label>
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
                        <SchemaViewer
                          title="Response Payload"
                          nodes={inspectorSchema}
                          setNodes={handleSchemaChange}
                          addButtonText="Add Output Field"
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-purple-600 mb-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Extraction Mapping
                          </h3>
                        </div>

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
                                className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-purple-500 bg-white text-slate-900"
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
                      </div>

                      {/* NEW: File Exports */}
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-rose-600 mb-2">
                          <FileText className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            File Exports
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mb-2">
                          Generate downloadable files from state variables. The
                          URLs will be injected into the final JSON payload.
                        </p>

                        {/* List of active exports */}
                        {((selectedNode.data.exports as any[]) || []).map(
                          (exp, index) => (
                            <div
                              key={exp.id}
                              className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 mb-2 relative group animate-in fade-in"
                            >
                              <button
                                onClick={() => {
                                  const newExports = [
                                    ...((selectedNode.data.exports as any[]) ||
                                      []),
                                  ];
                                  newExports.splice(index, 1);
                                  handleNodeChange("exports", newExports);
                                }}
                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove Export"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              <div className="space-y-1.5 pr-6">
                                <label className="text-[10px] font-semibold text-gray-600">
                                  Format
                                </label>
                                <select
                                  value={exp.format}
                                  onChange={(e) => {
                                    const newExports = [
                                      ...((selectedNode.data
                                        .exports as any[]) || []),
                                    ];
                                    newExports[index] = {
                                      ...exp,
                                      format: e.target.value,
                                    };
                                    handleNodeChange("exports", newExports);
                                  }}
                                  className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-rose-500 bg-white text-slate-900"
                                >
                                  <option value="pdf">
                                    PDF Document (.pdf)
                                  </option>
                                  <option value="csv">CSV Data (.csv)</option>
                                  <option value="txt">Plain Text (.txt)</option>
                                  <option value="md">Markdown (.md)</option>
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold text-gray-600">
                                  Source Variable
                                </label>
                                <select
                                  value={exp.source_variable}
                                  onChange={(e) => {
                                    const newExports = [
                                      ...((selectedNode.data
                                        .exports as any[]) || []),
                                    ];
                                    newExports[index] = {
                                      ...exp,
                                      source_variable: e.target.value,
                                    };
                                    handleNodeChange("exports", newExports);
                                  }}
                                  className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-rose-500 bg-white text-slate-900"
                                >
                                  <option value="">
                                    -- Select Data Source --
                                  </option>
                                  {stateKeys.map((k) => (
                                    <option key={k} value={k}>
                                      {k}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* NEW: Optional Layout Instructions (Only show for PDF) */}
                              {exp.format === "pdf" && (
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-semibold text-gray-600">
                                    Layout Instructions (Optional)
                                  </label>
                                  <textarea
                                    placeholder="e.g. Use a large title, bold the correct answers..."
                                    value={exp.layout_instructions || ""}
                                    onChange={(e) => {
                                      const newExports = [
                                        ...((selectedNode.data
                                          .exports as any[]) || []),
                                      ];
                                      newExports[index] = {
                                        ...exp,
                                        layout_instructions: e.target.value,
                                      };
                                      handleNodeChange("exports", newExports);
                                    }}
                                    className="w-full p-2 text-xs border border-slate-300 rounded outline-none focus:border-rose-500 bg-white text-slate-900 min-h-[60px]"
                                  />
                                </div>
                              )}

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold text-gray-600">
                                  Target Output Key
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. download_url"
                                  value={exp.target_variable}
                                  onChange={(e) => {
                                    const newExports = [
                                      ...((selectedNode.data
                                        .exports as any[]) || []),
                                    ];
                                    newExports[index] = {
                                      ...exp,
                                      target_variable: e.target.value,
                                    };
                                    handleNodeChange("exports", newExports);
                                  }}
                                  className="w-full p-1.5 text-xs border border-slate-300 rounded outline-none focus:border-rose-500 bg-white font-mono text-slate-900"
                                />
                              </div>
                            </div>
                          ),
                        )}

                        {/* Add Export Button */}
                        <button
                          onClick={() => {
                            const newExports = [
                              ...((selectedNode.data.exports as any[]) || []),
                            ];
                            newExports.push({
                              id: crypto.randomUUID(),
                              format: "pdf",
                              source_variable: "",
                              target_variable: "",
                            });
                            handleNodeChange("exports", newExports);
                          }}
                          className="w-full py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors flex items-center justify-center gap-1 shadow-sm mt-2"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add File Export
                        </button>
                      </div>
                    </>
                  )}

                  {selectedNode.type === "interrupt" && (
                    <>
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center gap-2 text-orange-600 mb-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          <h3 className="text-xs font-bold uppercase tracking-wider">
                            Output Mapping
                          </h3>
                        </div>
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
