import {
	createServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { safeParseJson } from "../../utils/json";

const logger = getLogger({ prefix: "services/apps/shared" });

export interface ShareItemParams {
	userId: number;
	id: string;
	context?: ServiceContext;
	env?: IEnv;
}

export interface SharedItem {
	id: string;
	userId: number;
	appId: string;
	itemId: string;
	itemType?: string;
	data: Record<string, any>;
	shareId: string;
	createdAt: string;
	updatedAt: string;
}

export async function shareItem(
	params: ShareItemParams,
): Promise<{ shareId: string }> {
	const { userId, id, context, env } = params;

	if (!userId) {
		throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext =
		context ??
		(env
			? createServiceContext({
					env,
					user: null,
				})
			: null);

	if (!serviceContext) {
		throw new AssistantError(
			"Service context is required",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	serviceContext.ensureDatabase();
	const appDataRepo = serviceContext.repositories.appData;

	const appData = await appDataRepo.getAppDataByItemId(id);

	if (!appData || appData.user_id !== userId) {
		throw new AssistantError(
			"Item not found or does not belong to user",
			ErrorType.NOT_FOUND,
		);
	}

	if (appData.share_id) {
		return { shareId: appData.share_id };
	}

	const shareId = generateId();
	await appDataRepo.updateAppDataWithShareId(appData.id, shareId);
	return { shareId };
}

export async function getSharedItem({
	context,
	env,
	shareId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	shareId: string;
}): Promise<SharedItem> {
	if (!shareId) {
		throw new AssistantError("Share ID is required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext =
		context ??
		(env
			? createServiceContext({
					env,
					user: null,
				})
			: null);

	if (!serviceContext) {
		throw new AssistantError(
			"Service context is required",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	serviceContext.ensureDatabase();
	const appDataRepo = serviceContext.repositories.appData;
	const appData = await appDataRepo.getAppDataByShareId(shareId);

	if (!appData) {
		throw new AssistantError("Shared item not found", ErrorType.NOT_FOUND);
	}

	let parsedData = safeParseJson(appData.data) ?? {};

	return {
		id: appData.id,
		userId: appData.user_id,
		appId: appData.app_id,
		itemId: appData.item_id || "",
		itemType: appData.item_type,
		data: parsedData,
		shareId: appData.share_id || "",
		createdAt: appData.created_at,
		updatedAt: appData.updated_at,
	};
}
