import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { StoredAsset } from "./asset-types";
import { requireProjectAccess } from "~/services/workspaces/access";

interface AssetAccessRequest {
	asset: StoredAsset;
	context: ServiceContext;
	userId?: number;
}

function isPublicConversation(value: unknown): boolean {
	return value === true || value === 1;
}

export async function assertAssetAccess({
	asset,
	context,
	userId,
}: AssetAccessRequest): Promise<void> {
	if (userId && asset.owner_user_id === userId) {
		return;
	}

	if (userId && asset.app_data_id) {
		const appData = await context.repositories.appData.getAppDataById(asset.app_data_id);
		if (appData?.project_id) {
			await requireProjectAccess(context, appData.project_id);
			return;
		}
	}

	if (!asset.conversation_id) {
		throw new AssistantError("Access denied", ErrorType.FORBIDDEN, 403);
	}

	const conversation = await context.repositories.conversations.getConversation(
		asset.conversation_id,
	);

	if (!conversation || !isPublicConversation(conversation.is_public)) {
		throw new AssistantError("Access denied", ErrorType.FORBIDDEN, 403);
	}
}
