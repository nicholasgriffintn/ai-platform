import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "../../../utils/json";

export interface Drawing {
	id: string;
	description: string;
	drawingUrl: string;
	paintingUrl: string;
	createdAt: string;
	updatedAt: string;
	metadata?: Record<string, any>;
}

export async function listDrawings({
	context,
	env,
	userId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	userId: number;
}): Promise<Drawing[]> {
	if (!userId) {
		throw new AssistantError("User ID is required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = resolveServiceContext({ context, env });
	serviceContext.ensureDatabase();
	const repo = serviceContext.repositories.appData;
	const list = await repo.getAppDataByUserAndApp(userId, "drawings");

	return list.map((entry) => {
		let data = safeParseJson(entry.data) ?? {};
		return {
			id: entry.id,
			description: data.description,
			drawingUrl: data.drawingUrl,
			paintingUrl: data.paintingUrl,
			createdAt: entry.created_at,
			updatedAt: entry.updated_at,
			metadata: data.metadata,
		};
	});
}
