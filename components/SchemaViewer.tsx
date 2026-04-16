"use client";

import { useState } from "react";
import { SchemaEditor, SchemaNode } from "./SchemaEditor";
import { Maximize2, X, Braces } from "lucide-react";

interface SchemaViewerProps {
  nodes: SchemaNode[];
  setNodes: (nodes: SchemaNode[]) => void;
  title?: string;
  addButtonText?: string;
}

const ReadOnlyNode = ({
  node,
  depth = 0,
}: {
  node: SchemaNode;
  depth?: number;
}) => {
  const typeLower = (node.typeHint || "").toLowerCase().trim();
  const hasChildren =
    (typeLower === "object" ||
      typeLower === "dict" ||
      typeLower === "array<object>" ||
      typeLower === "object[]") &&
    node.children &&
    node.children.length > 0;

  return (
    <div
      className={`flex flex-col gap-1 ${depth > 0 ? "ml-4 pl-3 border-l-2 border-slate-200" : "mt-1"}`}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold text-slate-800">
          {node.key || <span className="italic text-slate-400">unnamed</span>}
        </span>
        <span className="text-emerald-600 font-mono text-[11px] px-1.5 py-0.5 bg-emerald-50 rounded border border-emerald-100">
          {node.typeHint}
          {node.isNullable ? "?" : ""}
        </span>
      </div>
      {hasChildren && (
        <div className="flex flex-col">
          {node.children?.map((child) => (
            <ReadOnlyNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const SchemaViewer = ({
  nodes,
  setNodes,
  title = "Schema Editor",
  addButtonText,
}: SchemaViewerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      {/* Read-only view */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 transition-all hover:border-slate-300 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Braces className="w-4 h-4 text-emerald-500" /> Schema Overview
          </div>
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors text-slate-700 shadow-sm"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-500" /> Edit Schema
          </button>
        </div>

        {nodes.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2 text-center">
            No properties defined.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
            {nodes.map((node) => (
              <ReadOnlyNode key={node.id} node={node} />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Braces className="w-5 h-5 text-emerald-500" /> {title}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Modify the structure and types of your schema.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/50">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <SchemaEditor
                  nodes={nodes}
                  setNodes={setNodes}
                  addButtonText={addButtonText}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-200 bg-white flex justify-end shrink-0 gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
