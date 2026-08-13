import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PolychatProvider } from "@ngriffin_uk/polychat-library-react";
import { useEffect } from "react";
import { Outlet, isRouteErrorResponse, ScrollRestoration } from "react-router";

import { AnalyticsBootstrap } from "~/components/Core/AnalyticsBootstrap";
import { AppInitializer } from "~/components/Core/AppInitializer";
import { AppShell } from "~/components/Core/AppShell";
import { CaptchaProvider } from "~/components/HCaptcha/CaptchaProvider";
import { LoadingSpinner } from "~/components/LoadingSpinner";
import { ServiceWorkerRegistration } from "~/components/Core/ServiceWorkerRegistration";
import { Toaster } from "@ngriffin_uk/polychat-component-ui";
import { useTrackEvent } from "~/hooks/use-track-event";
import ErrorRoute from "~/pages/error";
import { LoadingProvider } from "~/state/contexts/LoadingContext";
import type { Route } from "./+types/root";

import { shouldShowDevTools } from "~/constants";
import { webSurfaceControls } from "~/lib/surface-controls";
import { SurfaceControlsProvider } from "~/lib/surface-context";

export const Layout = ({ children }: { children: React.ReactNode }) => {
	return (
		<AppShell>
			<SurfaceControlsProvider controls={webSurfaceControls}>
				<PolychatProvider>{children}</PolychatProvider>
			</SurfaceControlsProvider>
		</AppShell>
	);
};

export default function Root() {
	return (
		<>
			<LoadingProvider>
				<AppInitializer>
					<CaptchaProvider>
						<ScrollRestoration />
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
			<LoadingSpinner message="Ruffling feathers, finding perches..." />
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
			error.status === 404
				? "This page seems to have flown off. Check the address, or head back home."
				: error.statusText || details;
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
