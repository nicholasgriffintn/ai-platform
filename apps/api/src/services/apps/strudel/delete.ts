import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireOutputRecordAccess } from "~/services/outputs/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

import { PATTERN_OUTPUT_KIND, STRUDEL_APP_ID } from "./utils";

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

    if (
      !existing ||
      existing.capability_id !== STRUDEL_APP_ID ||
      existing.kind !== PATTERN_OUTPUT_KIND
    ) {
      throw new AssistantError("Pattern not found", ErrorType.NOT_FOUND);
    }

    await requireOutputRecordAccess(context, userId, existing, true);

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
