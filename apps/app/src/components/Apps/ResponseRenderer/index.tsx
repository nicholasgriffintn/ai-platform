import { ToolResultCard } from "@ngriffin_uk/polychat-component-capabilities";
import {
  ResponseView,
  type ResponseDisplay,
  type ToolInteractionHandler,
} from "@ngriffin_uk/polychat-component-content";
import type { RenderableTool } from "@ngriffin_uk/polychat-schemas";

interface ResponseRendererProps {
  app?: RenderableTool;
  result: Record<string, any>;
  onReset?: () => void;
  responseType?: string;
  responseDisplay?: ResponseDisplay;
  className?: string;
  embedded?: boolean;
  onToolInteraction?: ToolInteractionHandler;
}

export const ResponseRenderer = ({
  app,
  result,
  onReset,
  responseType,
  responseDisplay,
  className = "",
  embedded = false,
  onToolInteraction,
}: ResponseRendererProps) => {
  const response = (
    <ResponseView
      result={result}
      responseType={responseType || app?.responseSchema.type}
      responseDisplay={responseDisplay || app?.responseSchema.display}
      hasToolSchema={Boolean(app)}
      embedded={embedded}
      onToolInteraction={onToolInteraction}
    />
  );

  if (app && onReset) {
    return (
      <ToolResultCard
        name={app.name}
        theme={app.theme}
        icon={app.icon}
        message={result.data?.message}
        timestamp={result.data?.timestamp}
        onReset={onReset}
      >
        {response}
      </ToolResultCard>
    );
  }

  return <div className={className}>{response}</div>;
};
