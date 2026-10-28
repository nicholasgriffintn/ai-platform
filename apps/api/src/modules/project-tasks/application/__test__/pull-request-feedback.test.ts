import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

const mocks = vi.hoisted(() => ({
  sendFixUp: vi.fn(async (_context: unknown, linked: unknown, _fixUp: unknown) => linked),
  postEvent: vi.fn(async () => undefined),
  requireProjectAccess: vi.fn(async () => ({})),
}));

vi.mock("../fix-ups", () => ({ sendFixUp: mocks.sendFixUp }));
vi.mock("../work", () => ({ postEvent: mocks.postEvent }));
vi.mock("~/modules/workspaces/application/access", () => ({
  requireProjectAccess: mocks.requireProjectAccess,
}));
vi.mock("~/infrastructure/context/serviceContext", () => ({
  createServiceContext: (input: unknown) => input,
}));

import { recordPullRequestCheck } from "../pull-request-feedback";

const SHA = "a".repeat(40);
let stored: ProjectTask;

function linkedTask(): ProjectTask {
  return Object.assign(Object.create(null), {
    id: "task-1",
    projectId: "project-1",
    status: "review",
    runnerIdentityUserId: 7,
    createdByUserId: 7,
    owner: { type: "teammate", id: "builder" },
    details: {
      pullRequest: {
        repository: "acme/app",
        number: 12,
        url: "https://github.com/acme/app/pull/12",
      },
    },
  });
}

const context = Object.assign(Object.create(null), {
  env: {},
  repositories: fakeRepositories([
    [
      ProjectTaskRepository,
      {
        listOpenTasksForPullRequest: vi.fn(async () => [stored]),
        updateTask: vi.fn(async (_id: string, updates: Partial<ProjectTask>) => {
          stored = { ...stored, ...updates };

          return stored;
        }),
      },
    ],
    [UserRepository, { getUserById: vi.fn(async () => ({ id: 7 })) }],
  ]),
});

function check(conclusion: string, name: string | null, headSha = SHA) {
  return recordPullRequestCheck(
    context,
    { repository: "acme/app", pullRequests: [12], headSha, conclusion, name, url: null },
    7,
  );
}

describe("recordPullRequestCheck", () => {
  beforeEach(() => {
    stored = linkedTask();
    mocks.sendFixUp.mockClear();
    mocks.postEvent.mockClear();
  });

  it("sends one fix-up for a red build however many checks fail on that commit", async () => {
    await check("failure", "test");
    await check("failure", "lint");

    expect(mocks.sendFixUp).toHaveBeenCalledTimes(1);
    expect(mocks.sendFixUp.mock.calls[0][2]).toMatchObject({ source: "ci", from: "CI" });
    expect(stored.details.pullRequest?.checks).toMatchObject({
      headSha: SHA,
      state: "failing",
      failing: [
        { name: "test", url: null },
        { name: "lint", url: null },
      ],
    });
  });

  it("starts again on a new push and says when it goes green", async () => {
    await check("failure", "test");
    await check("success", null, "b".repeat(40));

    expect(stored.details.pullRequest?.checks).toMatchObject({
      headSha: "b".repeat(40),
      state: "passing",
      failing: [],
    });
    expect(mocks.postEvent).toHaveBeenCalledTimes(1);
  });

  it("leaves tasks alone when the installation's owner can't see the project", async () => {
    mocks.requireProjectAccess.mockRejectedValueOnce(new Error("forbidden"));

    await expect(check("failure", "test")).resolves.toBe(0);
    expect(mocks.sendFixUp).not.toHaveBeenCalled();
  });
});
