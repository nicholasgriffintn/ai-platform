import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { CanvasGenerationListItem } from "./types";
import { mapCanvasGenerationRecord } from "./records";

export const getCanvasGenerationDetails = async ({
	context,
	env,
	generationId,
	userId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	generationId: string;
	userId: number;
}): Promise<CanvasGenerationListItem> => {
	const serviceContext = resolveServiceContext({ context, env });
	const record =
		await serviceContext.repositories.appData.getAppDataById(generationId);

	if (!record || record.app_id !== "canvas") {
		throw new AssistantError("Generation not found", ErrorType.NOT_FOUND);
	}

	if (record.user_id !== userId) {
		throw new AssistantError("Unauthorized", ErrorType.UNAUTHORIZED);
	}

	return mapCanvasGenerationRecord(record);
};
