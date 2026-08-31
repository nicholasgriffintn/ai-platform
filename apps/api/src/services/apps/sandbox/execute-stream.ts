import type { ExecuteSandboxRunPayload as ExecuteSandboxRunStreamPayload } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { SSE_HEADERS } from "~/lib/http/streaming";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { enqueueSandboxRun } from "./create-run";
import { listRunCoordinatorEvents, openRunCoordinatorEventsSocket } from "./run-coordinator";
import { createCoordinatorEventSseStream } from "./streaming";

interface ExecuteSandboxRunStreamParams {
  env: IEnv;
  context: ServiceContext;
  user: IUser;
  payload: ExecuteSandboxRunStreamPayload;
  projectId?: string;
  conversationId?: string;
}

export async function executeSandboxRunStream(
  params: ExecuteSandboxRunStreamParams,
): Promise<Response> {
  const { env, context: serviceContext, user, payload, projectId, conversationId } = params;

  if (payload.taskType === "lean-proof" || payload.leanProof || payload.projectTaskContext) {
    throw new AssistantError(
      "Lean proof runs must be started through a project task",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  let prepared;

  try {
    prepared = await enqueueSandboxRun({
      env,
      context: serviceContext,
      user,
      payload,
      projectId,
      conversationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to queue sandbox run";

    return Response.json({ error: message }, { status: 500 });
  }

  const runId = prepared.run.runId;

  const stream = createCoordinatorEventSseStream({
    openSocket: () =>
      openRunCoordinatorEventsSocket({
        env,
        runId,
      }),
    listEvents: (after) =>
      listRunCoordinatorEvents({
        env,
        runId,
        after,
      }),
  });

  return new Response(stream, {
    headers: {
      ...SSE_HEADERS,
      "X-Sandbox-Run-Id": runId,
    },
  });
}
