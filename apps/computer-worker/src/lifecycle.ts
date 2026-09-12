import { getSandbox } from "@cloudflare/sandbox";

import { inputComputer, observeComputer, startComputer, stopComputer } from "./browser";
import { createComputerCheckpoint, restoreComputerCheckpoint } from "./checkpoints";
import { assertFence, revokeComputerControl } from "./fencing";
import { errorResponse } from "./http";
import { parseComputerRequest } from "./request";
import { createScreenConnection } from "./screen";
import { readTeachingRecording } from "./teaching-recording";
import type { Env } from "./types";

export async function handleComputerRequest(request: Request, env: Env): Promise<Response> {
  const input = await parseComputerRequest(request);

  if (!input) {
    return errorResponse(400, "Invalid computer request");
  }

  const sandbox = getSandbox(env.Computer, input.resourceId, { normalizeId: true });
  const path = new URL(request.url).pathname;

  try {
    if (path === "/computer/provision") {
      if (input.checkpointReference) {
        await restoreComputerCheckpoint(sandbox, input.checkpointReference);
      } else {
        await startComputer(sandbox);
      }

      return Response.json({
        handle: input.resourceId,
        checkpointReference: input.checkpointReference,
      });
    }

    if (!["/computer/provision", "/computer/revoke-control"].includes(path)) {
      await assertFence(sandbox, input.fence);
    }

    switch (path) {
      case "/computer/destroy":
        await sandbox.destroy();

        return Response.json({ success: true });
      case "/computer/stop":
        await stopComputer(sandbox);

        return Response.json({ success: true });
      case "/computer/revoke-control":
        await revokeComputerControl(sandbox, input.fence);

        return Response.json({ success: true });
      case "/computer/checkpoint":
        return Response.json({
          checkpointReference: await createComputerCheckpoint(sandbox, input.resourceId),
        });
      case "/computer/restore":
        if (!input.checkpointReference) {
          return errorResponse(400, "Checkpoint reference is required");
        }

        await restoreComputerCheckpoint(sandbox, input.checkpointReference);

        return Response.json({ success: true });
      case "/computer/observe":
        return Response.json(await observeComputer(sandbox));
      case "/computer/input":
        if (!input.input) {
          return errorResponse(400, "Computer input is required");
        }

        return Response.json(await inputComputer(sandbox, input.input));
      case "/computer/screen":
        return Response.json(await createScreenConnection(sandbox, env, input));
      case "/computer/teaching-recording": {
        if (!input.recordingId) {
          return errorResponse(400, "Teaching recording id is required");
        }

        const recording = await readTeachingRecording(sandbox, input.recordingId);

        return recording
          ? Response.json(recording)
          : errorResponse(404, "Teaching recording not found");
      }

      default:
        return errorResponse(404, "Not found");
    }
  } catch (error) {
    return errorResponse(400, error instanceof Error ? error.message : "Computer request failed");
  }
}
