import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { PATTERN_OUTPUT_KIND, STRUDEL_APP_ID, mapResponseToPattern } from "./utils";

const logger = getLogger({ prefix: "services/strudel/list" });

export async function listPatterns({
  context,
  userId,
  projectId,
}: {
  context: ServiceContext;
  userId: number;
  projectId?: string;
}) {
  try {
    context.ensureDatabase();
    const { repositories } = context;

    const responses = projectId
      ? await repositories.outputs.listProjectOutputs(projectId, STRUDEL_APP_ID, {
          kind: PATTERN_OUTPUT_KIND,
        })
      : await repositories.outputs.listPersonalOutputs(userId, STRUDEL_APP_ID, {
          kind: PATTERN_OUTPUT_KIND,
        });

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
    throw new AssistantError("Failed to list Strudel patterns", ErrorType.UNKNOWN_ERROR);
  }
}
