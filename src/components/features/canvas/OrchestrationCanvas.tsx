"use client";

import {
  useState,
  useCallback,
  useMemo,
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
  Viewport,
  Edge,
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
  Plus,
  X,
  Brain,
  Eye,
  Loader2,
  Cpu,
  FileText,
} from "lucide-react";
import { ToolConfig, MCPServerConfig } from "@/src/lib/types/constants";
import { useToast } from "../../layout/Toast";
import { SchemaNode } from "../../shared/json-tools/SchemaEditor";
import { SchemaViewer } from "../../shared/json-tools/SchemaViewer";
import { ShiftEdge } from "./edges/ShiftEdge";
import { ResponseNode } from "./nodes/ResponseNode";
import { TriggerNode } from "./nodes/TriggerNode";
import { WorkflowNode } from "./nodes/WorkflowNode";
import { MCPNode } from "./nodes/MCPNode";
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
  getCanvasData: () => { nodes: Node[]; edges: Edge[]; viewport: Viewport };
  getInferredStateSchema: () => Record<string, string>;
  openStateSchema: () => void;
  isStateSchemaOpen: () => boolean;
  clearSelection: () => void;
}

export interface OrchestrationCanvasProps {
  initialData?: any;
  globalStateSchema?: Record<string, string>;
  availableTools?: ToolConfig[];
  availableServers?: MCPServerConfig[];
  activeNodeId?: string | null;
  readOnly?: boolean;
  onSelectionChange?: (hasSelection: boolean) => void;
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

type StateFieldTouch = {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  direction: "reads" | "writes";
  localField: string;
};

type StateFieldSummary = {
  key: string;
  typeHint: string;
  touches: StateFieldTouch[];
};

const getSchemaTypeAtPath = (schema: unknown, path: string): string => {
  if (!schema || !path) return "unknown";
  const segments = path.split(".");
  let current: unknown = schema;

  for (const segment of segments) {
    if (Array.isArray(current)) current = current[0];
    if (!current || typeof current !== "object") return "unknown";
    current = (current as Record<string, unknown>)[segment];
  }

  if (Array.isArray(current)) {
    if (current.length === 0) return "array";
    return typeof current[0] === "object"
      ? "array<object>"
      : `array<${String(current[0])}>`;
  }
  if (current && typeof current === "object") return "object";
  return current ? String(current) : "unknown";
};

const addStateTouch = (
  fields: Map<string, StateFieldSummary>,
  key: unknown,
  typeHint: string,
  touch: StateFieldTouch,
) => {
  if (typeof key !== "string" || !key.trim()) return;
  const normalizedKey = key.trim();
  const existing = fields.get(normalizedKey);

  if (existing) {
    if (existing.typeHint === "unknown" && typeHint !== "unknown") {
      existing.typeHint = typeHint;
    }
    existing.touches.push(touch);
    return;
  }

  fields.set(normalizedKey, {
    key: normalizedKey,
    typeHint: typeHint || "unknown",
    touches: [touch],
  });
};

const inferStateFields = (
  nodes: Node[],
  toolsList: ToolConfig[],
): StateFieldSummary[] => {
  const fields = new Map<string, StateFieldSummary>();

  nodes.forEach((node) => {
    const nodeLabel = String(node.data?.label || node.id);
    const nodeType = node.type || "node";
    const baseTouch = { nodeId: node.id, nodeLabel, nodeType };

    if (node.type === "trigger") {
      const schema = (node.data?.expected_payload || {}) as Record<
        string,
        unknown
      >;
      const mapping = (node.data?.initialization_mapping || {}) as Record<
        string,
        string
      >;
      Object.keys(schema).forEach((payloadKey) => {
        addStateTouch(
          fields,
          mapping[payloadKey] || payloadKey,
          getSchemaTypeAtPath(schema, payloadKey),
          {
            ...baseTouch,
            direction: "writes",
            localField: payloadKey,
          },
        );
      });
      return;
    }

    if (node.type === "tool") {
      const tool = toolsList.find((t) => t.id === node.data?.toolId);
      const inputMapping = (node.data?.input_mapping || {}) as Record<
        string,
        string | string[]
      >;
      Object.entries(inputMapping).forEach(([localField, mappedKeys]) => {
        const keys = Array.isArray(mappedKeys) ? mappedKeys : [mappedKeys];
        keys.forEach((key) =>
          addStateTouch(fields, key, "unknown", {
            ...baseTouch,
            direction: "reads",
            localField,
          }),
        );
      });

      const outputMapping = (node.data?.output_mapping || {}) as Record<
        string,
        string
      >;
      Object.entries(outputMapping).forEach(([localField, stateKey]) => {
        addStateTouch(
          fields,
          stateKey || localField,
          getSchemaTypeAtPath(tool?.output_schema, localField),
          {
            ...baseTouch,
            direction: "writes",
            localField,
          },
        );
      });
      return;
    }

    if (node.type === "mcp_node") {
      const inputMapping = (node.data?.input_mapping || {}) as Record<
        string,
        string
      >;
      Object.entries(inputMapping).forEach(([localField, stateKey]) => {
        addStateTouch(fields, stateKey, "unknown", {
          ...baseTouch,
          direction: "reads",
          localField,
        });
      });

      const outputMapping = (node.data?.output_mapping || {}) as Record<
        string,
        string
      >;
      Object.entries(outputMapping).forEach(([localField, stateKey]) => {
        addStateTouch(fields, stateKey || localField, "object", {
          ...baseTouch,
          direction: "writes",
          localField,
        });
      });
      return;
    }

    if (node.type === "response") {
      const mapping = (node.data?.extraction_mapping || {}) as Record<
        string,
        string
      >;
      Object.entries(mapping).forEach(([localField, stateKey]) => {
        addStateTouch(fields, stateKey, "unknown", {
          ...baseTouch,
          direction: "reads",
          localField,
        });
      });
    }
  });

  return Array.from(fields.values()).sort((a, b) => a.key.localeCompare(b.key));
};

const stateFieldSummariesToSchema = (
  fields: StateFieldSummary[],
): Record<string, string> =>
  fields.reduce<Record<string, string>>((schema, field) => {
    schema[field.key] = field.typeHint;
    return schema;
  }, {});

const CanvasEditor = forwardRef<
  OrchestrationCanvasRef,
  OrchestrationCanvasProps
>((props, ref) => {
  const startingNodes = props.initialData?.nodes || [];
  const startingEdges = props.initialData?.edges || [];
  const toolsList = useMemo(
    () => props.availableTools || [],
    [props.availableTools],
  );
  const serversList = useMemo(
    () => props.availableServers || [],
    [props.availableServers],
  );
  const isReadOnly = !!props.readOnly; // Extracted

  const [nodes, setNodes, onNodesChange] = useNodesState(startingNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(startingEdges);
  const { screenToFlowPosition, toObject, setViewport } = useReactFlow();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isStateSchemaOpen, setIsStateSchemaOpen] = useState(false);
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

  const inferredStateFields = useMemo(
    () => inferStateFields(nodes, toolsList),
    [nodes, toolsList],
  );
  const inferredStateSchema = useMemo(
    () => stateFieldSummariesToSchema(inferredStateFields),
    [inferredStateFields],
  );

  useImperativeHandle(ref, () => ({
    getCanvasData: () => toObject(),
    getInferredStateSchema: () => inferredStateSchema,
    openStateSchema: () => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setIsStateSchemaOpen(true);
      props.onSelectionChange?.(true);
    },
    isStateSchemaOpen: () => isStateSchemaOpen,
    clearSelection: () => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setIsStateSchemaOpen(false);
      props.onSelectionChange?.(false);
    },
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
    if (isReadOnly) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === "tool") {
          const tool = toolsList.find((t) => t.id === node.data?.toolId);
          if (!tool) return node;

          const currentOutputMapping = (node.data?.output_mapping || {}) as Record<
            string,
            string
          >;
          const nextOutputMapping = { ...currentOutputMapping };
          const toolOutputKeys = Object.keys(tool.output_schema || {});
          let changed = false;

          // Remove outputs that no longer exist in the tool schema
          Object.keys(nextOutputMapping).forEach((outputKey) => {
            if (!toolOutputKeys.includes(outputKey)) {
              delete nextOutputMapping[outputKey];
              changed = true;
            }
          });

          // Add new outputs from the tool schema
          toolOutputKeys.forEach((outputKey) => {
            if (!nextOutputMapping[outputKey]) {
              nextOutputMapping[outputKey] = outputKey;
              changed = true;
            }
          });

          const currentInputMapping = (node.data?.input_mapping || {}) as Record<
            string,
            string | string[]
          >;
          const nextInputMapping = { ...currentInputMapping };
          const toolInputKeys = Object.keys(tool.input_schema || {});

          // Remove inputs that no longer exist in the tool schema
          Object.keys(nextInputMapping).forEach((inputKey) => {
            if (!toolInputKeys.includes(inputKey)) {
              delete nextInputMapping[inputKey];
              changed = true;
            }
          });

          return changed
            ? {
              ...node,
              data: {
                ...node.data,
                output_mapping: nextOutputMapping,
                input_mapping: nextInputMapping,
              },
            }
            : node;
        }

        if (node.type === "mcp_node") {
          const currentMapping = (node.data?.output_mapping || {}) as Record<
            string,
            string
          >;
          if (currentMapping.mcp_response) return node;

          return {
            ...node,
            data: {
              ...node.data,
              output_mapping: {
                ...currentMapping,
                mcp_response: "mcp_response",
              },
            },
          };
        }

        return node;
      }),
    );
  }, [isReadOnly, setNodes, toolsList]);


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
      if (isReadOnly) return;
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
    [nodes, setEdges, addToast, isReadOnly],
  );

  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, _node: Node, currentNodes: Node[]) => {
      if (isReadOnly) return;
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
    [setEdges, isReadOnly],
  );

  const deleteSelected = () => {
    if (isReadOnly) return;
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
    if (isReadOnly) return;
    event.dataTransfer.setData("application/reactflow", nodeType);
    if (itemId) event.dataTransfer.setData("application/itemId", itemId);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      if (isReadOnly) return;
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
    [screenToFlowPosition, isReadOnly],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (isReadOnly) return;
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
            output_mapping: Object.keys(tool.output_schema || {}).reduce(
              (mapping, outputKey) => ({ ...mapping, [outputKey]: outputKey }),
              {} as Record<string, string>,
            ),
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
            output_mapping: { mcp_response: "mcp_response" },
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
    [
      screenToFlowPosition,
      setNodes,
      addToast,
      nodes,
      toolsList,
      serversList,
      isReadOnly,
    ],
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  const handleNodeChange = (field: string, value: any) => {
    if (isReadOnly || !selectedNodeId) return;
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
      if (isReadOnly) return;
      onNodesChange(changes);
      changes.forEach((change) => {
        if (change.type === "remove" && change.id === selectedNodeId) {
          setSelectedNodeId(null);
        }
      });
    },
    [onNodesChange, selectedNodeId, isReadOnly],
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
    if (isReadOnly || !selectedNodeId || !selectedNode) return;
    const currentMapping =
      (selectedNode.data[type] as Record<string, string>) || {};
    handleNodeChange(type, { ...currentMapping, [key]: value });
  };

  const handleSchemaChange = (newNodes: SchemaNode[]) => {
    if (isReadOnly) return;
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
      Object.keys(compiled).forEach((key) => {
        if (!cleanMapping[key]) {
          cleanMapping[key] = key;
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
    if (isReadOnly || !selectedEdgeId) return;
    setEdges((eds) =>
      eds.map((e) =>
        e.id === selectedEdgeId
          ? { ...e, data: { ...e.data, [field]: value } }
          : e,
      ),
    );
  };

  const stateKeys = Array.from(
    new Set([
      ...flattenSchemaKeys(props.globalStateSchema),
      ...inferredStateFields.map((field) => field.key),
    ]),
  ).sort();
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
          : "relative h-full w-full bg-slate-50 rounded-xl overflow-hidden"
      }
    >
      <div className="absolute inset-0 z-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={isReadOnly ? undefined : handleNodesChange}
          onEdgesChange={isReadOnly ? undefined : onEdgesChange}
          onConnect={isReadOnly ? undefined : onConnect}
          onNodeDragStart={isReadOnly ? undefined : onNodeDragStart}
          nodesDraggable={!isReadOnly}
          nodesConnectable={!isReadOnly}
          elementsSelectable={true} // Allow clicking to inspect
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onDrop={isReadOnly ? undefined : onDrop}
          onDragOver={isReadOnly ? undefined : onDragOver}
          onDragLeave={() => setDragPreview(null)}
          onNodeClick={(_, node) => {
            setIsStateSchemaOpen(false);
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
            props.onSelectionChange?.(true);
          }}
          onEdgeClick={(_, edge) => {
            setIsStateSchemaOpen(false);
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null);
            props.onSelectionChange?.(true);
          }}
          onPaneClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setIsStateSchemaOpen(false);
            props.onSelectionChange?.(false);
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
          {dragPreview && !isReadOnly && (
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
          <Controls
            position="bottom-left"
            style={{ margin: "16px" }}
            className="bg-white border-slate-200 shadow-sm rounded-lg overflow-hidden"
          />
        </ReactFlow>
      </div>

      <datalist id="state-schema-keys">
        {stateKeys.map((key) => (
          <option key={key} value={key} />
        ))}
      </datalist>


      {/* State Schema (Memory) Inspector Card */}
      <div className={`absolute right-4 top-[78px] bottom-4 w-[380px] z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl transition-all duration-300 ease-out origin-right ${isStateSchemaOpen && !selectedNode && !selectedEdge
        ? "opacity-100 translate-x-0 scale-100 pointer-events-auto"
        : "opacity-0 translate-x-8 scale-95 pointer-events-none"
        }`}>
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-500" />
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Skill Memory
              </h2>
              <p className="text-[10px] font-medium text-slate-500">
                {inferredStateFields.length} active variable
                {inferredStateFields.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsStateSchemaOpen(false);
              props.onSelectionChange?.(false);
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-md transition-colors"
            title="Close Memory"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-white/50">
          {inferredStateFields.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Add fields to the Trigger payload or map Tool outputs to begin
              building this Skill&apos;s state schema.
            </div>
          ) : (
            <div className="space-y-3">
              {inferredStateFields.map((field) => (
                <div
                  key={field.key}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div
                        className="truncate font-mono text-sm font-bold text-slate-800"
                        title={field.key}
                      >
                        {field.key}
                      </div>
                      <div className="mt-1 inline-flex rounded border border-violet-100 bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                        {field.typeHint}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <Eye className="h-3 w-3" />
                      {field.touches.length} touch
                      {field.touches.length === 1 ? "" : "es"}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {field.touches.map((touch, index) => (
                      <div
                        key={`${field.key}-${touch.nodeId}-${touch.localField}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div
                            className="truncate font-semibold text-slate-700"
                            title={touch.nodeLabel}
                          >
                            {touch.nodeLabel}
                          </div>
                          <div
                            className="truncate font-mono text-[10px] text-slate-400"
                            title={touch.localField}
                          >
                            {touch.nodeType} · {touch.localField}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${touch.direction === "writes"
                            ? "bg-fuchsia-50 text-fuchsia-700"
                            : "bg-indigo-50 text-indigo-700"
                            }`}
                        >
                          {touch.direction}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Floating Node Inspector Card */}
      <div className={`absolute right-4 top-[78px] bottom-4 w-[380px] z-50 flex flex-col bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200/80 overflow-hidden transition-all duration-300 ease-out origin-right ${selectedNode || selectedEdge
        ? "opacity-100 translate-x-0 scale-100 pointer-events-auto"
        : "opacity-0 translate-x-8 scale-95 pointer-events-none"
        }`}>
        {/* Inspector Header */}
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-violet-500" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {selectedNode ? "Node Configuration" : "Edge Configuration"}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {!isReadOnly && (
              <button
                onClick={deleteSelected}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                title="Delete Selected"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button
              onClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                props.onSelectionChange?.(false);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-md transition-colors"
              title="Close Inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-white/50">
          {selectedNode ? (
            <div className="space-y-6 animate-in fade-in">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Node Label
                  </label>
                  <input
                    type="text"
                    disabled={isReadOnly}
                    value={selectedNode.data.label as string}
                    onChange={(e) =>
                      handleNodeChange("label", e.target.value)
                    }
                    className={`w-full p-2 text-sm border rounded outline-none font-mono ${isReadOnly
                      ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                      : "border-slate-300 focus:border-sky-500 text-slate-900 bg-white"
                      }`}
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
                          disabled={isReadOnly}
                          value={(selectedNode.data.toolName as string) || ""}
                          onChange={(e) => {
                            handleNodeChange("toolName", e.target.value);
                            handleNodeChange("input_mapping", {}); // reset mappings
                          }}
                          className={`w-full p-2.5 text-sm border rounded outline-none ${isReadOnly
                            ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                            : "border-slate-300 focus:border-emerald-500 bg-white"
                            }`}
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
                                  disabled={isReadOnly}
                                  value={currentVal}
                                  onChange={(e) =>
                                    handleMappingChange(
                                      "input_mapping",
                                      inputKey,
                                      e.target.value,
                                    )
                                  }
                                  className={`w-full p-1.5 text-xs border rounded outline-none ${isReadOnly
                                    ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                    : "border-slate-300 focus:border-emerald-500 bg-white"
                                    }`}
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
                            <input
                              type="text"
                              disabled={isReadOnly}
                              list="state-schema-keys"
                              placeholder="mcp_response"
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
                              className={`w-full p-1.5 text-xs border rounded outline-none ${isReadOnly
                                ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                : "border-slate-300 focus:border-emerald-500 bg-white"
                                }`}
                            />
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
                        disabled={isReadOnly}
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
                        className={`w-full p-2.5 text-sm border rounded outline-none min-h-[100px] ${isReadOnly
                          ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                          : "border-slate-300 focus:border-amber-500 bg-slate-50 text-slate-900"
                          }`}
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
                        !isReadOnly && (
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
                        )
                      ) : (
                        <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Custom Engine
                            </span>
                            {!isReadOnly && (
                              <button
                                onClick={() =>
                                  handleNodeChange("model_config", undefined)
                                }
                                className="text-[10px] text-red-500 hover:text-red-700 font-semibold hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-gray-600">
                              Provider
                            </label>
                            <select
                              disabled={isReadOnly}
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
                              className={`w-full p-1.5 text-xs border rounded outline-none ${isReadOnly
                                ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                : "border-slate-300 bg-white text-slate-900"
                                }`}
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
                              disabled={isReadOnly}
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
                              className={`w-full p-1.5 text-xs border rounded outline-none ${isReadOnly
                                ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                : "border-slate-300 bg-white text-slate-900"
                                }`}
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
                                disabled={isReadOnly}
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
                                className={`w-full p-1.5 text-xs border rounded outline-none font-mono ${isReadOnly
                                  ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                  : "border-slate-300 bg-white text-slate-900"
                                  }`}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-semibold text-gray-600">
                                Max Tokens
                              </label>
                              <input
                                type="number"
                                disabled={isReadOnly}
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
                                className={`w-full p-1.5 text-xs border rounded outline-none font-mono ${isReadOnly
                                  ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                  : "border-slate-300 bg-white text-slate-900"
                                  }`}
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
                                        disabled={isReadOnly}
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
                                        className={`flex-1 p-1.5 text-xs border rounded outline-none ${isReadOnly
                                          ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                          : "border-slate-300 focus:border-amber-500 bg-white text-slate-900"
                                          }`}
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
                                      {!isReadOnly && (
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
                                      )}
                                    </div>
                                  ))}
                                  {!isReadOnly && (
                                    <button
                                      onClick={() => {
                                        const newArr = Array.isArray(
                                          currentVal,
                                        )
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
                                  )}
                                </div>
                              ) : (
                                <select
                                  disabled={isReadOnly}
                                  value={currentVal || ""}
                                  onChange={(e) =>
                                    handleMappingChange(
                                      "input_mapping",
                                      inputKey,
                                      e.target.value,
                                    )
                                  }
                                  className={`w-full p-1.5 text-xs border rounded outline-none ${isReadOnly
                                    ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                    : "border-slate-300 focus:border-amber-500 bg-white"
                                    }`}
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
                              <input
                                type="text"
                                disabled={isReadOnly}
                                list="state-schema-keys"
                                placeholder={outputKey}
                                value={currentVal}
                                onChange={(e) =>
                                  handleMappingChange(
                                    "output_mapping",
                                    outputKey,
                                    e.target.value,
                                  )
                                }
                                className={`w-full p-1.5 text-xs border rounded outline-none ${isReadOnly
                                  ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                  : "border-slate-300 focus:border-amber-500 bg-white text-slate-900"
                                  }`}
                              />
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
                        disabled={isReadOnly}
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
                        className={`w-full p-2.5 text-sm border rounded outline-none min-h-[100px] ${isReadOnly
                          ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                          : "border-slate-300 focus:border-sky-500 bg-slate-50 text-slate-900"
                          }`}
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
                        readOnly={isReadOnly} // <-- Lock SchemaViewer
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
                              disabled={isReadOnly}
                              value={currentVal}
                              onChange={(e) =>
                                handleMappingChange(
                                  "initialization_mapping",
                                  payloadKey,
                                  e.target.value,
                                )
                              }
                              className={`w-full p-1.5 text-xs border rounded outline-none ${isReadOnly
                                ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                : "border-slate-300 focus:border-sky-500 bg-white"
                                }`}
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
                        disabled={isReadOnly}
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
                        className={`w-full p-2.5 text-sm border rounded outline-none min-h-[100px] ${isReadOnly
                          ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                          : "border-slate-300 focus:border-purple-500 bg-slate-50 text-slate-900"
                          }`}
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
                        readOnly={isReadOnly} // <-- Lock SchemaViewer
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
                              disabled={isReadOnly}
                              value={currentVal}
                              onChange={(e) =>
                                handleMappingChange(
                                  "extraction_mapping",
                                  payloadKey,
                                  e.target.value,
                                )
                              }
                              className={`w-full p-1.5 text-xs border rounded outline-none ${isReadOnly
                                ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                : "border-slate-300 focus:border-purple-500 bg-white text-slate-900"
                                }`}
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

                    {/* File Exports */}
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
                            {!isReadOnly && (
                              <button
                                onClick={() => {
                                  const newExports = [
                                    ...((selectedNode.data
                                      .exports as any[]) || []),
                                  ];
                                  newExports.splice(index, 1);
                                  handleNodeChange("exports", newExports);
                                }}
                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove Export"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <div className="space-y-1.5 pr-6">
                              <label className="text-[10px] font-semibold text-gray-600">
                                Format
                              </label>
                              <select
                                disabled={isReadOnly}
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
                                className={`w-full p-1.5 text-xs border rounded outline-none ${isReadOnly
                                  ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                  : "border-slate-300 focus:border-rose-500 bg-white text-slate-900"
                                  }`}
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
                                disabled={isReadOnly}
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
                                className={`w-full p-1.5 text-xs border rounded outline-none ${isReadOnly
                                  ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                  : "border-slate-300 focus:border-rose-500 bg-white text-slate-900"
                                  }`}
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

                            {exp.format === "pdf" && (
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold text-gray-600">
                                  Layout Instructions (Optional)
                                </label>
                                <textarea
                                  disabled={isReadOnly}
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
                                  className={`w-full p-2 text-xs border rounded outline-none min-h-[60px] ${isReadOnly
                                    ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                    : "border-slate-300 focus:border-rose-500 bg-white text-slate-900"
                                    }`}
                                />
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-semibold text-gray-600">
                                Target Output Key
                              </label>
                              <input
                                type="text"
                                disabled={isReadOnly}
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
                                className={`w-full p-1.5 text-xs border rounded outline-none font-mono ${isReadOnly
                                  ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                                  : "border-slate-300 focus:border-rose-500 bg-white text-slate-900"
                                  }`}
                              />
                            </div>
                          </div>
                        ),
                      )}

                      {!isReadOnly && (
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
                      )}
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
                          disabled={isReadOnly}
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
                          className={`w-full p-1.5 text-xs border rounded outline-none ${isReadOnly
                            ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                            : "border-slate-300 focus:border-orange-500 bg-white"
                            }`}
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
                  disabled={isReadOnly}
                  placeholder="e.g. priority == 'high'"
                  value={(selectedEdge.data?.label as string) || ""}
                  onChange={(e) => handleEdgeChange("label", e.target.value)}
                  className={`w-full p-2 text-sm border rounded outline-none font-mono ${isReadOnly
                    ? "bg-slate-100 cursor-not-allowed border-slate-200 text-slate-500"
                    : "border-slate-300 focus:border-orange-500 text-slate-900"
                    }`}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
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
