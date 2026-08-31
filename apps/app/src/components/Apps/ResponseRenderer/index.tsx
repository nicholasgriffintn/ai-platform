import { ToolResultCard } from "@ngriffin_uk/polychat-component-capabilities";
import { ResponseView, type ToolInteractionHandler } from "@ngriffin_uk/polychat-component-content";
import type { RenderableTool } from "@ngriffin_uk/polychat-schemas";

interface ResponseRendererProps {
  app?: RenderableTool;
  result: Record<string, any>;
  onReset?: () => void;
  responseType?: string;
  className?: string;
  embedded?: boolean;
  renderer?: string;
  onToolInteraction?: ToolInteractionHandler;
}

export const ResponseRenderer = ({
  app,
  result,
  onReset,
  responseType,
  className = "",
  embedded = false,
  renderer,
  onToolInteraction,
}: ResponseRendererProps) => {
  const response = (
    <ResponseView
      result={result}
      responseType={responseType || app?.responseSchema.type}
      renderer={renderer}
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
