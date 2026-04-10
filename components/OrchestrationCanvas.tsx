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
import { WorkflowNode } from "./nodes/WorkflowNode";
import { ShiftEdge } from "./edges/ShiftEdge";
import { MOCK_SKILLS } from "@/lib/constants";
import {
  Braces,
  Settings2,
  Bot,
  Hand,
  Trash2,
  GitMerge,
  Bug,
  Play,
  Flag,
} from "lucide-react";

const nodeTypes = { task: WorkflowNode, interrupt: WorkflowNode };
const edgeTypes = { shiftEdge: ShiftEdge };

const COLUMN_WIDTH = 350;
const ROW_HEIGHT = 200;

const initialNodes: Node[] = [
  {
    id: "triage",
    type: "task",
    position: { x: 0, y: 150 },
    data: { label: "triage", prompt: "Classify issue...", isStart: true },
  },
];

const getId = (type: string) => `${type}_${crypto.randomUUID()}`;

// 1. Define Props and Refs
export interface OrchestrationCanvasRef {
  getCanvasData: () => any;
}

export interface OrchestrationCanvasProps {
  onSkillsChange?: (skills: string[]) => void;
  initialData?: any;
}

// 2. The Internal Editor Component
const CanvasEditor = forwardRef<
  OrchestrationCanvasRef,
  OrchestrationCanvasProps
>((props, ref) => {
  const startingNodes = props.initialData?.nodes || initialNodes;
  const startingEdges = props.initialData?.edges || [];

  console.log("Starting Data", startingNodes, startingEdges);

  const [nodes, setNodes, onNodesChange] = useNodesState(startingNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(startingEdges);
  const { screenToFlowPosition, toObject, setViewport } = useReactFlow();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [dragPreview, setDragPreview] = useState<{
    x: number;
    y: number;
    type: string;
  } | null>(null);

  // State for the inline #hashtag skill picker
  const [skillMenu, setSkillMenu] = useState<{
    visible: boolean;
    filter: string;
  } | null>(null);

  const { x, y, zoom } = useViewport();

  // Expose data to ConfigPanel
  useImperativeHandle(ref, () => ({
    getCanvasData: () => toObject(),
  }));

  // Restore viewport if it exists
  useEffect(() => {
    if (props.initialData?.viewport) {
      setViewport(props.initialData.viewport);
    }
  }, [props.initialData, setViewport]);

  // --- THE REAL-TIME SKILL SCRAPER ---
  useEffect(() => {
    if (!props.onSkillsChange) return;

    const skillRegex = /#(\w+)/g;
    const foundSkills = new Set<string>();

    nodes.forEach((node) => {
      const prompt = (node.data?.prompt as string) || "";
      let match;
      while ((match = skillRegex.exec(prompt)) !== null) {
        foundSkills.add(match[1]);
      }
    });

    // Fire the callback with the unique list of skills
    props.onSkillsChange(Array.from(foundSkills));
  }, [nodes, props.onSkillsChange]);

  // --- CANVAS HANDLERS ---
  const onConnect = useCallback(
    (params: Connection) => {
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
    [setEdges],
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
            if (edge.data?.shift !== 0) {
              return { ...edge, data: { ...edge.data, shift: 0 } };
            }
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

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.types.includes("application/reactflow")
        ? "task"
        : null;
      if (!type) return;

      const position = screenToFlowPosition(
        { x: event.clientX, y: event.clientY },
        { snapToGrid: false },
      );
      const snappedX = Math.floor(position.x / COLUMN_WIDTH) * COLUMN_WIDTH;
      const snappedY = Math.floor(position.y / ROW_HEIGHT) * ROW_HEIGHT;
      setDragPreview({ x: snappedX, y: snappedY, type });
    },
    [screenToFlowPosition],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragPreview(null);
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const position = screenToFlowPosition(
        { x: event.clientX, y: event.clientY },
        { snapToGrid: false },
      );
      const snappedX = Math.floor(position.x / COLUMN_WIDTH) * COLUMN_WIDTH;
      const snappedY = Math.floor(position.y / ROW_HEIGHT) * ROW_HEIGHT;

      const newNode: Node = {
        id: getId(type),
        type,
        position: { x: snappedX, y: snappedY },
        data: { label: `new_${type}`, prompt: "", tools: [], isStart: false },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  // --- INSPECTOR HANDLERS ---
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

  const setAsStartNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isStart: n.id === selectedNodeId },
      })),
    );
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

  // --- HASHTAG SKILL PICKER LOGIC ---
  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (skillMenu?.visible) {
      if (e.key === "Escape") setSkillMenu(null);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    const textBefore = value.substring(0, cursor);
    const match = textBefore.match(/#(\w*)$/);

    if (match) {
      setSkillMenu({
        visible: true,
        filter: match[1].toLowerCase(),
      });
    } else {
      setSkillMenu(null);
    }

    handleNodeChange("prompt", value);
  };

  const selectSkill = (skillId: string) => {
    if (!selectedNodeId) return;
    const currentPrompt = (selectedNode?.data.prompt as string) || "";
    const el = document.activeElement as HTMLTextAreaElement;
    const cursor =
      el && el.selectionStart ? el.selectionStart : currentPrompt.length;

    // Replace the partial #hashtag with the full chosen #skillId
    const textBefore = currentPrompt
      .substring(0, cursor)
      .replace(/#(\w*)$/, `#${skillId} `);
    const textAfter = currentPrompt.substring(cursor);

    handleNodeChange("prompt", textBefore + textAfter);
    setSkillMenu(null);
  };

  return (
    <div className="flex h-full w-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-inner relative">
      <div className="flex-1 h-full relative border-r border-slate-200 overflow-hidden bg-slate-50">
        {/* DRAG TOOLBAR */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 bg-white/90 backdrop-blur p-3 rounded-lg shadow-xl border border-slate-200 w-[180px]">
          <div className="flex items-center justify-between mb-1 px-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Add to Workflow
            </p>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`p-1 rounded transition-colors ${showDebug ? "bg-red-100 text-red-600" : "text-slate-400 hover:bg-slate-100"}`}
              title="Toggle Debug Grid"
            >
              <Bug className="w-3 h-3" />
            </button>
          </div>
          <div
            className="p-2 border border-blue-200 bg-blue-50 text-blue-700 rounded cursor-grab flex items-center gap-2 hover:bg-blue-100 transition-colors"
            onDragStart={(e) => onDragStart(e, "task")}
            draggable
          >
            <Bot className="w-4 h-4" />{" "}
            <span className="text-xs font-semibold">Task</span>
          </div>
          <div
            className="p-2 border border-orange-200 bg-orange-50 text-orange-700 rounded cursor-grab flex items-center gap-2 hover:bg-orange-100 transition-colors"
            onDragStart={(e) => onDragStart(e, "interrupt")}
            draggable
          >
            <Hand className="w-4 h-4" />{" "}
            <span className="text-xs font-semibold">Interrupt</span>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
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
            setSkillMenu(null);
          }}
          onEdgeClick={(_, edge) => {
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null);
          }}
          onPaneClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setSkillMenu(null);
          }}
          snapToGrid={true}
          snapGrid={[COLUMN_WIDTH, ROW_HEIGHT]}
          defaultEdgeOptions={{
            type: "shiftEdge",
            markerEnd: { type: MarkerType.ArrowClosed },
          }}
          fitView
        >
          {showDebug && (
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
              {Array.from({ length: 20 }).map((_, i) => {
                const colIndex = i - 5;
                const lineX = x + colIndex * COLUMN_WIDTH * zoom;
                return (
                  <div
                    key={colIndex}
                    className="absolute top-0 bottom-0 border-l-2 border-dashed border-red-400/50 flex flex-col"
                    style={{ left: `${lineX}px` }}
                  >
                    <div className="bg-red-100/90 text-red-600 text-[10px] font-mono font-bold px-1.5 py-0.5 mt-4 ml-1 rounded whitespace-nowrap shadow-sm backdrop-blur-sm">
                      Col {colIndex} (x={colIndex * COLUMN_WIDTH})
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Drop Slot
              </span>
            </div>
          )}
          <Controls className="bg-white border-slate-200 shadow-sm mb-4 ml-4" />
        </ReactFlow>
      </div>

      {/* INSPECTOR PANE */}
      <div className="w-[320px] h-full bg-white flex flex-col shrink-0 border-l border-slate-200">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {selectedNode
                ? "Node Settings"
                : selectedEdge
                  ? "Edge Settings"
                  : "Global Settings"}
            </h2>
          </div>
          {(selectedNode || selectedEdge) && (
            <button
              onClick={deleteSelected}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-6 animate-in fade-in">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Node ID
                  </label>
                  <input
                    type="text"
                    value={selectedNode.data.label as string}
                    onChange={(e) => handleNodeChange("label", e.target.value)}
                    className="w-full p-2 text-sm border border-slate-300 rounded outline-none focus:border-blue-500 font-mono text-slate-900"
                  />
                </div>
                {selectedNode.type === "task" && (
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      System Prompt
                    </label>

                    <textarea
                      rows={6}
                      value={(selectedNode.data.prompt as string) || ""}
                      onKeyDown={handleTextareaKeyDown}
                      onChange={handleTextareaChange}
                      className="w-full p-2 text-sm border border-slate-300 rounded outline-none focus:border-blue-500 resize-none transition-all text-slate-900 leading-relaxed"
                      placeholder="Type # to search & add skills..."
                    />

                    {/* SKILL PICKER DROPDOWN */}
                    {skillMenu?.visible && (
                      <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1 top-full">
                        <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Select Skill
                        </div>
                        {MOCK_SKILLS.filter((s) =>
                          s.id.toLowerCase().includes(skillMenu.filter),
                        ).map((skill) => (
                          <button
                            key={skill.id}
                            onClick={() => selectSkill(skill.id)}
                            className="w-full text-left p-2.5 hover:bg-blue-50 flex flex-col gap-0.5 transition-colors border-b border-slate-50 last:border-0"
                          >
                            <span className="text-xs font-bold text-blue-700">
                              #{skill.id}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate">
                              {skill.description}
                            </span>
                          </button>
                        ))}
                        {MOCK_SKILLS.filter((s) =>
                          s.id.toLowerCase().includes(skillMenu.filter),
                        ).length === 0 && (
                          <div className="p-3 text-xs text-slate-400 text-center italic">
                            No matching skills found.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 pt-4 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Execution Role
                </label>
                <button
                  onClick={setAsStartNode}
                  disabled={selectedNode.data.isStart as boolean}
                  className={`w-full p-2 text-sm font-medium rounded flex items-center justify-center gap-2 transition-colors ${
                    selectedNode.data.isStart
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default"
                      : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {selectedNode.data.isStart ? (
                    <>
                      <Play className="w-4 h-4" /> Starting Node
                    </>
                  ) : (
                    <>
                      <Flag className="w-4 h-4" /> Set as Start Node
                    </>
                  )}
                </button>
                {!selectedNode.data.isStart && (
                  <p className="text-[10px] text-slate-400 text-center mt-1">
                    This will remove the start role from any other node.
                  </p>
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
          ) : (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 opacity-50 px-6 border-b border-slate-100">
                <Braces className="w-8 h-8 text-slate-400" />
                <p className="text-sm text-slate-500 leading-relaxed italic">
                  Select a node or edge to configure parameters.
                </p>
              </div>
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Canvas Options
                </h3>
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                    <Bug className="w-4 h-4 text-slate-400" />
                    <span>Debug Grid Lines</span>
                  </div>
                  <button
                    onClick={() => setShowDebug(!showDebug)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${showDebug ? "bg-blue-500" : "bg-slate-300"}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showDebug ? "translate-x-4" : "translate-x-1"}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

CanvasEditor.displayName = "CanvasEditor";

// 3. Exported Wrapper passing down props and refs
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
