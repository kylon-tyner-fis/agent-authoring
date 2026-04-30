"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Wrench, Loader2, Check, Copy } from "lucide-react";
import { ToolConfig } from "@/src/lib/types/constants";
import { v4 as uuidv4 } from "uuid";
import { SchemaNode } from "@/src/components/shared/json-tools/SchemaEditor";
import { SchemaViewer } from "@/src/components/shared/json-tools/SchemaViewer";

const parseSchema = (schema: Record<string, any>): SchemaNode[] => {
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

export default function ToolEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const isNew = id === "new";

  const [tool, setTool] = useState<ToolConfig>({
    id: "",
    name: "",
    description: "",
    prompt_template: "",
    input_schema: {},
    output_schema: {},
  });

  const [inputNodes, setInputNodes] = useState<SchemaNode[]>([]);
  const [outputNodes, setOutputNodes] = useState<SchemaNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyConfig = async () => {
    const snapshot = {
      name: tool.name,
      description: tool.description,
      prompt_template: tool.prompt_template,
      input_schema: compileSchema(inputNodes),
      output_schema: compileSchema(outputNodes),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isNew) {
          setIsLoading(false);
          return;
        }

        const toolData = await fetch(`/api/tools/${id}`).then((res) =>
          res.json(),
        );

        if (toolData?.tool) {
          setTool(toolData.tool);
          setInputNodes(parseSchema(toolData.tool.input_schema || {}));
          setOutputNodes(parseSchema(toolData.tool.output_schema || {}));
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, isNew]);

  const handleSave = async () => {
    const finalId = tool.id || uuidv4();

    const finalTool = {
      ...tool,
      id: finalId,
      input_schema: compileSchema(inputNodes),
      output_schema: compileSchema(outputNodes),
    };

    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalTool),
      });

      if (res.ok) {
        router.push("/tools");
      }
    } catch (error) {
      console.error("Error saving tool:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
        <button
          onClick={() => router.push("/tools")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyConfig}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
          >
            {isCopied ? (
              <Check className="w-4 h-4 text-amber-700" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {isCopied ? "Copied!" : "Copy Config"}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            <Save className="w-4 h-4" /> Save Tool
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" /> Tool Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">
                  Tool Name
                </label>
                <input
                  type="text"
                  value={tool.name}
                  onChange={(e) => setTool({ ...tool, name: e.target.value })}
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-amber-500 text-slate-900"
                  placeholder="e.g. Database Query"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">
                  Internal ID
                </label>
                <input
                  type="text"
                  value={tool.id || "Generated on save"}
                  disabled
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-slate-50 text-slate-500 font-mono"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-semibold text-gray-600">
                  Description
                </label>
                <input
                  type="text"
                  value={tool.description}
                  onChange={(e) =>
                    setTool({ ...tool, description: e.target.value })
                  }
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-amber-500 text-slate-900"
                  placeholder="What does this tool do?"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Prompt Template
            </h2>
            <p className="text-xs text-slate-500">
              Use double braces{" "}
              <code className="bg-slate-100 px-1 rounded text-amber-700">
                {"{{variable_name}}"}
              </code>{" "}
              to inject inputs.
            </p>
            <textarea
              rows={6}
              value={tool.prompt_template}
              onChange={(e) =>
                setTool({ ...tool, prompt_template: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-amber-500 resize-none text-sm font-mono text-slate-900 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white min-w-0 p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Expected Inputs
              </h2>
              <SchemaViewer
                title="Expected Inputs"
                nodes={inputNodes}
                setNodes={setInputNodes}
                addButtonText="Add Input Field"
              />
            </div>

            <div className="bg-white min-w-0 p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Expected Outputs
              </h2>
              <SchemaViewer
                title="Expected Outputs"
                nodes={outputNodes}
                setNodes={setOutputNodes}
                addButtonText="Add Output Field"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
