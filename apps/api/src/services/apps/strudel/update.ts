import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { requireOutputRecordAccess } from "~/services/outputs/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
	STRUDEL_APP_ID,
	extractStoredPattern,
	mapResponseToPattern,
	normalizePatternPayload,
} from "./utils";

const logger = getLogger({ prefix: "services/strudel/update" });

interface UpdatePatternRequest {
	code?: string;
	name?: string;
	description?: string;
	tags?: string[];
}

export async function updatePattern({
	context,
	env,
	request,
	user,
	patternId,
	projectId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	request: UpdatePatternRequest;
	user: IUser;
	patternId: string;
	projectId?: string;
}) {
	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const { repositories } = serviceContext;

	try {
		const existing = projectId
			? await repositories.outputs.getProjectOutput(projectId, patternId)
			: await repositories.outputs.getPersonalOutput(user.id, patternId);

		if (
			!existing ||
			existing.capability_id !== STRUDEL_APP_ID ||
			existing.kind !== "strudel_pattern"
		) {
			throw new AssistantError("Pattern not found", ErrorType.NOT_FOUND);
		}
		await requireOutputRecordAccess(serviceContext, user.id, existing, true);

		const current = extractStoredPattern(existing.content);

		const mergedPayload = normalizePatternPayload({
			name: request.name ?? current.name,
			code: request.code ?? current.code,
			description: request.description !== undefined ? request.description : current.description,
			tags: request.tags ?? current.tags,
		});

		const updated = await repositories.outputs.updateOutput(patternId, {
			title: mergedPayload.name,
			content: mergedPayload,
			expectedRevision: existing.revision,
			updatedByUserId: user.id,
		});

		if (!updated) {
			throw new AssistantError("Failed to load pattern after update", ErrorType.UNKNOWN_ERROR);
		}

		logger.info("Updated Strudel pattern", {
			userId: user.id,
			patternId,
		});

		return mapResponseToPattern(updated);
	} catch (error) {
		logger.error("Error updating Strudel pattern:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
			userId: user.id,
			patternId,
		});

		if (error instanceof AssistantError) {
			throw error;
		}

		throw new AssistantError("Failed to update Strudel pattern", ErrorType.UNKNOWN_ERROR);
	}
}
