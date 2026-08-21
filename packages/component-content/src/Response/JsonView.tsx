import { useCopyToClipboard } from "@ngriffin_uk/polychat-utility-react";
import { Check, Copy } from "lucide-react";
import { type JSX, useState } from "react";

interface JsonViewProps {
  data: unknown;
  defaultExpandedDepth?: number;
}

const MAX_INLINE_STRING = 400;

export const JsonView = ({ data, defaultExpandedDepth = 1 }: JsonViewProps) => {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const { copied, copy } = useCopyToClipboard();

  const toggleExpand = (path: string, isExpanded: boolean) => {
    setOverrides((prev) => ({ ...prev, [path]: !isExpanded }));
  };

  const renderValue = (value: unknown, path: string, depth: number): JSX.Element => {
    if (value === null) {
      return <span className="text-zinc-500 dark:text-zinc-400">null</span>;
    }

    if (value === undefined) {
      return <span className="text-zinc-500 dark:text-zinc-400">undefined</span>;
    }

    if (typeof value === "boolean") {
      return <span className="text-blue-600 dark:text-blue-400">{value.toString()}</span>;
    }

    if (typeof value === "number") {
      return <span className="text-green-600 dark:text-green-400">{value}</span>;
    }

    if (typeof value === "string") {
      const truncated =
        value.length > MAX_INLINE_STRING ? `${value.slice(0, MAX_INLINE_STRING)}…` : value;

      return (
        <span className="break-words text-red-600 dark:text-red-400" title={value}>
          "{truncated}"
        </span>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-zinc-500 dark:text-zinc-400">[]</span>;
      }

      return renderBranch(
        path,
        depth,
        `Array[${value.length}]`,
        value.map((item, index) => ({
          key: `${path}-${index}`,
          label: String(index),
          value: item,
        })),
      );
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record);

      if (keys.length === 0) {
        return <span className="text-zinc-500 dark:text-zinc-400">{"{}"}</span>;
      }

      return renderBranch(
        path,
        depth,
        `Object{${keys.length}}`,
        keys.map((key) => ({
          key: `${path}-${key}`,
          label: key,
          value: record[key],
        })),
      );
    }

    return <span>{JSON.stringify(value)}</span>;
  };

  const renderBranch = (
    path: string,
    depth: number,
    summary: string,
    children: Array<{ key: string; label: string; value: unknown }>,
  ): JSX.Element => {
    const isExpanded = overrides[path] ?? depth < defaultExpandedDepth;

    return (
      <div>
        <button
          type="button"
          className="cursor-pointer text-zinc-700 hover:text-blue-500 dark:text-zinc-300 dark:hover:text-blue-400"
          onClick={() => toggleExpand(path, isExpanded)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "▼" : "▶"} {summary}
        </button>
        {isExpanded && (
          <div className="ml-2 border-l border-zinc-300 pl-4 dark:border-zinc-600">
            {children.map((child) => (
              <div key={child.key} className="my-1">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {child.label}:{" "}
                </span>
                {renderValue(child.value, child.key, depth + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      data-responsetype="json"
      className="relative mt-1 overflow-x-auto rounded border border-zinc-200 bg-off-white-highlight/50 p-2 pr-9 text-xs dark:border-zinc-700 dark:bg-zinc-800/50"
    >
      <button
        type="button"
        onClick={() => copy(JSON.stringify(data, null, 2))}
        className="absolute right-1.5 top-1.5 cursor-pointer rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/60 dark:hover:text-zinc-100"
        aria-label={copied ? "Payload copied" : "Copy payload"}
        title={copied ? "Copied" : "Copy payload"}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      {renderValue(data, "root", 0)}
    </div>
  );
};
