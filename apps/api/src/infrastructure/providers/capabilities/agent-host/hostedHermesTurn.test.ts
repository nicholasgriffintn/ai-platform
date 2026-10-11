import type { AgentHostRunSnapshot } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import type { AgentHostClient } from "./AgentHostClient";
import { AgentHostUnprovisionedError } from "./AgentHostUnprovisionedError";
import { HOSTED_HERMES_KEY_NAME, runHostedHermesTurn } from "./hostedHermesTurn";

const apiKeys = vi.hoisted(() => ({
  getUserApiKeys: vi.fn(),
  createUserApiKey: vi.fn(),
  deleteUserApiKey: vi.fn(),
}));

vi.mock("~/modules/user/application/apiKeys", () => apiKeys);
vi.mock("@ngriffin_uk/polychat-utility-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-utility-core")>()),
  abortableDelay: vi.fn(async () => undefined),
}));

const RUN_ID = `run_${"a".repeat(32)}`;

function fakeClient(snapshots: AgentHostRunSnapshot[], unprovisioned = false) {
  let starts = 0;

  return {
    provision: vi.fn(async () => undefined),
    startRun: vi.fn(async () => {
      starts += 1;

      if (unprovisioned && starts === 1) {
        throw new AgentHostUnprovisionedError();
      }

      return RUN_ID;
    }),
    readRun: vi.fn(async () => snapshots.shift() ?? snapshots.at(-1)),
    answerApproval: vi.fn(async () => undefined),
    stopRun: vi.fn(async () => undefined),
  };
}

const context = { executionRunId: undefined } as unknown as ServiceContext;

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
    apiKeys.getUserApiKeys.mockResolvedValue([
      { id: "old", name: HOSTED_HERMES_KEY_NAME, created_at: "" },
    ]);
    apiKeys.createUserApiKey.mockResolvedValue({ plaintextKey: "ak_new", metadata: {} });
  });

  it("provisions on first use with a fresh key and revokes the previous hosted key", async () => {
    const client = fakeClient([{ run_id: RUN_ID, status: "completed", output: "Done" }], true);

    await expect(turn(client)).resolves.toMatchObject({ output: "Done" });
    expect(apiKeys.getUserApiKeys).toHaveBeenCalledWith(context, 7, HOSTED_HERMES_KEY_NAME);
    expect(apiKeys.deleteUserApiKey).toHaveBeenCalledTimes(1);
    expect(apiKeys.deleteUserApiKey).toHaveBeenCalledWith(context, "old", 7);
    expect(client.provision).toHaveBeenCalledWith({ hostId: "hermes-7", apiKey: "ak_new" });
    expect(client.startRun).toHaveBeenLastCalledWith({
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
