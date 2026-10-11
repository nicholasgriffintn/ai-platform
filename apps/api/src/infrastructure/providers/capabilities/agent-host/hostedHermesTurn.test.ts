import type {
  AgentHostProvisionRequest,
  AgentHostRunSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { verifyInternalServiceDelegationJwt } from "@ngriffin_uk/polychat-utility-server/internal-service-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import type { AgentHostClient } from "./AgentHostClient";
import { runHostedHermesTurn } from "./hostedHermesTurn";

vi.mock("@ngriffin_uk/polychat-utility-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-utility-core")>()),
  abortableDelay: vi.fn(async () => undefined),
}));

const RUN_ID = `run_${"a".repeat(32)}`;
const DELEGATION_SECRET = "hosted-hermes-test-secret-with-at-least-32-bytes";

function fakeClient(snapshots: AgentHostRunSnapshot[]) {
  return {
    provision: vi.fn(async (_input: AgentHostProvisionRequest) => undefined),
    startRun: vi.fn(async () => RUN_ID),
    readRun: vi.fn(async () => snapshots.shift() ?? snapshots.at(-1)),
    answerApproval: vi.fn(async () => undefined),
    stopRun: vi.fn(async () => undefined),
  };
}

const context = {
  executionRunId: undefined,
  env: { JWT_SECRET: DELEGATION_SECRET },
} as unknown as ServiceContext;

function turn(
  client: ReturnType<typeof fakeClient>,
  resume?: { runId: string; requestId?: string; choice: "once" | "deny" },
) {
  return runHostedHermesTurn({
    context,
    client: client as unknown as AgentHostClient,
    userId: 7,
    conversationId: "conv/1",
    input: "Plan my week",
    ...(resume ? { resume } : {}),
  });
}

describe("runHostedHermesTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provisions with the authenticated user before starting a run", async () => {
    const client = fakeClient([{ run_id: RUN_ID, status: "completed", output: "Done" }]);

    await expect(turn(client)).resolves.toMatchObject({ output: "Done" });
    const provisionRequest = client.provision.mock.calls[0]?.[0];

    expect(provisionRequest?.hostId).toBe("hermes-7");
    const claims = await verifyInternalServiceDelegationJwt(
      provisionRequest?.serviceToken ?? "",
      DELEGATION_SECRET,
    );

    expect(claims).toMatchObject({
      sub: "agent-worker",
      scopes: ["user:delegate"],
      user_id: 7,
    });
    expect(client.startRun).toHaveBeenCalledWith({
      hostId: "hermes-7",
      sessionId: "polychat-conv-1",
      input: "Plan my week",
    });
  });

  it("returns a pending approval without answering it", async () => {
    const waiting: AgentHostRunSnapshot = {
      run_id: RUN_ID,
      status: "waiting_for_approval",
      approval: { request_id: "req-1", description: "delete the cache" },
    };
    const client = fakeClient([waiting]);

    await expect(turn(client)).resolves.toEqual({
      runId: RUN_ID,
      output: "",
      approval: { request_id: "req-1", description: "delete the cache" },
    });
    expect(client.answerApproval).not.toHaveBeenCalled();
  });

  it("answers a user approval and resumes the waiting run", async () => {
    const client = fakeClient([{ run_id: RUN_ID, status: "completed", output: "Done" }]);

    await expect(
      turn(client, { runId: RUN_ID, requestId: "req-1", choice: "once" }),
    ).resolves.toEqual({ runId: RUN_ID, output: "Done" });
    expect(client.answerApproval).toHaveBeenCalledWith({
      hostId: "hermes-7",
      runId: RUN_ID,
      requestId: "req-1",
      choice: "once",
    });
  });

  it("surfaces a failed run as an error", async () => {
    const client = fakeClient([{ run_id: RUN_ID, status: "failed", error: "model unavailable" }]);

    await expect(turn(client)).rejects.toThrow("model unavailable");
  });
});
