import { createContext, RouterContextProvider } from "react-router";

export interface CloudflareContextValue<Environment = unknown> {
	env: Environment;
	ctx: {
		waitUntil(promise: Promise<unknown>): void;
		passThroughOnException?(): void;
	};
}

export const cloudflareContext = createContext<CloudflareContextValue>();

export function createCloudflareRouterContext<Environment>(
	value: CloudflareContextValue<Environment>,
): RouterContextProvider {
	const context = new RouterContextProvider();
	context.set(cloudflareContext, value);
	return context;
}
