import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/strudel/delete" });

export async function deletePattern({
	context,
	userId,
	patternId,
	projectId,
}: {
	context: ServiceContext;
	userId: number;
	patternId: string;
	projectId?: string;
}): Promise<void> {
	try {
		context.ensureDatabase();
		const { repositories } = context;

		const existing = projectId
			? await repositories.outputs.getProjectOutput(projectId, patternId)
			: await repositories.outputs.getPersonalOutput(userId, patternId);

		if (!existing) {
			throw new AssistantError("Pattern not found", ErrorType.NOT_FOUND);
		}

		await repositories.outputs.deleteOutput(patternId);

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

		throw new AssistantError("Failed to delete Strudel pattern", ErrorType.UNKNOWN_ERROR);
	}
}
