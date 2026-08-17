import { QueryClient, QueryClientProvider, type QueryClientConfig } from "@tanstack/react-query";
import { shouldRetryApiQuery } from "@ngriffin_uk/polychat-library-client/retry";
import {
	noopSurfaceAnalytics,
	type SurfaceAnalytics,
	type SurfaceControls,
} from "@ngriffin_uk/polychat-library-surface";
import { createContext, useContext, useState, type ReactNode } from "react";

export interface SurfaceControlsProviderProps<NavigationIntent, SelectedFile> {
	children?: ReactNode;
	controls: SurfaceControls<NavigationIntent, SelectedFile>;
}

export function createSurfaceControlsContext<NavigationIntent, SelectedFile>() {
	const SurfaceControlsContext = createContext<SurfaceControls<
		NavigationIntent,
		SelectedFile
	> | null>(null);

	function SurfaceControlsProvider({
		children,
		controls,
	}: SurfaceControlsProviderProps<NavigationIntent, SelectedFile>) {
		return (
			<SurfaceControlsContext.Provider value={controls}>{children}</SurfaceControlsContext.Provider>
		);
	}

	function useSurfaceControls(): SurfaceControls<NavigationIntent, SelectedFile> {
		const controls = useContext(SurfaceControlsContext);
		if (!controls) {
			throw new Error("useSurfaceControls must be used within a SurfaceControlsProvider");
		}
		return controls;
	}

	return { SurfaceControlsProvider, useSurfaceControls };
}

export interface PolychatProviderProps {
	children: ReactNode;
	queryClient?: QueryClient;
	queryClientConfig?: QueryClientConfig;
}

export function createPolychatQueryClient(config: QueryClientConfig = {}): QueryClient {
	return new QueryClient({
		...config,
		defaultOptions: {
			...config.defaultOptions,
			queries: {
				staleTime: 1000 * 60 * 5,
				retry: shouldRetryApiQuery,
				...config.defaultOptions?.queries,
			},
		},
	});
}

export function PolychatProvider({
	children,
	queryClient,
	queryClientConfig,
}: PolychatProviderProps) {
	const [client] = useState(() => queryClient ?? createPolychatQueryClient(queryClientConfig));
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const AnalyticsContext = createContext<SurfaceAnalytics>(noopSurfaceAnalytics);

export interface AnalyticsProviderProps {
	analytics: SurfaceAnalytics;
	children: ReactNode;
}

export function AnalyticsProvider({ analytics, children }: AnalyticsProviderProps) {
	return <AnalyticsContext.Provider value={analytics}>{children}</AnalyticsContext.Provider>;
}

/** Render packages report through this; without a provider the events are dropped. */
export function useAnalytics(): SurfaceAnalytics {
	return useContext(AnalyticsContext);
}
