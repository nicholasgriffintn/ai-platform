import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  resolveServiceContext,
  type ServiceContext,
} from "~/infrastructure/context/serviceContext";
import type { IEnv } from "~/types";

import { mapCanvasGenerationRecord } from "./records";
import type { CanvasGenerationListItem } from "./types";

export const getCanvasGenerationDetails = async ({
  context,
  env,
  generationId,
  userId,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  generationId: string;
  userId: number;
  projectId?: string;
}): Promise<CanvasGenerationListItem> => {
  const serviceContext = resolveServiceContext({ context, env });
  const record = projectId
    ? await serviceContext.repositories.outputs.getProjectOutput(projectId, generationId)
    : await serviceContext.repositories.outputs.getPersonalOutput(userId, generationId);

  if (!record || record.capability_id !== "canvas") {
    throw new AssistantError("Generation not found", ErrorType.NOT_FOUND, 404);
  }

  return mapCanvasGenerationRecord(record);
};
