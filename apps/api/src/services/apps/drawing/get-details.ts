import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { Drawing } from "./list";
import { safeParseJson } from "../../../utils/json";

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
		throw new AssistantError("Drawing ID and user ID are required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = resolveServiceContext({ context, env });
	serviceContext.ensureDatabase();
	const repo = serviceContext.repositories.outputs;
	const entry = await repo.getPersonalOutput(userId, drawingId);

	if (!entry || entry.capability_id !== "drawings" || entry.kind !== "drawing") {
		throw new AssistantError("Drawing not found", ErrorType.NOT_FOUND);
	}

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
}
