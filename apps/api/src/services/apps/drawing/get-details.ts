import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import type { Drawing } from "./list";
import { safeParseJson } from "../../../utils/json";

const logger = getLogger();

export async function getDrawingDetails({
	context,
	env,
	userId,
	drawingId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	userId: number;
	drawingId: string;
}): Promise<Drawing> {
	if (!userId || !drawingId) {
		throw new AssistantError(
			"Drawing ID and user ID are required",
			ErrorType.PARAMS_ERROR,
		);
	}

	const serviceContext = resolveServiceContext({ context, env });
	serviceContext.ensureDatabase();
	const repo = serviceContext.repositories.appData;
	const entry = await repo.getAppDataById(drawingId);

	if (!entry || entry.user_id !== userId || entry.app_id !== "drawings") {
		throw new AssistantError("Drawing not found", ErrorType.NOT_FOUND);
	}

	let data = safeParseJson(entry.data);

	return {
		id: entry.id,
		description: data.description,
		drawingUrl: data.drawingUrl,
		paintingUrl: data.paintingUrl,
		createdAt: entry.created_at,
		updatedAt: entry.updated_at,
		metadata: data.metadata,
	};
}
