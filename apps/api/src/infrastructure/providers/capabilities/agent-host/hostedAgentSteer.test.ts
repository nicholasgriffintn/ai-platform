import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import type { AgentHostClient } from "./AgentHostClient";
import { maybeSteerQueuedFollowUp, replayPendingSteer } from "./hostedAgentSteer";

const queueMocks = vi.hoisted(() => ({
  queueFollowUp: vi.fn(async () => ({ id: "queued-2" })),
  removeQueuedFollowUp: vi.fn(async () => ({ removed: true })),
}));

vi.mock("~/modules/chat-runs/application/follow-up-queue", () => queueMocks);

const RUN_ID = `run_${"e".repeat(32)}`;

function contextWithQueue(queueText: string | null): ServiceContext {
  return {
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

function clientWith(steer: () => Promise<void>): AgentHostClient {
  return { steerRun: vi.fn(steer) } as unknown as AgentHostClient;
}

describe("maybeSteerQueuedFollowUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("steers queued text into the live run and removes it from the queue", async () => {
    const client = clientWith(async () => undefined);

    await expect(
      maybeSteerQueuedFollowUp({
        context: contextWithQueue("Also check the edge case"),
        userId: 7,
        conversationId: "conv-1",
        hostId: "hermes-7",
        runId: RUN_ID,
        client,
      }),
    ).resolves.toBe("steered");
    expect(client.steerRun).toHaveBeenCalledWith({
      hostId: "hermes-7",
      runId: RUN_ID,
      input: "Also check the edge case",
    });
    expect(queueMocks.removeQueuedFollowUp).toHaveBeenCalledWith(
      expect.anything(),
      "conv-1",
      "queued-1",
    );
  });

  it("leaves the queue alone when nothing is queued", async () => {
    const client = clientWith(async () => undefined);

    await expect(
      maybeSteerQueuedFollowUp({
        context: contextWithQueue(null),
        userId: 7,
        conversationId: "conv-1",
        hostId: "hermes-7",
        runId: RUN_ID,
        client,
      }),
    ).resolves.toBe("none");
    expect(client.steerRun).not.toHaveBeenCalled();
  });

  it("leaves the queue alone when the run is not accepting steer input", async () => {
    const client = clientWith(async () => {
      throw new AssistantError("not accepting", ErrorType.CONFLICT_ERROR, 409);
    });

    await expect(
      maybeSteerQueuedFollowUp({
        context: contextWithQueue("Also check X"),
        userId: 7,
        conversationId: "conv-1",
        hostId: "hermes-7",
        runId: RUN_ID,
        client,
      }),
    ).resolves.toBe("not-accepting");
    expect(queueMocks.removeQueuedFollowUp).not.toHaveBeenCalled();
  });
});

describe("replayPendingSteer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-queues undelivered steer text as the next turn", async () => {
    await replayPendingSteer({
      context: contextWithQueue(null),
      conversationId: "conv-1",
      pendingSteer: "Also check the edge case",
    });

    expect(queueMocks.queueFollowUp).toHaveBeenCalledWith(
      expect.anything(),
      "conv-1",
      expect.objectContaining({
        message: expect.objectContaining({ role: "user" }),
      }),
    );
  });

  it("does nothing without pending steer text", async () => {
    await replayPendingSteer({ context: contextWithQueue(null), conversationId: "conv-1" });

    expect(queueMocks.queueFollowUp).not.toHaveBeenCalled();
  });
});
