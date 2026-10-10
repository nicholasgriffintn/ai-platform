import type { AgentHostRunSnapshot } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import type { AgentHostClient } from "./AgentHostClient";
import { AgentHostUnprovisionedError } from "./AgentHostUnprovisionedError";
import {
  HOSTED_HERMES_KEY_NAME,
  prepareHostedHermes,
  runHostedHermesTurn,
} from "./hostedHermesTurn";

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
  let wakes = 0;

  return {
    provision: vi.fn(async () => undefined),
    wake: vi.fn(async () => {
      wakes += 1;

      if (unprovisioned && wakes === 1) {
        throw new AgentHostUnprovisionedError();
      }
    }),
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
    destroy: vi.fn(async () => undefined),
  };
}

const context = { executionRunId: undefined } as unknown as ServiceContext;

function turn(client: ReturnType<typeof fakeClient>) {
  return runHostedHermesTurn({
    context,
    client: client as unknown as AgentHostClient,
    userId: 7,
    conversationId: "conv/1",
    input: "Plan my week",
    modelTier: "medium",
  });
}

describe("runHostedHermesTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiKeys.getUserApiKeys.mockResolvedValue([
      { id: "old", name: HOSTED_HERMES_KEY_NAME, created_at: "" },
      { id: "keep", name: "Laptop gateway", created_at: "" },
    ]);
    apiKeys.createUserApiKey.mockResolvedValue({ plaintextKey: "ak_new", metadata: {} });
  });

  it("provisions on first use with a fresh key and revokes the previous hosted key", async () => {
    const client = fakeClient([{ run_id: RUN_ID, status: "completed", output: "Done" }], true);

    await expect(turn(client)).resolves.toMatchObject({ output: "Done" });
    expect(apiKeys.deleteUserApiKey).toHaveBeenCalledTimes(1);
    expect(apiKeys.deleteUserApiKey).toHaveBeenCalledWith(context, "old");
    expect(client.provision).toHaveBeenCalledWith({ hostId: "hermes-7", apiKey: "ak_new" });
    expect(client.startRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionId: "polychat-conv-1", modelTier: "medium" }),
    );
  });

  it("declines each approval request once and reports it", async () => {
    const waiting: AgentHostRunSnapshot = {
      run_id: RUN_ID,
      status: "waiting_for_approval",
      approval: { request_id: "req-1", description: "delete the cache" },
    };
    const client = fakeClient([
      waiting,
      waiting,
      { run_id: RUN_ID, status: "completed", output: "Skipped it" },
    ]);

    await expect(turn(client)).resolves.toEqual({
      runId: RUN_ID,
      output: "Skipped it",
      deniedActions: ["delete the cache"],
    });
    expect(client.answerApproval).toHaveBeenCalledTimes(1);
    expect(client.answerApproval).toHaveBeenCalledWith(
      expect.objectContaining({ choice: "deny", requestId: "req-1" }),
    );
  });

  it("surfaces a failed run as an error", async () => {
    const client = fakeClient([{ run_id: RUN_ID, status: "failed", error: "model unavailable" }]);

    await expect(turn(client)).rejects.toThrow("model unavailable");
  });
});

describe("prepareHostedHermes", () => {
  it("provisions an unprovisioned host before waking it", async () => {
    apiKeys.getUserApiKeys.mockResolvedValue([]);
    apiKeys.createUserApiKey.mockResolvedValue({ plaintextKey: "ak_new", metadata: {} });
    const client = fakeClient([], true);

    await prepareHostedHermes(context, client as unknown as AgentHostClient, 7);

    expect(client.provision).toHaveBeenCalledWith({ hostId: "hermes-7", apiKey: "ak_new" });
    expect(client.wake).toHaveBeenCalledTimes(2);
  });
});
