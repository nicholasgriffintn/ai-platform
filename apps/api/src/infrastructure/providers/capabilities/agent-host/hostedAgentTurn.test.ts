import type {
  AgentHostProvisionRequest,
  AgentHostRunSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { verifyInternalServiceDelegationJwt } from "@ngriffin_uk/polychat-utility-server/internal-service-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import type { AgentHostClient } from "./AgentHostClient";
import { HERMES_AGENT_HOST_SPEC } from "./agentHostSpec";
import { runHostedAgentTurn } from "./hostedAgentTurn";

vi.mock("@ngriffin_uk/polychat-utility-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-utility-core")>()),
  abortableDelay: vi.fn(async () => undefined),
}));

const followUpMocks = vi.hoisted(() => ({
  queueFollowUp: vi.fn(async () => ({ id: "queued-2" })),
  removeQueuedFollowUp: vi.fn(async () => ({ removed: true })),
}));

vi.mock("~/modules/chat-runs/application/follow-up-queue", () => followUpMocks);

const RUN_ID = `run_${"a".repeat(32)}`;
const DELEGATION_SECRET = "hosted-hermes-test-secret-with-at-least-32-bytes";

function fakeClient(snapshots: AgentHostRunSnapshot[], eventsBody?: string) {
  return {
    provision: vi.fn(async (_input: AgentHostProvisionRequest) => undefined),
    startRun: vi.fn(async () => RUN_ID),
    readRun: vi.fn(async () => snapshots.shift() ?? snapshots.at(-1)),
    answerApproval: vi.fn(async () => undefined),
    stopRun: vi.fn(async () => undefined),
    checkpoint: vi.fn(async () => null),
    openRunEvents: vi.fn(async () => {
      if (eventsBody === undefined) {
        throw new Error("events unavailable");
      }

      return new Response(eventsBody, {
        headers: { "Content-Type": "text/event-stream" },
      });
    }),
    steerRun: vi.fn(async () => undefined),
  };
}

function steerableContext(queueText: string | null) {
  return {
    executionRunId: undefined,
    env: { JWT_SECRET: DELEGATION_SECRET },
    repositories: {
      tasks: {
        listSuspendedTasksForConversation: vi.fn(async () =>
          queueText === null
            ? []
            : [
                {
                  id: "queued-1",
                  task_data: {
                    conversationId: "conv-1",
                    message: { role: "user", content: queueText },
                    request: {},
                  },
                },
              ],
        ),
      },
    },
  } as unknown as ServiceContext;
}

const context = {
  executionRunId: undefined,
  env: { JWT_SECRET: DELEGATION_SECRET },
} as unknown as ServiceContext;

function turn(
  client: ReturnType<typeof fakeClient>,
  resume?: { runId: string; requestId?: string; choice: "once" | "deny" },
) {
  return runHostedAgentTurn({
    context,
    client: client as unknown as AgentHostClient,
    spec: HERMES_AGENT_HOST_SPEC,
    userId: 7,
    conversationId: "conv/1",
    input: "Plan my week",
    ...(resume ? { resume } : {}),
  });
}

describe("runHostedAgentTurn", () => {
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
      idempotencyKey: expect.any(String),
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

  it("steers a queued follow-up into the live run instead of waiting", async () => {
    const client = fakeClient([
      { run_id: RUN_ID, status: "running" },
      { run_id: RUN_ID, status: "completed", output: "Done" },
    ]);

    await expect(
      runHostedAgentTurn({
        context: steerableContext("Also check the edge case"),
        client: client as unknown as AgentHostClient,
        spec: HERMES_AGENT_HOST_SPEC,
        userId: 7,
        conversationId: "conv-1",
        input: "Plan my week",
      }),
    ).resolves.toMatchObject({ runId: RUN_ID, output: "Done" });
    expect(client.steerRun).toHaveBeenCalledWith({
      hostId: "hermes-7",
      runId: RUN_ID,
      input: "Also check the edge case",
    });
    expect(followUpMocks.removeQueuedFollowUp).toHaveBeenCalled();
  });

  it("replays undelivered steer text as a follow-up when the run ends", async () => {
    const client = fakeClient([
      {
        run_id: RUN_ID,
        status: "completed",
        output: "Done",
        pending_steer: "Handle this next",
      },
    ]);

    await expect(
      runHostedAgentTurn({
        context: steerableContext(null),
        client: client as unknown as AgentHostClient,
        spec: HERMES_AGENT_HOST_SPEC,
        userId: 7,
        conversationId: "conv-1",
        input: "Plan my week",
      }),
    ).resolves.toMatchObject({ runId: RUN_ID, output: "Done" });
    expect(followUpMocks.queueFollowUp).toHaveBeenCalledWith(
      expect.anything(),
      "conv-1",
      expect.objectContaining({
        message: expect.objectContaining({ content: "Handle this next" }),
      }),
    );
  });

  it("waits on run events and returns usage with tool activity", async () => {
    const client = fakeClient(
      [
        {
          run_id: RUN_ID,
          status: "completed",
          output: "Done",
          usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
          runtime: { provider: "openai", model: "gpt-5" },
        },
      ],
      `event: tool.completed\ndata: {"event":"tool.completed","tool":"terminal","error":false}\n\n` +
        `event: run.completed\ndata: {"event":"run.completed","output":"Done"}\n\n`,
    );

    await expect(turn(client)).resolves.toEqual({
      runId: RUN_ID,
      output: "Done",
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      runtime: { provider: "openai", model: "gpt-5" },
      toolsUsed: ["terminal"],
    });
    expect(client.readRun).toHaveBeenCalledOnce();
  });
});
