import { MemoizedMarkdown } from "../markdown";
import { JsonView } from "./JsonView";
import type { ToolInteractionHandler } from "./registry";
import { useCustomResponseView } from "./registry";

export interface CustomViewProps {
  messageContent: string;
  data: any;
  toolName?: string;
  embedded: boolean;
  onToolInteraction?: ToolInteractionHandler;
}

export function CustomView({
  messageContent,
  data,
  toolName,
  embedded,
  onToolInteraction,
}: CustomViewProps) {
  const customData = data.data || data;
  const renderView = useCustomResponseView(toolName ?? data.name);

  if (renderView) {
    return renderView({ data: customData, embedded, onToolInteraction });
  }

  return (
    <>
      <JsonView data={customData} />
      {typeof messageContent === "string" && (
        <div className="mt-6">
          <MemoizedMarkdown>{messageContent}</MemoizedMarkdown>
        </div>
      )}
    </>
  );
}
