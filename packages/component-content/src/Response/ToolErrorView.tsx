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
      className="space-y-2 rounded-md border border-failure/45 bg-failure/12 p-3 text-sm"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-failure" aria-hidden="true" />
        <MemoizedMarkdown className="min-w-0 break-words text-failure">{message}</MemoizedMarkdown>
      </div>
      {details && (
        <details className="pl-6">
          <summary className="cursor-pointer text-xs text-failure/80 hover:text-failure">
            Details
          </summary>
          <div className="mt-2">{details}</div>
        </details>
      )}
    </div>
  );
}
