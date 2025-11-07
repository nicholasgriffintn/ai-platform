import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { mapResponseToPattern } from "./utils";

const logger = getLogger({ prefix: "services/strudel/get-details" });

export async function getPatternDetails({
	context,
	userId,
	patternId,
}: {
	context: ServiceContext;
	userId: number;
	patternId: string;
}) {
	try {
		context.ensureDatabase();
		const { repositories } = context;

		const response =
			await repositories.dynamicAppResponses.getResponseById(patternId);

		if (!response) {
			throw new AssistantError("Pattern not found", ErrorType.NOT_FOUND);
		}

		if (response.user_id !== userId) {
			throw new AssistantError(
				"Unauthorized access to pattern",
				ErrorType.AUTHORISATION_ERROR,
			);
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

		throw new AssistantError(
			"Failed to get Strudel pattern details",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}
