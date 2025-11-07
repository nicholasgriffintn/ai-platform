import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
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
}: {
	context?: ServiceContext;
	env?: IEnv;
	request: UpdatePatternRequest;
	user: IUser;
	patternId: string;
}) {
	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const { repositories } = serviceContext;

	try {
		const existing =
			await repositories.dynamicAppResponses.getResponseById(patternId);

		if (!existing) {
			throw new AssistantError("Pattern not found", ErrorType.NOT_FOUND);
		}

		if (existing.user_id !== user.id) {
			throw new AssistantError(
				"Unauthorized access to pattern",
				ErrorType.AUTHORISATION_ERROR,
			);
		}

		const current = extractStoredPattern(existing.data);

		const mergedPayload = normalizePatternPayload({
			name: request.name ?? current.name,
			code: request.code ?? current.code,
			description:
				request.description !== undefined
					? request.description
					: current.description,
			tags: request.tags ?? current.tags,
		});

		await repositories.dynamicAppResponses.updateResponseData(
			patternId,
			mergedPayload,
		);

		const updated =
			await repositories.dynamicAppResponses.getResponseById(patternId);

		if (!updated) {
			throw new AssistantError(
				"Failed to load pattern after update",
				ErrorType.UNKNOWN_ERROR,
			);
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

		throw new AssistantError(
			"Failed to update Strudel pattern",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}
