import type { ServiceContext } from "~/lib/context/serviceContext";
import { readAsset } from "~/lib/storage/read-asset";
import { NO_STORE } from "@assistant/schemas";

export interface AssetResponsePayload {
	body: ArrayBuffer;
	headers: Headers;
}

export async function getAssetResponsePayload(params: {
	context: ServiceContext;
	assetId: string;
}): Promise<AssetResponsePayload> {
	const { context, assetId } = params;
	const asset = await readAsset({
		context,
		assetId,
		userId: context.user?.id,
	});

	const headers = new Headers();
	headers.set("content-type", asset.asset.mime_type);
	headers.set("cache-control", NO_STORE);
	headers.set("cross-origin-resource-policy", "cross-origin");
	if (asset.asset.filename) {
		headers.set("content-disposition", `inline; filename="${asset.asset.filename}"`);
	}

	return {
		body: await asset.object.arrayBuffer(),
		headers,
	};
}
