import React from "react";

export const RecursiveJsonViewer = ({ data }: { data: any }) => {
  if (data === null)
    return <span className="text-gray-400 italic text-sm">null</span>;
  if (typeof data === "boolean")
    return (
      <span className="text-purple-600 font-mono text-sm bg-purple-50 px-1.5 py-0.5 rounded">
        {data ? "true" : "false"}
      </span>
    );
  if (typeof data === "number")
    return <span className="text-blue-600 font-mono text-sm">{data}</span>;
  if (typeof data === "string")
    return (
      <span className="text-emerald-700 text-sm break-words leading-relaxed">
        "{data}"
      </span>
    );

  if (Array.isArray(data)) {
    if (data.length === 0)
      return <span className="text-gray-400 text-sm">[]</span>;
    return (
      <div className="flex flex-col gap-2 mt-1 w-full">
        {data.map((item, idx) => (
          <div
            key={idx}
            className="flex gap-3 items-start border-l-2 border-indigo-200 hover:border-indigo-400 transition-colors pl-3 ml-1.5"
          >
            <span className="text-sm font-mono text-indigo-700 mt-1 shrink-0 bg-indigo-50 px-1 rounded-sm">
              {idx}
            </span>
            <div className="flex-1 min-w-0 overflow-hidden">
              <RecursiveJsonViewer data={item} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data);
    if (entries.length === 0)
      return <span className="text-gray-400 text-sm">{"{}"}</span>;
    return (
      <div className="flex flex-col gap-2 w-full">
        {entries.map(([key, val]) => {
          const isComplex = typeof val === "object" && val !== null;
          return (
            <div
              key={key}
              className={`${isComplex ? "flex-col items-start" : "flex items-baseline gap-2"} flex w-full`}
            >
              <span className="font-semibold text-slate-700 text-sm shrink-0">
                {key}:
              </span>
              {isComplex ? (
                <div className="w-full border-l-2 border-slate-200 hover:border-slate-400 transition-colors pl-3 ml-1.5 mt-1.5">
                  <RecursiveJsonViewer data={val} />
                </div>
              ) : (
                <div className="min-w-0 break-words">
                  <RecursiveJsonViewer data={val} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return <span className="text-sm text-gray-500">Unknown</span>;
};
