import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";

import { mapCanvasGenerationRecord } from "./records";
import type { CanvasGenerationListItem, CanvasMode } from "./types";

export const listCanvasGenerations = async ({
  context,
  env,
  userId,
  mode,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  userId: number;
  mode?: CanvasMode;
  projectId?: string;
}): Promise<CanvasGenerationListItem[]> => {
  const serviceContext = resolveServiceContext({ context, env });

  const records = projectId
    ? await serviceContext.repositories.outputs.listProjectOutputs(projectId, "canvas")
    : await serviceContext.repositories.outputs.listPersonalOutputs(userId, "canvas");

  const mapped = records.map(mapCanvasGenerationRecord);

  if (!mode) {
    return mapped;
  }

  return mapped.filter((generation) => generation.mode === mode);
};
