import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { PATTERN_OUTPUT_KIND, STRUDEL_APP_ID, mapResponseToPattern } from "./utils";

const logger = getLogger({ prefix: "services/strudel/get-details" });

export async function getPatternDetails({
	context,
	userId,
	patternId,
	projectId,
}: {
	context: ServiceContext;
	userId: number;
	patternId: string;
	projectId?: string;
}) {
	try {
		context.ensureDatabase();
		const { repositories } = context;

		const response = projectId
			? await repositories.outputs.getProjectOutput(projectId, patternId)
			: await repositories.outputs.getPersonalOutput(userId, patternId);

		if (
			!response ||
			response.capability_id !== STRUDEL_APP_ID ||
			response.kind !== PATTERN_OUTPUT_KIND
		) {
			throw new AssistantError("Pattern not found", ErrorType.NOT_FOUND);
		}

		const pattern = mapResponseToPattern(response);

		logger.info("Retrieved Strudel pattern details", {
			userId,
			patternId,
		});

		return pattern;
	} catch (error) {
		logger.error("Error getting Strudel pattern details:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
			userId,
			patternId,
		});

		if (error instanceof AssistantError) {
			throw error;
		}

		throw new AssistantError("Failed to get Strudel pattern details", ErrorType.UNKNOWN_ERROR);
	}
}
