import { getSandbox } from "@cloudflare/sandbox";
import {
  buildAgentHostEgressPolicy,
  errorResponse,
  readJsonRecord,
} from "@ngriffin_uk/polychat-library-sandbox";
import {
  AGENT_HOST_UNPROVISIONED_CODE,
  agentHostApprovalRequestSchema,
  agentHostCheckpointRequestSchema,
  agentHostDeprovisionRequestSchema,
  agentHostHostRequestSchema,
  agentHostProvisionRequestSchema,
  agentHostRunReferenceSchema,
  agentHostRunRequestSchema,
  agentHostRunSnapshotSchema,
  agentHostRunStartedSchema,
  agentHostSteerRequestSchema,
  agentHostSteerResponseSchema,
  isTerminalAgentHostRunStatus,
} from "@ngriffin_uk/polychat-schemas";
import { randomHex } from "@ngriffin_uk/polychat-utility-core";

import {
  AGENT_HOST_EGRESS_HANDLER,
  POLYCHAT_API_HANDLER,
  POLYCHAT_API_HOST,
} from "../config/agent-host";
import type { Env } from "../types";
import type { AgentHostState } from "./agent-host-container";
import {
  checkpointHermesHome,
  ensureHermesGateway,
  hermesRequest,
  hermesRunStartTimeout,
  isHermesGatewayRunning,
  type AgentHostSandbox,
} from "./gateway";
import type { PolychatApiParams } from "./outbound";

const AGENT_HOST_PATH_PREFIX = "/agent-host/";

async function applyAgentHostOutbound(
  sandbox: AgentHostSandbox,
  env: Env,
  serviceToken: string,
  networkHosts?: readonly string[],
): Promise<void> {
  const params: PolychatApiParams = { serviceToken };

  await sandbox.setOutboundByHost(POLYCHAT_API_HOST, POLYCHAT_API_HANDLER, params);
  await sandbox.setOutboundHandler(
    AGENT_HOST_EGRESS_HANDLER,
    buildAgentHostEgressPolicy({ env, networkHosts }),
  );
}

function unprovisioned(): Response {
  return Response.json(
    { error: "This agent host has not been provisioned", code: AGENT_HOST_UNPROVISIONED_CODE },
    { status: 409 },
  );
}

async function forwardHermesJson(response: Response): Promise<Response> {
  const payload: unknown = await response.json().catch(() => null);

  if (response.ok) {
    return Response.json(payload ?? {}, { status: 200 });
  }

  const message =
    (typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
      ? (payload as { error: string }).error
      : null) ?? `Hermes returned ${response.status}`;
  const status = response.status >= 400 && response.status < 500 ? response.status : 502;

  return errorResponse(status, message);
}

async function checkpointAndStore(
  sandbox: AgentHostSandbox,
  state: AgentHostState,
  hostId: string,
  runId: string,
): Promise<AgentHostState> {
  const checkpointReference = await checkpointHermesHome(sandbox, hostId);
  const next: AgentHostState = { ...state, checkpointReference, lastCheckpointedRunId: runId };

  await sandbox.writeAgentHostState(next);

  return next;
}

async function readRunSnapshot(
  sandbox: AgentHostSandbox,
  state: AgentHostState,
  hostId: string,
  runId: string,
): Promise<Response> {
  const response = await hermesRequest(sandbox, state, `/v1/runs/${runId}`, { method: "GET" });

  if (response.status === 404) {
    return Response.json({
      run_id: runId,
      status: "interrupted",
      error:
        "The hosted agent restarted before this run finished. Session history is preserved; start a new run in the same conversation to continue.",
    });
  }

  const snapshot = agentHostRunSnapshotSchema.safeParse(await response.json().catch(() => null));

  if (!response.ok || !snapshot.success) {
    return errorResponse(502, `Hermes returned an unreadable run (${response.status})`);
  }

  if (isTerminalAgentHostRunStatus(snapshot.data.status) && state.lastCheckpointedRunId !== runId) {
    try {
      await checkpointAndStore(sandbox, state, hostId, runId);
    } catch (error) {
      console.warn("[agent-host] Checkpoint failed", {
        hostId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return Response.json(snapshot.data);
}

export function isAgentHostPath(pathname: string): boolean {
  return pathname.startsWith(AGENT_HOST_PATH_PREFIX);
}

export async function handleAgentHostRequest(request: Request, env: Env): Promise<Response> {
  const action = new URL(request.url).pathname.slice(AGENT_HOST_PATH_PREFIX.length);
  const body = await readJsonRecord(request);
  const host = agentHostHostRequestSchema.safeParse(
    body && typeof body.hostId === "string" ? { hostId: body.hostId } : null,
  );

  if (!host.success) {
    return errorResponse(400, "Invalid agent host request");
  }

  const sandbox: AgentHostSandbox = getSandbox(env.AgentHost, host.data.hostId, {
    normalizeId: true,
  });

  try {
    if (action === "provision") {
      const input = agentHostProvisionRequestSchema.safeParse(body);

      if (!input.success) {
        return errorResponse(400, "Invalid agent host provision request");
      }

      const existing = await sandbox.readAgentHostState();
      const requestedHosts = input.data.networkHosts;
      const nextHosts =
        requestedHosts && requestedHosts.length > 0 ? requestedHosts : existing?.networkHosts;
      const state: AgentHostState = {
        apiServerKey: existing?.apiServerKey ?? randomHex(64),
        ...(existing?.checkpointReference
          ? { checkpointReference: existing.checkpointReference }
          : {}),
        ...(existing?.lastCheckpointedRunId
          ? { lastCheckpointedRunId: existing.lastCheckpointedRunId }
          : {}),
        ...(nextHosts && nextHosts.length > 0 ? { networkHosts: nextHosts } : {}),
      };

      await sandbox.writeAgentHostState(state);
      await applyAgentHostOutbound(sandbox, env, input.data.serviceToken, state.networkHosts);

      return Response.json({ provisioned: true });
    }

    if (action === "deprovision") {
      const input = agentHostDeprovisionRequestSchema.safeParse(body);

      if (!input.success) {
        return errorResponse(400, "Invalid agent host deprovision request");
      }

      const state = await sandbox.readAgentHostState();

      if (state?.checkpointReference) {
        try {
          const checkpointReference = await checkpointHermesHome(sandbox, input.data.hostId);

          await sandbox.writeAgentHostState({ ...state, checkpointReference });
        } catch (error) {
          console.warn("[agent-host] Pre-deprovision checkpoint failed", {
            hostId: input.data.hostId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      try {
        await sandbox.destroy();
      } catch (error) {
        console.warn("[agent-host] Container destroy failed", {
          hostId: input.data.hostId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await sandbox.clearAgentHostState().catch(() => undefined);

      return Response.json({ deprovisioned: true });
    }

    const state = await sandbox.readAgentHostState();

    if (!state) {
      return unprovisioned();
    }

    switch (action) {
      case "health": {
        const running = await isHermesGatewayRunning(sandbox).catch(() => null);

        return Response.json({
          provisioned: true,
          gateway: running === null ? "unknown" : running ? "running" : "stopped",
        });
      }

      case "checkpoint": {
        const input = agentHostCheckpointRequestSchema.safeParse(body);

        if (!input.success) {
          return errorResponse(400, "Invalid agent host checkpoint request");
        }

        try {
          const checkpointReference = await checkpointHermesHome(sandbox, input.data.hostId);

          await sandbox.writeAgentHostState({ ...state, checkpointReference });

          return Response.json({ checkpointReference });
        } catch (error) {
          return errorResponse(
            502,
            error instanceof Error ? error.message : "Agent host checkpoint failed",
          );
        }
      }

      case "run": {
        const input = agentHostRunRequestSchema.safeParse(body);

        if (!input.success) {
          return errorResponse(400, "Invalid agent host run request");
        }

        await ensureHermesGateway(sandbox, state, input.data.hostId);

        const response = await hermesRequest(sandbox, state, "/v1/runs", {
          method: "POST",
          body: {
            input: input.data.input,
            session_id: input.data.sessionId,
            ...(input.data.instructions ? { instructions: input.data.instructions } : {}),
            ...(input.data.model ? { model: input.data.model } : {}),
            ...(input.data.modelOptions ? { model_options: input.data.modelOptions } : {}),
          },
          timeoutMs: hermesRunStartTimeout(),
          ...(input.data.idempotencyKey
            ? { headers: { "Idempotency-Key": input.data.idempotencyKey } }
            : {}),
        });
        const started = agentHostRunStartedSchema.safeParse(
          await response.json().catch(() => null),
        );

        if (!started.success) {
          return errorResponse(502, `Hermes did not start the run (${response.status})`);
        }

        return Response.json({ runId: started.data.run_id });
      }

      case "run-status": {
        const input = agentHostRunReferenceSchema.safeParse(body);

        if (!input.success) {
          return errorResponse(400, "Invalid agent host run reference");
        }

        await ensureHermesGateway(sandbox, state, input.data.hostId).catch((error) => {
          console.warn("[agent-host] Gateway wake failed for run-status", {
            hostId: input.data.hostId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

        return readRunSnapshot(sandbox, state, input.data.hostId, input.data.runId);
      }

      case "run-events": {
        const input = agentHostRunReferenceSchema.safeParse(body);

        if (!input.success) {
          return errorResponse(400, "Invalid agent host run reference");
        }

        try {
          await ensureHermesGateway(sandbox, state, input.data.hostId);
        } catch (error) {
          return errorResponse(
            502,
            error instanceof Error ? error.message : "Agent host gateway is unavailable",
          );
        }

        const events = await hermesRequest(sandbox, state, `/v1/runs/${input.data.runId}/events`, {
          method: "GET",
          timeoutMs: 0,
        });

        if (!events.ok || !events.body) {
          return errorResponse(502, `Hermes run events are unavailable (${events.status})`);
        }

        return new Response(events.body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
          },
        });
      }

      case "run-steer": {
        const input = agentHostSteerRequestSchema.safeParse(body);

        if (!input.success) {
          return errorResponse(400, "Invalid agent host steer request");
        }

        await ensureHermesGateway(sandbox, state, input.data.hostId).catch((error) => {
          console.warn("[agent-host] Gateway wake failed for run-steer", {
            hostId: input.data.hostId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

        const steered = await hermesRequest(sandbox, state, `/v1/runs/${input.data.runId}/steer`, {
          method: "POST",
          body: { input: input.data.input },
        });
        const payload = agentHostSteerResponseSchema.safeParse(
          await steered.json().catch(() => null),
        );

        if (!steered.ok || !payload.success || !payload.data.accepted) {
          const status = steered.status === 409 ? 409 : 502;

          return errorResponse(
            status,
            status === 409
              ? "The hosted run is not accepting steer input right now"
              : `Hermes did not accept the steer text (${steered.status})`,
          );
        }

        return Response.json({ accepted: true });
      }

      case "run-approval": {
        const input = agentHostApprovalRequestSchema.safeParse(body);

        if (!input.success) {
          return errorResponse(400, "Invalid agent host approval");
        }

        await ensureHermesGateway(sandbox, state, input.data.hostId).catch((error) => {
          console.warn("[agent-host] Gateway wake failed for run-approval", {
            hostId: input.data.hostId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

        return forwardHermesJson(
          await hermesRequest(sandbox, state, `/v1/runs/${input.data.runId}/approval`, {
            method: "POST",
            body: {
              choice: input.data.choice,
              ...(input.data.requestId ? { request_id: input.data.requestId } : {}),
            },
          }),
        );
      }

      case "run-stop": {
        const input = agentHostRunReferenceSchema.safeParse(body);

        if (!input.success) {
          return errorResponse(400, "Invalid agent host run reference");
        }

        await ensureHermesGateway(sandbox, state, input.data.hostId).catch((error) => {
          console.warn("[agent-host] Gateway wake failed for run-stop", {
            hostId: input.data.hostId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

        const response = await forwardHermesJson(
          await hermesRequest(sandbox, state, `/v1/runs/${input.data.runId}/stop`, {
            method: "POST",
          }),
        );

        try {
          const snapshot = await hermesRequest(sandbox, state, `/v1/runs/${input.data.runId}`, {
            method: "GET",
          });

          if (snapshot.ok) {
            const parsed = agentHostRunSnapshotSchema.safeParse(
              await snapshot.json().catch(() => null),
            );

            if (
              parsed.success &&
              isTerminalAgentHostRunStatus(parsed.data.status) &&
              state.lastCheckpointedRunId !== input.data.runId
            ) {
              await checkpointAndStore(sandbox, state, input.data.hostId, input.data.runId);
            }
          }
        } catch (error) {
          console.warn("[agent-host] Post-stop checkpoint failed", {
            hostId: input.data.hostId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        return response;
      }

      default:
        return errorResponse(404, "Not found");
    }
  } catch (error) {
    return errorResponse(502, error instanceof Error ? error.message : "Agent host request failed");
  }
}
