import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";
import { Outlet, isRouteErrorResponse } from "react-router";

import { AnalyticsBootstrap } from "~/components/Core/AnalyticsBootstrap";
import { AppInitializer } from "~/components/Core/AppInitializer";
import { AppShell } from "~/components/Core/AppShell";
import { CaptchaProvider } from "~/components/HCaptcha/CaptchaProvider";
import { LoadingSpinner } from "~/components/LoadingSpinner";
import { ServiceWorkerRegistration } from "~/components/Core/ServiceWorkerRegistration";
import { Toaster } from "~/components/ui/sonner";
import { useTrackEvent } from "~/hooks/use-track-event";
import { shouldRetryApiQuery } from "~/lib/api/retry";
import ErrorRoute from "~/pages/error";
import { LoadingProvider } from "~/state/contexts/LoadingContext";
import type { Route } from "./+types/root";

import { shouldShowDevTools } from "~/constants";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5, // 5 minutes
			retry: shouldRetryApiQuery,
		},
	},
});

export const Layout = ({ children }: { children: React.ReactNode }) => {
	return (
		<AppShell>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</AppShell>
	);
};

export default function Root() {
	return (
		<>
			<LoadingProvider>
				<AppInitializer>
					<CaptchaProvider>
						<AnalyticsBootstrap />
						<Outlet />
						<ServiceWorkerRegistration />
						<Toaster />
					</CaptchaProvider>
				</AppInitializer>
			</LoadingProvider>
			<ReactQueryDevtools initialIsOpen={false} />
		</>
	);
}

export function HydrateFallback() {
	return (
		<div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)]">
			<LoadingSpinner />
		</div>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops! Something went wrong.";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	const { trackException } = useTrackEvent();

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404 ? "The requested page could not be found." : error.statusText || details;
	} else if (shouldShowDevTools() && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	useEffect(() => {
		if (error && error instanceof Error) {
			trackException(error, {
				message: "Error",
				details: error.message,
				stack: error.stack,
			});
			return;
		}

		trackException(new Error(details), {
			message: "Error",
			details,
			stack,
		});
	}, [details, error, stack, trackException]);

	return <ErrorRoute message={message} details={details} stack={stack || ""} />;
}
