import { createContext, type ReactNode, useContext } from "react";

export interface CustomResponseViewProps {
	data: unknown;
	embedded: boolean;
	onToolInteraction?: (
		toolName: string,
		action: "useAsPrompt",
		data: Record<string, unknown>,
	) => void;
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
	if (!name) return null;
	return views[name] ?? null;
}
