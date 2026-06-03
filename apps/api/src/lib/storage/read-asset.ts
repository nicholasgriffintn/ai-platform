import { StorageService } from "~/lib/storage";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { assertAssetAccess } from "./asset-access";

interface ReadAssetRequest {
	context: ServiceContext;
	assetId: string;
	userId?: number;
}

function getPrivateBucket(context: ServiceContext) {
	if (!context.env.PRIVATE_ASSETS_BUCKET) {
		throw new AssistantError(
			"Private assets bucket is not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	return context.env.PRIVATE_ASSETS_BUCKET;
}

export async function readAsset({ context, assetId, userId }: ReadAssetRequest) {
	const asset = await context.repositories.storedAssets.getAsset(assetId);
	if (!asset) {
		throw new AssistantError("Asset not found", ErrorType.NOT_FOUND, 404);
	}

	await assertAssetAccess({
		asset,
		context,
		userId,
	});

	const storage = new StorageService(getPrivateBucket(context));
	const object = await storage.getObjectBody(asset.key);
	if (!object) {
		throw new AssistantError("Asset object not found", ErrorType.NOT_FOUND, 404);
	}

	return {
		asset,
		object,
	};
}
