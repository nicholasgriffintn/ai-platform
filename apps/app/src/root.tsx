import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Suspense, lazy } from "react";
import { Outlet, isRouteErrorResponse } from "react-router";

import { AppInitializer } from "~/components/AppInitializer";
import { AppShell } from "~/components/AppShell";
import { CaptchaProvider } from "~/components/HCaptcha/CaptchaProvider";
import { LoadingSpinner } from "~/components/LoadingSpinner";
import { ServiceWorkerRegistration } from "~/components/ServiceWorkerRegistration";
import { Toaster } from "~/components/ui/sonner";
import ErrorRoute from "~/pages/error";
import { LoadingProvider } from "~/state/contexts/LoadingContext";
import type { Route } from "./+types/root";

const AnalyticsLazy = lazy(() =>
  import("~/components/Analytics").then((d) => ({
    default: d.Analytics,
  })),
);

import { getBeaconConfig, shouldShowDevTools } from "~/constants";

const beaconConfig = getBeaconConfig();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
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
            {beaconConfig.enabled && (
              <Suspense fallback={null}>
                <AnalyticsLazy
                  isEnabled={beaconConfig.enabled}
                  beaconEndpoint={beaconConfig.endpoint}
                  beaconSiteId={beaconConfig.siteId}
                  beaconDebug={beaconConfig.debug}
                />
              </Suspense>
            )}
            <Outlet />
            <ServiceWorkerRegistration />
            <Toaster />
          </CaptchaProvider>
        </AppInitializer>
      </LoadingProvider>
      {shouldShowDevTools() && <ReactQueryDevtools initialIsOpen={false} />}
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
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (shouldShowDevTools() && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return <ErrorRoute message={message} details={details} stack={stack || ""} />;
}
