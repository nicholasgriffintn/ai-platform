import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
	STRUDEL_APP_ID,
	buildPatternPayload,
	mapResponseToPattern,
} from "./utils";

const logger = getLogger({ prefix: "services/strudel/save" });

interface SavePatternRequest {
	code: string;
	name: string;
	description?: string;
	tags?: string[];
}

export async function savePattern({
	context,
	env,
	request,
	user,
}: {
	context?: ServiceContext;
	env?: IEnv;
	request: SavePatternRequest;
	user: IUser;
}) {
	const serviceContext = resolveServiceContext({ context, env, user });
	serviceContext.ensureDatabase();
	const { repositories } = serviceContext;

	if (!request.code || !request.name) {
		throw new AssistantError(
			"Code and name are required",
			ErrorType.PARAMS_ERROR,
		);
	}

	try {
		const payload = buildPatternPayload(request);

		const record = user.id
			? await repositories.dynamicAppResponses.createResponse(
					user.id,
					STRUDEL_APP_ID,
					payload,
				)
			: null;

		if (!record) {
			throw new AssistantError(
				"Failed to save Strudel pattern",
				ErrorType.DATABASE_ERROR,
			);
		}

		logger.info("Saved Strudel pattern", {
			userId: user.id,
			patternId: record?.id,
			name: payload.name,
		});

		return mapResponseToPattern(record);
	} catch (error) {
		logger.error("Error saving Strudel pattern:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
			userId: user.id,
		});

		if (error instanceof AssistantError) {
			throw error;
		}

		throw new AssistantError(
			"Failed to save Strudel pattern",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}
