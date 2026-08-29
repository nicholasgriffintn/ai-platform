import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleGetConversationGoal,
  handleGetRunGoal,
  handleRecordRunGoalIteration,
  handleSetConversationGoal,
  handleSetRunGoal,
  handleUpdateConversationGoal,
  handleUpdateRunGoal,
} from "../conversationGoal";

const getActiveGoal = vi.fn();
const setGoal = vi.fn();
const transition = vi.fn();
const recordIteration = vi.fn();
const assertPro = vi.fn();

vi.mock("~/services/goals/GoalService", () => ({
  GoalService: class {
    getActiveGoal = getActiveGoal;
    setGoal = setGoal;
    transition = transition;
    recordIteration = recordIteration;
    assertPro = assertPro;
  },
}));

vi.mock("~/services/goals/goalMarker", () => ({
  recordGoalMarker: vi.fn(),
}));

vi.mock("~/lib/conversationManager", () => ({
  ConversationManager: { getInstance: vi.fn().mockReturnValue({}) },
}));

const requireProjectAccess = vi.fn();

vi.mock("~/services/workspaces/access", () => ({
  requireProjectAccess: (...args: unknown[]) => requireProjectAccess(...args),
}));

const owner = { id: 7, plan_id: "pro" };
const createConversation = vi.fn();

function createContext(overrides: {
  conversation?: Record<string, unknown> | null;
  activity?: Record<string, unknown> | null;
}) {
  return {
    env: {},
    database: {},
    ensureDatabase: vi.fn(),
    requireUser: vi.fn().mockReturnValue(owner),
    repositories: {
      goals: {},
      conversations: {
        getConversation: vi.fn().mockResolvedValue(overrides.conversation ?? null),
        createConversation: createConversation,
      },
      activities: {
        getActivityByGroup: vi.fn().mockResolvedValue(overrides.activity ?? null),
      },
    },
  } as any;
}

const runPayload = JSON.stringify({
  runId: "run-1",
  installationId: 1,
  repo: "acme/widgets",
  task: "do the thing",
  model: "claude",
  shouldCommit: false,
  status: "running",
  startedAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("conversation goal authorisation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveGoal.mockResolvedValue(null);
    setGoal.mockResolvedValue(null);
    requireProjectAccess.mockResolvedValue({ project: {}, role: "member" });
  });

  describe("conversation goals", () => {
    it("refuses to read a goal on someone else's personal conversation", async () => {
      const context = createContext({
        conversation: { id: "c-1", user_id: 99, project_id: null },
      });

      await expect(handleGetConversationGoal(context, "c-1")).rejects.toThrow(
        "Conversation not found",
      );
      expect(getActiveGoal).not.toHaveBeenCalled();
    });

    it("refuses to set a goal on someone else's personal conversation", async () => {
      const context = createContext({
        conversation: { id: "c-1", user_id: 99, project_id: null },
      });

      await expect(handleSetConversationGoal(context, "c-1", "take over")).rejects.toThrow(
        "Conversation not found",
      );
      expect(setGoal).not.toHaveBeenCalled();
    });

    it("creates the thread when a goal is set before the first message", async () => {
      const context = createContext({ conversation: null });

      createConversation.mockResolvedValue({ id: "c-1", user_id: owner.id });
      setGoal.mockResolvedValue({
        id: "goal-1",
        conversation_id: "c-1",
        sandbox_run_id: null,
        user_id: owner.id,
        objective: "count to 100",
        status: "active",
        source: "user",
        iteration_count: 0,
        stall_streak: 0,
        tokens_spent: 0,
        progress: [],
        evidence: null,
        stopped_reason: null,
        created_at: "2026-08-29T00:00:00.000Z",
        updated_at: null,
        completed_at: null,
        last_continued_at: null,
      });

      await handleSetConversationGoal(context, "c-1", "count to 100");

      expect(createConversation).toHaveBeenCalledWith("c-1", owner.id, undefined, {});
      expect(setGoal).toHaveBeenCalledWith(
        expect.objectContaining({ owner: { conversationId: "c-1" }, objective: "count to 100" }),
      );
    });

    it("refuses to change goal lifecycle on someone else's personal conversation", async () => {
      const context = createContext({
        conversation: { id: "c-1", user_id: 99, project_id: null },
      });

      await expect(
        handleUpdateConversationGoal(context, "c-1", {
          status: "cleared",
        } as never),
      ).rejects.toThrow("Conversation not found");
      expect(transition).not.toHaveBeenCalled();
    });

    it("refuses a project conversation when workspace membership is missing", async () => {
      requireProjectAccess.mockRejectedValueOnce(new Error("You do not have access"));

      const context = createContext({
        conversation: { id: "c-1", user_id: 99, project_id: "p-1" },
      });

      await expect(handleGetConversationGoal(context, "c-1")).rejects.toThrow(
        "You do not have access",
      );
      expect(getActiveGoal).not.toHaveBeenCalled();
    });

    it("allows the conversation owner through", async () => {
      const context = createContext({
        conversation: { id: "c-1", user_id: owner.id, project_id: null },
      });

      await handleGetConversationGoal(context, "c-1");

      expect(getActiveGoal).toHaveBeenCalledWith({ conversationId: "c-1" });
    });

    it("allows a workspace member through on a project conversation", async () => {
      const context = createContext({
        conversation: { id: "c-1", user_id: 99, project_id: "p-1" },
      });

      await handleGetConversationGoal(context, "c-1");

      expect(requireProjectAccess).toHaveBeenCalledWith(context, "p-1");
      expect(getActiveGoal).toHaveBeenCalledWith({ conversationId: "c-1" });
    });
  });

  describe("sandbox run goals", () => {
    it("refuses to read a goal on someone else's run", async () => {
      const context = createContext({
        activity: {
          created_by_user_id: 99,
          project_id: null,
          data: runPayload,
        },
      });

      await expect(handleGetRunGoal(context, "run-1")).rejects.toThrow("Sandbox run not found");
      expect(getActiveGoal).not.toHaveBeenCalled();
    });

    it("refuses to set a goal on someone else's run", async () => {
      const context = createContext({
        activity: {
          created_by_user_id: 99,
          project_id: null,
          data: runPayload,
        },
      });

      await expect(handleSetRunGoal(context, "run-1", "take over")).rejects.toThrow(
        "Sandbox run not found",
      );
      expect(setGoal).not.toHaveBeenCalled();
    });

    it("refuses to pause someone else's run goal", async () => {
      const context = createContext({
        activity: {
          created_by_user_id: 99,
          project_id: null,
          data: runPayload,
        },
      });

      await expect(
        handleUpdateRunGoal(context, "run-1", { status: "paused" } as never),
      ).rejects.toThrow("Sandbox run not found");
      expect(transition).not.toHaveBeenCalled();
    });

    it("refuses to record an iteration against someone else's run goal", async () => {
      const context = createContext({
        activity: {
          created_by_user_id: 99,
          project_id: null,
          data: runPayload,
        },
      });

      await expect(
        handleRecordRunGoalIteration(context, "run-1", {
          summary: "done",
        } as never),
      ).rejects.toThrow("Sandbox run not found");
      expect(recordIteration).not.toHaveBeenCalled();
    });

    it("allows the run owner through", async () => {
      const context = createContext({
        activity: {
          created_by_user_id: owner.id,
          project_id: null,
          data: runPayload,
        },
      });

      await handleGetRunGoal(context, "run-1");

      expect(getActiveGoal).toHaveBeenCalledWith({ sandboxRunId: "run-1" });
    });
  });
});
