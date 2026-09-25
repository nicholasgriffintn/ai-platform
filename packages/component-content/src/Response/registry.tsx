import { createContext, type ReactNode, useContext } from "react";

export type ToolInteractionAction = "useAsPrompt" | "submitPrompt";

export type ToolInteractionHandler = (
  toolName: string,
  action: ToolInteractionAction,
  data: Record<string, any>,
) => void | Promise<void>;

export interface CustomResponseViewProps {
  data: unknown;
  embedded: boolean;
  onToolInteraction?: ToolInteractionHandler;
  toolName?: string;
}

export type CustomResponseViewRenderer = (props: CustomResponseViewProps) => ReactNode;

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
