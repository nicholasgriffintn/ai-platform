import {
  teammateComputerInputSchema,
  teachingRecordingIdSchema,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import { RESOURCE_ID_PATTERN } from "./constants";
import type { ComputerRequest } from "./types";

export async function parseComputerRequest(request: Request): Promise<ComputerRequest | null> {
  const value = await request.json().catch(() => null);

  if (!isRecord(value) || typeof value.resourceId !== "string") {
    return null;
  }

  if (!RESOURCE_ID_PATTERN.test(value.resourceId)) {
    return null;
  }

  if (value.handle !== undefined && value.handle !== value.resourceId) {
    return null;
  }

  if (
    value.fence !== undefined &&
    (typeof value.fence !== "number" || !Number.isSafeInteger(value.fence))
  ) {
    return null;
  }

  if (
    value.checkpointReference !== undefined &&
    value.checkpointReference !== null &&
    typeof value.checkpointReference !== "string"
  ) {
    return null;
  }

  const input = teammateComputerInputSchema.safeParse(value.input);
  const recordingId = teachingRecordingIdSchema.safeParse(value.recordingId);

  if (value.input !== undefined && !input.success) {
    return null;
  }

  if (value.recordingId !== undefined && !recordingId.success) {
    return null;
  }

  return {
    resourceId: value.resourceId,
    ...(typeof value.handle === "string" ? { handle: value.handle } : {}),
    ...(typeof value.fence === "number" ? { fence: value.fence } : {}),
    ...(typeof value.checkpointReference === "string" || value.checkpointReference === null
      ? { checkpointReference: value.checkpointReference }
      : {}),
    ...(input.success ? { input: input.data } : {}),
    ...(recordingId.success ? { recordingId: recordingId.data } : {}),
  };
}
