import { MAX_QUEUED_CHAT_MESSAGES } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

const mocks = vi.hoisted(() => ({
  dispatchTask: vi.fn(),
  publishConversationChanged: vi.fn(),
}));

vi.mock("~/modules/tasks/application/TaskService", () => ({
  TaskService: class {
    dispatchTask = mocks.dispatchTask;
  },
}));

vi.mock("~/modules/sync/application/conversation-events", () => ({
  publishConversationChanged: mocks.publishConversationChanged,
}));

import { queueFollowUp, releaseQueuedFollowUpAfterRun } from "../follow-up-queue";

function queuedTask(id: string) {
  return {
    id,
    created_at: "2026-10-08T10:00:00.000Z",
    task_data: {
      conversationId: "conversation-1",
      message: { role: "user", content: "And then?" },
      request: {},
    },
  };
}

function createContext(options: {
  conversation?: Record<string, unknown> | null;
  waiting?: number;
  latestStatus?: string | null;
}) {
  const tasks = {
    listSuspendedTasksForConversation: vi.fn(async () =>
      Array.from({ length: options.waiting ?? 0 }, (_, index) => queuedTask(`queued-${index}`)),
    ),
    createTask: vi.fn(async (params: { id: string }) => queuedTask(params.id)),
    releaseNextSuspendedTaskForConversation: vi.fn(async () => queuedTask("queued-0")),
  };

  return {
    tasks,
    context: {
      env: {},
      waitUntil: vi.fn(),
      requireUser: () => ({ id: 7 }),
      repositories: {
        tasks,
        conversations: {
          getConversation: vi.fn(async () =>
            options.conversation === undefined
              ? { id: "conversation-1", user_id: 7, project_id: null }
              : options.conversation,
          ),
        },
        conversationRuns: {
          getLatestForConversation: vi.fn(async () =>
            options.latestStatus === null ? null : { status: options.latestStatus ?? "running" },
          ),
        },
      },
    } as unknown as ServiceContext,
  };
}

const input = { message: { role: "user" as const, content: "And then?" }, request: {} };

describe("queueFollowUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("holds the message while a reply is running", async () => {
    const { context, tasks } = createContext({ latestStatus: "running" });

    const queued = await queueFollowUp(context, "conversation-1", input);

    expect(queued.preview).toBe("And then?");
    expect(tasks.createTask).toHaveBeenCalledWith(expect.objectContaining({ status: "suspended" }));
    expect(tasks.releaseNextSuspendedTaskForConversation).not.toHaveBeenCalled();
  });

  it("sends at once when the reply finished before the message arrived", async () => {
    const { context } = createContext({ latestStatus: "succeeded" });

    await queueFollowUp(context, "conversation-1", input);

    expect(mocks.dispatchTask).toHaveBeenCalledTimes(1);
  });

  it("refuses more than the queue limit", async () => {
    const { context } = createContext({ waiting: MAX_QUEUED_CHAT_MESSAGES });

    await expect(queueFollowUp(context, "conversation-1", input)).rejects.toThrow(
      `up to ${MAX_QUEUED_CHAT_MESSAGES} messages`,
    );
  });

  it("refuses conversations the user does not own and project conversations", async () => {
    await expect(
      queueFollowUp(
        createContext({ conversation: { user_id: 8, project_id: null } }).context,
        "conversation-1",
        input,
      ),
    ).rejects.toThrow("Conversation not found");
    await expect(
      queueFollowUp(
        createContext({ conversation: { user_id: 7, project_id: "project-1" } }).context,
        "conversation-1",
        input,
      ),
    ).rejects.toThrow("Conversation not found");
  });
});

describe("releaseQueuedFollowUpAfterRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only releases the next message once the run has ended", async () => {
    const { context, tasks } = createContext({});

    await releaseQueuedFollowUpAfterRun(context, {
      id: "run-1",
      conversationId: "conversation-1",
      status: "awaiting_input",
    } as never);

    expect(tasks.releaseNextSuspendedTaskForConversation).not.toHaveBeenCalled();

    await releaseQueuedFollowUpAfterRun(context, {
      id: "run-1",
      conversationId: "conversation-1",
      status: "succeeded",
    } as never);

    expect(mocks.dispatchTask).toHaveBeenCalledTimes(1);
  });
});
