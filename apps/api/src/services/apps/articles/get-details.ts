import type { Output } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { formatOutput } from "~/services/outputs";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/articles/get-details" });

export interface GetDetailsSuccessResponse {
  status: "success";
  article: Output;
}

export async function getArticleDetails({
  context,
  env,
  id,
  userId,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  id: string;
  userId: number;
  projectId?: string;
}): Promise<GetDetailsSuccessResponse> {
  if (!id) {
    throw new AssistantError("Article ID is required", ErrorType.PARAMS_ERROR);
  }

  if (!userId) {
    throw new AssistantError("User ID is required for lookup", ErrorType.PARAMS_ERROR);
  }

  try {
    const serviceContext =
      context ??
      (env
        ? createServiceContext({
            env,
            user: null,
          })
        : null);

    if (!serviceContext) {
      throw new AssistantError("Service context is required", ErrorType.CONFIGURATION_ERROR);
    }

    serviceContext.ensureDatabase();
    const outputRepo = serviceContext.repositories.outputs;
    const article = projectId
      ? await outputRepo.getProjectOutput(projectId, id)
      : await outputRepo.getPersonalOutput(userId, id);

    if (!article) {
      throw new AssistantError("Article data not found", ErrorType.NOT_FOUND, 404);
    }

    return {
      status: "success",
      article: formatOutput(article),
    };
  } catch (error) {
    logger.error("Error fetching article details:", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    if (error instanceof AssistantError) {
      throw error;
    }

    throw new AssistantError(
      "Failed to get article details",
      ErrorType.UNKNOWN_ERROR,
      undefined,
      error,
    );
  }
}
