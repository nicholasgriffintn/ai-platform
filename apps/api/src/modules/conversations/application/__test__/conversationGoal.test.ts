import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { GoalRepository } from "~/modules/goals/infrastructure/GoalRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";

import { handleGetConversationGoal, handleRecordRunGoalIteration } from "../conversationGoal";

const getActiveGoal = vi.fn();
const setGoal = vi.fn();
const transition = vi.fn();
const recordIteration = vi.fn();
const assertPro = vi.fn();

vi.mock("~/modules/goals/application/GoalService", () => ({
  GoalService: class {
    getActiveGoal = getActiveGoal;
    setGoal = setGoal;
    transition = transition;
    recordIteration = recordIteration;
    assertPro = assertPro;
  },
}));

vi.mock("~/modules/goals/application/goalMarker", () => ({
  recordGoalMarker: vi.fn(),
}));

vi.mock("~/modules/conversations/application/manager", () => ({
  ConversationManager: { getInstance: vi.fn().mockReturnValue({}) },
}));

const requireProjectAccess = vi.fn();

vi.mock("~/modules/workspaces/application/access", () => ({
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
    ensureDatabase: vi.fn(),
    requireUser: vi.fn().mockReturnValue(owner),
    repositories: fakeRepositories([
      [GoalRepository, {}],
      [
        ConversationRepository,
        {
          getConversation: vi.fn().mockResolvedValue(overrides.conversation ?? null),
          createConversation: createConversation,
        },
      ],
      [
        ActivityRepository,
        {
          getActivityByGroup: vi.fn().mockResolvedValue(overrides.activity ?? null),
        },
      ],
      [
        TeammateContextRepository,
        {
          getByHomeConversationId: vi.fn().mockResolvedValue(null),
        },
      ],
    ]),
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
  });

  describe("sandbox run goals", () => {
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
  });
});
