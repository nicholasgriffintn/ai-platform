import { createRequestHandler, RouterContextProvider } from "react-router";

import { applySecurityHeaders } from "~/lib/security-headers";

declare global {
  interface CloudflareEnvironment extends Env {}
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request) {
    const response = await requestHandler(request, new RouterContextProvider());
    const headers = new Headers(response.headers);

    applySecurityHeaders(headers, request.url);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<CloudflareEnvironment>;
