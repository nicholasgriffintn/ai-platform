import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { MemoizedMarkdown } from "../markdown";

interface ToolErrorViewProps {
  message: string;
  details?: ReactNode;
}

export function ToolErrorView({ message, details }: ToolErrorViewProps) {
  return (
    <div
      data-responsetype="error"
      className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900/60 dark:bg-red-950/25"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
          aria-hidden="true"
        />
        <MemoizedMarkdown className="min-w-0 break-words text-red-800 dark:text-red-200">
          {message}
        </MemoizedMarkdown>
      </div>
      {details && (
        <details className="pl-6">
          <summary className="cursor-pointer text-xs text-red-700/80 hover:text-red-900 dark:text-red-300/80 dark:hover:text-red-100">
            Details
          </summary>
          <div className="mt-2">{details}</div>
        </details>
      )}
    </div>
  );
}
