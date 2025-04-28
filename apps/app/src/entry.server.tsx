import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");
  const host = request.headers.get("host");
  const isLocalhost = host?.startsWith("localhost");

  responseHeaders.set(
    "Content-Security-Policy",
    `default-src 'self'; frame-src challenges.cloudflare.com; script-src challenges.cloudflare.com https://unpkg.com/react@18/umd/react.development.js https://unpkg.com/react-dom@18/umd/react-dom.development.js 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src assistant-assets.nickgriffin.uk icons.duckduckgo.com avatars.githubusercontent.com/u/ 'self' data:; connect-src 'self' ${isLocalhost ? "localhost:8787" : "api.polychat.app"} ${isLocalhost ? "ws://localhost:8787" : "wss://api.polychat.app"}; media-src 'self' data: https://assistant-assets.nickgriffin.uk`,
  );

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        if (shellRendered) {
          console.error(error);
        }
      },
    },
  );
  shellRendered = true;

  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
