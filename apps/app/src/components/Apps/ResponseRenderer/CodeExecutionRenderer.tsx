import { useState } from "react";
import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";

export function CodeExecutionRenderer({
  stdout,
  stderr,
  returnCode,
}: {
  stdout?: string;
  stderr?: string;
  returnCode?: number;
}) {
  const [showAllStdout, setShowAllStdout] = useState(false);
  const [showStderr, setShowStderr] = useState(false);

  const isSuccess = (returnCode ?? 0) === 0;
  const maxPreviewChars = 2000;

  const displayStdout = showAllStdout
    ? stdout || ""
    : (stdout || "").slice(0, maxPreviewChars);
  const hasMoreStdout = (stdout || "").length > maxPreviewChars;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        "border-zinc-200 dark:border-zinc-700",
        "bg-off-white dark:bg-zinc-800",
      )}
      aria-label="Code Execution Result"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Code Execution</div>
        <span
          className={cn(
            "text-xs px-2 py-1 rounded-full",
            isSuccess
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
          )}
          aria-label={isSuccess ? "Execution succeeded" : "Execution failed"}
        >
          {isSuccess ? "Success" : "Error"} (exit {returnCode ?? 0})
        </span>
      </div>

      <div className="mb-3">
        <div className="text-xs text-zinc-500 mb-1">Stdout</div>
        <pre
          className={cn(
            "rounded-md border bg-black text-white text-sm p-3 overflow-x-auto whitespace-pre-wrap",
            "border-zinc-200 dark:border-zinc-700",
          )}
          aria-label="Standard output"
        >
{displayStdout || ""}
        </pre>
        {hasMoreStdout && (
          <div className="mt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowAllStdout((v) => !v)}
              aria-label={showAllStdout ? "Show less" : "Show more"}
            >
              {showAllStdout ? "Show less" : "Show more"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-2"
              onClick={() => navigator.clipboard.writeText(stdout || "")}
              aria-label="Copy stdout"
            >
              Copy
            </Button>
          </div>
        )}
      </div>

      {(stderr || "").length > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-500">Stderr</div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowStderr((v) => !v)}
              aria-label={showStderr ? "Hide stderr" : "Show stderr"}
            >
              {showStderr ? "Hide" : "Show"}
            </Button>
          </div>
          {showStderr && (
            <pre
              className={cn(
                "mt-2 rounded-md border bg-red-950/50 text-red-200 text-sm p-3 overflow-x-auto whitespace-pre-wrap",
                "border-red-300/30 dark:border-red-800/50",
              )}
              aria-label="Standard error"
            >
{stderr || ""}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}