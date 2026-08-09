import { createRequestHandler, RouterContextProvider } from "react-router";

declare global {
	interface CloudflareEnvironment extends Env {}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export default {
	fetch(request) {
		return requestHandler(request, new RouterContextProvider());
	},
} satisfies ExportedHandler<CloudflareEnvironment>;
