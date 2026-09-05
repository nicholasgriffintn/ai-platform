import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useCopyToClipboard } from "@ngriffin_uk/polychat-utility-react";
import { Check, Copy } from "lucide-react";
import { type JSX, useState } from "react";

interface JsonViewProps {
  data: unknown;
  defaultExpandedDepth?: number;
}

const MAX_INLINE_STRING = 400;
const MAX_VISIBLE_BRANCH_CHILDREN = 100;

export const JsonView = ({ data, defaultExpandedDepth = 1 }: JsonViewProps) => {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [fullyExpandedBranches, setFullyExpandedBranches] = useState<Record<string, boolean>>({});
  const { copied, copy } = useCopyToClipboard();

  const toggleExpand = (path: string, isExpanded: boolean) => {
    setOverrides((prev) => ({ ...prev, [path]: !isExpanded }));
  };

  const renderValue = (value: unknown, path: string, depth: number): JSX.Element => {
    if (value === null) {
      return <span className="text-muted-foreground">null</span>;
    }

    if (value === undefined) {
      return <span className="text-muted-foreground">undefined</span>;
    }

    if (typeof value === "boolean") {
      return <span className="text-active-work">{value.toString()}</span>;
    }

    if (typeof value === "number") {
      return <span className="text-success">{value}</span>;
    }

    if (typeof value === "string") {
      const truncated =
        value.length > MAX_INLINE_STRING ? `${value.slice(0, MAX_INLINE_STRING)}…` : value;

      return (
        <span className="break-words text-failure" title={value}>
          "{truncated}"
        </span>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground">[]</span>;
      }

      return renderBranch(path, depth, `Array[${value.length}]`, value.length, (index) => ({
        key: `${path}-${index}`,
        label: String(index),
        value: value[index],
      }));
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record);

      if (keys.length === 0) {
        return <span className="text-muted-foreground">{"{}"}</span>;
      }

      return renderBranch(path, depth, `Object{${keys.length}}`, keys.length, (index) => {
        const key = keys[index];

        return {
          key: `${path}-${key}`,
          label: key,
          value: record[key],
        };
      });
    }

    return <span>{JSON.stringify(value)}</span>;
  };

  const renderBranch = (
    path: string,
    depth: number,
    summary: string,
    childCount: number,
    childAt: (index: number) => { key: string; label: string; value: unknown },
  ): JSX.Element => {
    const isExpanded = overrides[path] ?? depth < defaultExpandedDepth;
    const showAllChildren = fullyExpandedBranches[path] ?? false;
    const visibleChildCount = showAllChildren
      ? childCount
      : Math.min(childCount, MAX_VISIBLE_BRANCH_CHILDREN);
    const visibleChildren = Array.from({ length: visibleChildCount }, (_, index) => childAt(index));

    return (
      <div>
        <button
          type="button"
          className="cursor-pointer text-foreground hover:text-active-work"
          onClick={() => toggleExpand(path, isExpanded)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "▼" : "▶"} {summary}
        </button>
        {isExpanded && (
          <div className="ml-2 border-l border-border-strong pl-4">
            {visibleChildren.map((child) => (
              <div key={child.key} className="my-1">
                <span className="font-medium text-foreground">{child.label}: </span>
                {renderValue(child.value, child.key, depth + 1)}
              </div>
            ))}
            {childCount > MAX_VISIBLE_BRANCH_CHILDREN ? (
              <button
                type="button"
                className="my-1 cursor-pointer text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                onClick={() =>
                  setFullyExpandedBranches((current) => ({
                    ...current,
                    [path]: !showAllChildren,
                  }))
                }
              >
                {showAllChildren
                  ? "Show fewer entries"
                  : `Show ${childCount - MAX_VISIBLE_BRANCH_CHILDREN} more entries`}
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      data-responsetype="json"
      className="relative mt-1 overflow-x-auto rounded border border-border bg-selection p-2 pr-9 text-xs"
    >
      <Button
        variant="icon"
        size="xs"
        onClick={() => copy(JSON.stringify(data, null, 2))}
        className="absolute right-1.5 top-1.5"
        aria-label={copied ? "Payload copied" : "Copy payload"}
        title={copied ? "Copied" : "Copy payload"}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </Button>
      {renderValue(data, "root", 0)}
    </div>
  );
};
