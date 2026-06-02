import { createRequestHandler } from "react-router";
import { createCloudflareRouterContext } from "../src/lib/cloudflare/router-context";

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

export default {
	fetch(request, env, ctx) {
		return requestHandler(
			request,
			createCloudflareRouterContext({
				env,
				ctx,
			}),
		);
	},
} satisfies ExportedHandler<Env>;
