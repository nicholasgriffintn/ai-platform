import { CustomResponseViewProvider } from "@ngriffin_uk/polychat-component-content";
import { LinkProvider, LoadingSpinner } from "@ngriffin_uk/polychat-component-ui";
import { AnalyticsProvider, PolychatProvider } from "@ngriffin_uk/polychat-library-react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";
import { Outlet, isRouteErrorResponse, ScrollRestoration } from "react-router";

import { customResponseViews } from "~/components/Apps/ResponseRenderer/customResponseViews";
import { AnalyticsBootstrap } from "~/components/Core/AnalyticsBootstrap";
import { AppInitializer } from "~/components/Core/AppInitializer";
import { AppShell } from "~/components/Core/AppShell";
import { ServiceWorkerRegistration } from "~/components/Core/ServiceWorkerRegistration";
import { ThemedToaster } from "~/components/Core/ThemedToaster";
import { CaptchaProvider } from "~/components/HCaptcha/CaptchaProvider";
import { shouldShowDevTools } from "~/constants";
import { useTrackEvent } from "~/hooks/use-track-event";
import { useAnalyticsAdapter } from "~/lib/analytics-adapter";
import { RouterLink, RouterNavLink } from "~/lib/router-link";
import { SurfaceControlsProvider } from "~/lib/surface-context";
import { webSurfaceControls } from "~/lib/surface-controls";
import ErrorRoute from "~/pages/error";
import { LoadingProvider } from "~/state/contexts/LoadingContext";

import type { Route } from "./+types/root";

function AppProviders({ children }: { children: React.ReactNode }) {
  const analytics = useAnalyticsAdapter();

  return (
    <SurfaceControlsProvider controls={webSurfaceControls}>
      <LinkProvider Link={RouterLink} NavLink={RouterNavLink}>
        <AnalyticsProvider analytics={analytics}>
          <CustomResponseViewProvider views={customResponseViews}>
            <PolychatProvider>{children}</PolychatProvider>
          </CustomResponseViewProvider>
        </AnalyticsProvider>
      </LinkProvider>
    </SurfaceControlsProvider>
  );
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <AppShell>
      <AppProviders>{children}</AppProviders>
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
            <ThemedToaster />
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
