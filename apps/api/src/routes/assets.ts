import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { getAssetResponsePayload } from "~/services/assets";

const app = new Hono();
const routeLogger = createRouteLogger("assets");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing assets route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/:assetId", {
	tags: ["assets"],
	summary: "Read a stored asset",
	paramSchema: z.object({ assetId: z.string().min(1) }),
	responses: {
		200: { description: "Asset bytes" },
		403: { description: "Asset access denied" },
		404: { description: "Asset not found" },
	},
	handler: async ({ params, serviceContext }) => {
		const asset = await getAssetResponsePayload({
			context: serviceContext,
			assetId: params.assetId,
		});

		return new Response(asset.body, {
			headers: asset.headers,
		});
	},
});

export default app;
