import { createContext, type ReactNode, useContext } from "react";

/**
 * `useAsPrompt` fills the composer and leaves sending to the user; `submitPrompt` sends straight
 * away, for views whose control *is* the decision — a picker, a chooser, a confirmation.
 */
export type ToolInteractionAction = "useAsPrompt" | "submitPrompt";

export type ToolInteractionHandler = (
  toolName: string,
  action: ToolInteractionAction,
  data: Record<string, any>,
) => void;

export interface CustomResponseViewProps {
  data: unknown;
  embedded: boolean;
  onToolInteraction?: ToolInteractionHandler;
}

export type CustomResponseViewRenderer = (props: CustomResponseViewProps) => ReactNode;

/**
 * Tool responses that need host data — sandbox runs, research status, connector setup — are
 * registered by the application. Unknown names fall back to the raw JSON view.
 */
export type CustomResponseViewRegistry = Record<string, CustomResponseViewRenderer>;

const CustomResponseViewContext = createContext<CustomResponseViewRegistry>({});

export function CustomResponseViewProvider({
  children,
  views,
}: {
  children: ReactNode;
  views: CustomResponseViewRegistry;
}) {
  return (
    <CustomResponseViewContext.Provider value={views}>
      {children}
    </CustomResponseViewContext.Provider>
  );
}

export function useCustomResponseView(name: string | undefined): CustomResponseViewRenderer | null {
  const views = useContext(CustomResponseViewContext);

  if (!name) {
    return null;
  }

  return views[name] ?? null;
}
