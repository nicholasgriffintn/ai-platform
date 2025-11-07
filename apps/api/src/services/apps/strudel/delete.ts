import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/strudel/delete" });

export async function deletePattern({
	context,
	userId,
	patternId,
}: {
	context: ServiceContext;
	userId: number;
	patternId: string;
}): Promise<void> {
	try {
		context.ensureDatabase();
		const { repositories } = context;

		const existing =
			await repositories.dynamicAppResponses.getResponseById(patternId);

		if (!existing) {
			throw new AssistantError("Pattern not found", ErrorType.NOT_FOUND);
		}

		if (existing.user_id !== userId) {
			throw new AssistantError(
				"Unauthorized access to pattern",
				ErrorType.AUTHORISATION_ERROR,
			);
		}

		await repositories.dynamicAppResponses.deleteResponse(patternId);

		logger.info("Deleted Strudel pattern", {
			userId,
			patternId,
		});
	} catch (error) {
		logger.error("Error deleting Strudel pattern:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
			userId,
			patternId,
		});

		if (error instanceof AssistantError) {
			throw error;
		}

		throw new AssistantError(
			"Failed to delete Strudel pattern",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}
