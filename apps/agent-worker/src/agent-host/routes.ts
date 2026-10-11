import { getSandbox } from "@cloudflare/sandbox";
import {
  errorResponse,
  readJsonRecord,
  resolveBackupStorageHost,
  SANDBOX_PACKAGE_REGISTRY_HOSTS,
  type ContainerEgressPolicy,
} from "@ngriffin_uk/polychat-library-sandbox";
import {
  AGENT_HOST_UNPROVISIONED_CODE,
  agentHostApprovalRequestSchema,
  agentHostHostRequestSchema,
  agentHostProvisionRequestSchema,
  agentHostRunReferenceSchema,
  agentHostRunRequestSchema,
  agentHostRunSnapshotSchema,
  agentHostRunStartedSchema,
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
  type AgentHostSandbox,
} from "./gateway";
import type { PolychatApiParams } from "./outbound";

const AGENT_HOST_PATH_PREFIX = "/agent-host/";

function agentHostEgressPolicy(env: Env): ContainerEgressPolicy {
  const storageHost = resolveBackupStorageHost(env);

  return {
    mode: "list",
    hosts: storageHost ? [storageHost] : [],
    readOnlyHosts: [...SANDBOX_PACKAGE_REGISTRY_HOSTS],
  };
}

async function applyAgentHostOutbound(
  sandbox: AgentHostSandbox,
  env: Env,
  serviceToken: string,
): Promise<void> {
  const params: PolychatApiParams = { serviceToken };

  await sandbox.setOutboundByHost(POLYCHAT_API_HOST, POLYCHAT_API_HANDLER, params);
  await sandbox.setOutboundHandler(AGENT_HOST_EGRESS_HANDLER, agentHostEgressPolicy(env));
}

function unprovisioned(): Response {
  return Response.json(
    { error: "This agent host has not been provisioned", code: AGENT_HOST_UNPROVISIONED_CODE },
    { status: 409 },
  );
}

async function forwardHermesJson(response: Response): Promise<Response> {
  const payload: unknown = await response.json().catch(() => null);

  return Response.json(payload ?? { error: `Hermes returned ${response.status}` }, {
    status: response.ok ? 200 : response.status,
  });
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
      error: "The hosted agent restarted before this run finished.",
    });
  }

  const snapshot = agentHostRunSnapshotSchema.safeParse(await response.json().catch(() => null));

  if (!response.ok || !snapshot.success) {
    return errorResponse(502, `Hermes returned an unreadable run (${response.status})`);
  }

  if (isTerminalAgentHostRunStatus(snapshot.data.status) && state.lastCheckpointedRunId !== runId) {
    try {
      const checkpointReference = await checkpointHermesHome(sandbox, hostId);

      await sandbox.writeAgentHostState({
        ...state,
        checkpointReference,
        lastCheckpointedRunId: runId,
      });
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
      const state: AgentHostState = {
        apiServerKey: existing?.apiServerKey ?? randomHex(64),
        ...(existing?.checkpointReference
          ? { checkpointReference: existing.checkpointReference }
          : {}),
        ...(existing?.lastCheckpointedRunId
          ? { lastCheckpointedRunId: existing.lastCheckpointedRunId }
          : {}),
      };

      await sandbox.writeAgentHostState(state);
      await applyAgentHostOutbound(sandbox, env, input.data.serviceToken);

      return Response.json({ provisioned: true });
    }

    const state = await sandbox.readAgentHostState();

    if (!state) {
      return unprovisioned();
    }

    switch (action) {
      case "run": {
        const input = agentHostRunRequestSchema.safeParse(body);

        if (!input.success) {
          return errorResponse(400, "Invalid agent host run request");
        }

        await ensureHermesGateway(sandbox, state);

        const response = await hermesRequest(sandbox, state, "/v1/runs", {
          method: "POST",
          body: { input: input.data.input, session_id: input.data.sessionId },
        });
        const started = agentHostRunStartedSchema.safeParse(
          await response.json().catch(() => null),
        );

        return started.success
          ? Response.json({ runId: started.data.run_id })
          : errorResponse(502, `Hermes did not start the run (${response.status})`);
      }

      case "run-status": {
        const input = agentHostRunReferenceSchema.safeParse(body);

        if (!input.success) {
          return errorResponse(400, "Invalid agent host run reference");
        }

        return readRunSnapshot(sandbox, state, input.data.hostId, input.data.runId);
      }

      case "run-approval": {
        const input = agentHostApprovalRequestSchema.safeParse(body);

        if (!input.success) {
          return errorResponse(400, "Invalid agent host approval");
        }

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

        return forwardHermesJson(
          await hermesRequest(sandbox, state, `/v1/runs/${input.data.runId}/stop`, {
            method: "POST",
          }),
        );
      }

      default:
        return errorResponse(404, "Not found");
    }
  } catch (error) {
    return errorResponse(502, error instanceof Error ? error.message : "Agent host request failed");
  }
}
