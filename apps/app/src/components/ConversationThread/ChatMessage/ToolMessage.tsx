import { Terminal } from "lucide-react";

import { ResponseRenderer } from "~/components/Apps/ResponseRenderer";
import type { Message } from "~/types";

interface ToolMessageProps {
  message: Message;
  onToolInteraction?: (
    toolName: string,
    action: "useAsPrompt",
    data: Record<string, any>,
  ) => void;
}

export const ToolMessage = ({
  message,
  onToolInteraction,
}: ToolMessageProps) => {
  if (!message.data) return null;

  return (
    <div className="mb-2">
      <div className="text-xs font-medium text-blue-700 dark:text-blue-300 pt-1">
        <div className="flex items-start gap-2">
          <ToolIcon />
          {message.name} {message.status && `(${message.status})`}
        </div>
      </div>
      <div>
        <ResponseRenderer
          result={{
            status: message.status || "success",
            name: message.name || "Tool",
            content: message.content || "",
            data: message.data,
          }}
          responseType={
            typeof message.data === "object"
              ? message.data.responseType
              : undefined
          }
          responseDisplay={
            typeof message.data === "object"
              ? message.data.responseDisplay
              : undefined
          }
          className="mt-1"
          embedded={true}
          onToolInteraction={onToolInteraction}
        />
      </div>
    </div>
  );
};

export const ToolIcon = () => (
  <Terminal size={18} className="text-blue-600 dark:text-blue-400" />
);
