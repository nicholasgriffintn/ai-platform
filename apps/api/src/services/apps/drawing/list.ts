import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
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
	const repo = serviceContext.repositories.outputs;
	const list = await repo.listPersonalOutputs(userId, "drawings");

	return list.map((entry) => {
		const data = safeParseJson<Record<string, unknown>>(entry.content) ?? {};
		return {
			id: entry.id,
			description: typeof data.description === "string" ? data.description : "",
			drawingUrl: typeof data.drawingUrl === "string" ? data.drawingUrl : "",
			paintingUrl: typeof data.paintingUrl === "string" ? data.paintingUrl : "",
			createdAt: entry.created_at,
			updatedAt: entry.updated_at ?? entry.created_at,
			metadata:
				data.metadata && typeof data.metadata === "object"
					? (data.metadata as Record<string, unknown>)
					: undefined,
		};
	});
}
