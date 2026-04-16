"use client";

import { Plus, Trash2, ListTree, CornerDownRight } from "lucide-react";

export interface SchemaNode {
  id: string;
  key: string;
  typeHint: string;
  isNullable: boolean;
  children?: SchemaNode[];
}

interface SchemaEditorProps {
  nodes: SchemaNode[];
  setNodes: (nodes: SchemaNode[]) => void;
  depth?: number;
  addButtonText?: string;
}

export const SchemaEditor = ({
  nodes,
  setNodes,
  depth = 0,
  addButtonText = "Add Property",
}: SchemaEditorProps) => {
  const updateNode = (id: string, updates: Partial<SchemaNode>) => {
    setNodes(nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  };

  const removeNode = (id: string) => setNodes(nodes.filter((n) => n.id !== id));
  const addNode = () =>
    setNodes([
      ...nodes,
      {
        id: Math.random().toString(),
        key: "",
        typeHint: "string",
        isNullable: false,
      },
    ]);

  return (
    <div className={`space-y-2 ${depth > 0 ? "mt-3" : ""}`}>
      {nodes.map((node) => {
        const typeLower = (node.typeHint || "").toLowerCase().trim();
        const isObject = typeLower === "object" || typeLower === "dict";
        const isArrayOfObject =
          typeLower === "array<object>" || typeLower === "object[]";
        const hasChildren = isObject || isArrayOfObject;

        return (
          <div
            key={node.id}
            className={`flex flex-col gap-2 ${depth > 0 ? "pl-2" : ""}`}
          >
            <div className="flex gap-2 items-center group relative">
              {depth > 0 && (
                <div className="absolute -left-6 top-1/2 w-4 border-b-2 border-l-2 border-emerald-200 rounded-bl h-10 -translate-y-10" />
              )}

              <input
                type="text"
                value={node.key}
                placeholder="Key (e.g. query)"
                onChange={(e) => updateNode(node.id, { key: e.target.value })}
                className="flex-1 p-2.5 min-w-0 text-sm border border-gray-300 rounded-lg outline-none font-mono focus:border-emerald-500 bg-white shadow-sm transition-all text-slate-900"
              />
              <span className="text-gray-400 font-mono">:</span>

              <input
                type="text"
                list="type-hints"
                value={node.typeHint}
                placeholder="Type (e.g. string)"
                onChange={(e) => {
                  const val = e.target.value;
                  const vLower = val.toLowerCase().trim();
                  const isComplex =
                    vLower === "object" ||
                    vLower === "dict" ||
                    vLower === "array<object>" ||
                    vLower === "object[]";
                  updateNode(node.id, {
                    typeHint: val,
                    ...(isComplex && !node.children ? { children: [] } : {}),
                  });
                }}
                className={`flex-[1.5] min-w-0 p-2.5 text-sm border border-gray-300 rounded-lg outline-none font-mono focus:border-emerald-500 shadow-sm transition-all ${
                  hasChildren
                    ? "bg-emerald-50 text-slate-900 border-emerald-200 font-bold"
                    : "bg-white text-slate-900"
                }`}
              />

              {!hasChildren && (
                <button
                  onClick={() =>
                    updateNode(node.id, { isNullable: !node.isNullable })
                  }
                  className={`px-3 py-2.5 text-xs font-bold rounded-lg border transition-colors ${
                    node.isNullable
                      ? "bg-amber-100 text-amber-700 border-amber-300 shadow-inner"
                      : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                  }`}
                  title="Toggle Nullable (?)"
                >
                  Optional (?)
                </button>
              )}
              <button
                onClick={() => removeNode(node.id)}
                className="p-2.5 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {hasChildren && (
              <div className="ml-6 pl-4 border-l-2 border-emerald-100 py-1">
                <div className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ListTree className="w-3 h-3" />
                  {isArrayOfObject
                    ? "Array Item Properties"
                    : "Object Properties"}
                </div>
                <SchemaEditor
                  nodes={node.children || []}
                  setNodes={(newChildren) =>
                    updateNode(node.id, { children: newChildren })
                  }
                  depth={depth + 1}
                />
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addNode}
        className={`flex items-center gap-1.5 font-semibold text-xs py-1.5 transition-colors ${
          depth === 0
            ? "w-full mt-4 py-2.5 border-2 border-dashed border-emerald-200 rounded-lg text-emerald-600 hover:bg-emerald-50 justify-center"
            : "text-emerald-500 hover:text-emerald-700"
        }`}
      >
        {depth === 0 ? (
          <Plus className="w-4 h-4" />
        ) : (
          <CornerDownRight className="w-3.5 h-3.5" />
        )}
        {addButtonText}
      </button>
    </div>
  );
};
