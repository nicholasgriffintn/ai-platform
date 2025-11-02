import { type JSX, useState } from "react";

interface JsonViewProps {
  data: Record<string, any>;
  expandedByDefault?: boolean;
}

export const JsonView = ({
  data,
  expandedByDefault = false,
}: JsonViewProps) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    root: expandedByDefault,
  });

  const toggleExpand = (path: string) => {
    setExpanded((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const renderValue = (value: any, path: string, depth = 0): JSX.Element => {
    if (value === null) {
      return <span className="text-gray-500 dark:text-zinc-400">null</span>;
    }

    if (value === undefined) {
      return (
        <span className="text-gray-500 dark:text-zinc-400">undefined</span>
      );
    }

    if (typeof value === "boolean") {
      return (
        <span className="text-blue-600 dark:text-blue-400">
          {value.toString()}
        </span>
      );
    }

    if (typeof value === "number") {
      return (
        <span className="text-green-600 dark:text-green-400">{value}</span>
      );
    }

    if (typeof value === "string") {
      return <span className="text-red-600 dark:text-red-400">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-500 dark:text-zinc-400">[]</span>;
      }

      const isExpanded = expanded[path] === true;

      return (
        <div>
          <button
            type="button"
            className="cursor-pointer text-gray-700 dark:text-zinc-300 hover:text-blue-500 dark:hover:text-blue-400"
            onClick={() => toggleExpand(path)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                toggleExpand(path);
              }
            }}
            tabIndex={0}
          >
            {isExpanded ? "▼" : "▶"} Array[{value.length}]
          </button>

          {isExpanded && (
            <div className="pl-4 border-l border-gray-300 dark:border-zinc-600 ml-2">
              {value.map((item, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: It works.
                <div key={`${path}-${index}`} className="my-1">
                  <span className="text-gray-500 dark:text-zinc-400">
                    {index}:{" "}
                  </span>
                  {renderValue(item, `${path}-${index}`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (typeof value === "object") {
      const keys = Object.keys(value);

      if (keys.length === 0) {
        return <span className="text-gray-500 dark:text-zinc-400">{"{}"}</span>;
      }

      const isExpanded = expanded[path] === true;

      return (
        <div>
          <button
            type="button"
            className="cursor-pointer text-gray-700 dark:text-zinc-300 hover:text-blue-500 dark:hover:text-blue-400"
            onClick={() => toggleExpand(path)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                toggleExpand(path);
              }
            }}
            tabIndex={0}
          >
            {isExpanded ? "▼" : "▶"} Object{"{"}
            {keys.length}
            {"}"}
          </button>
          {isExpanded && (
            <div className="pl-4 border-l border-gray-300 dark:border-zinc-600 ml-2">
              {keys.map((key) => (
                <div key={`${path}-${key}`} className="my-1">
                  <span className="text-gray-800 dark:text-zinc-200 font-medium">
                    {key}:{" "}
                  </span>
                  {renderValue(value[key], `${path}-${key}`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  return (
    <div className="mt-1 overflow-x-auto text-xs rounded bg-off-white-highlight/50 p-2 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
      {renderValue(data, "root")}
    </div>
  );
};
