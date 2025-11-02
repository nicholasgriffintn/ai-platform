import { isbot } from "isbot";
import { PostHogProvider } from "posthog-js/react";
import { renderToReadableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { generateCSP, getAnalyticsConfig } from "./constants";

const analyticsConfig = getAnalyticsConfig();

export default async function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	routerContext: EntryContext,
	_loadContext: AppLoadContext,
) {
	let shellRendered = false;
	const userAgent = request.headers.get("user-agent");

	responseHeaders.set("Content-Security-Policy", generateCSP());

	const isAnalyticsDisabled =
		analyticsConfig.disabled ||
		!analyticsConfig.apiKey ||
		analyticsConfig.apiKey === "disabled" ||
		!analyticsConfig.apiHost;

	const body = await renderToReadableStream(
		isAnalyticsDisabled ? (
			<ServerRouter context={routerContext} url={request.url} />
		) : (
			<PostHogProvider
				apiKey={analyticsConfig.apiKey}
				options={{
					api_host: analyticsConfig.apiHost,
					capture_exceptions: true,
					debug: analyticsConfig.debug || false,
				}}
			>
				<ServerRouter context={routerContext} url={request.url} />
			</PostHogProvider>
		),
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
