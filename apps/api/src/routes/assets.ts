import { Hono } from "hono";

import { getServiceContext } from "~/lib/context/serviceContext";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { readAsset } from "~/lib/storage/read-asset";

const app = new Hono();
const routeLogger = createRouteLogger("assets");

async function buildAssetResponse(asset: Awaited<ReturnType<typeof readAsset>>): Promise<Response> {
	const headers = new Headers();
	headers.set("content-type", asset.asset.mime_type);
	headers.set("cache-control", "private, no-store");
	if (asset.asset.filename) {
		headers.set("content-disposition", `inline; filename="${asset.asset.filename}"`);
	}

	return new Response(await asset.object.arrayBuffer(), {
		headers,
	});
}

app.use("/*", (c, next) => {
	routeLogger.info(`Processing assets route: ${c.req.path}`);
	return next();
});

app.get("/:assetId", async (context) => {
	const serviceContext = getServiceContext(context);
	const asset = await readAsset({
		context: serviceContext,
		assetId: context.req.param("assetId"),
		userId: serviceContext.user?.id,
	});

	return await buildAssetResponse(asset);
});

export default app;
