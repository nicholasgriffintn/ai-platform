import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";

import { AppInitializer } from "~/components/AppInitializer";
import { LoadingSpinner } from "~/components/LoadingSpinner";
import { ServiceWorkerRegistration } from "~/components/ServiceWorkerRegistration";
import { Toaster } from "~/components/ui/sonner";
import ErrorRoute from "~/pages/error";
import { LoadingProvider } from "~/state/contexts/LoadingContext";
import type { Route } from "./+types/root";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Polychat",
  description: "Chat with multiple AI models from one place",
  url: "https://polychat.app",
  applicationCategory: "AIApplication",
};

export function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-off-white dark:bg-zinc-900">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Polychat - AI Assistant</title>
        <meta
          name="description"
          content="Chat with multiple AI models from one place"
        />

        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>

        <link
          rel="icon"
          type="image/png"
          href="/favicon-96x96.png"
          sizes="96x96"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#000000" />
        <link
          rel="search"
          type="application/opensearchdescription+xml"
          title="Polychat"
          href="/opensearch.xml"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <AppInitializer>
          <Outlet />
          <ServiceWorkerRegistration />
          <Toaster />
        </AppInitializer>
      </LoadingProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
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
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return <ErrorRoute message={message} details={details} stack={stack || ""} />;
}
