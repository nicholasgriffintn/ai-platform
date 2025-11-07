import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { STRUDEL_APP_ID, mapResponseToPattern } from "./utils";

const logger = getLogger({ prefix: "services/strudel/list" });

export async function listPatterns({
	context,
	userId,
}: {
	context: ServiceContext;
	userId: number;
}) {
	try {
		context.ensureDatabase();
		const { repositories } = context;

		const responses =
			await repositories.dynamicAppResponses.listResponsesForUser(
				userId,
				STRUDEL_APP_ID,
			);

		const patterns = responses.map(mapResponseToPattern);

		logger.info("Listed Strudel patterns", {
			userId,
			count: patterns.length,
		});

		return patterns;
	} catch (error) {
		logger.error("Error listing Strudel patterns:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
			userId,
		});
		throw new AssistantError(
			"Failed to list Strudel patterns",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}
