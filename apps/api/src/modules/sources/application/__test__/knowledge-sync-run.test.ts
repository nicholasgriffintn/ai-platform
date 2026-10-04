import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Miniflare } from "miniflare";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

import { databaseTestEnvironment } from "../../../../../test/environment";
import {
  initialiseSourceKnowledgeDatabase,
  sourceKnowledgeRuntimeOptions,
} from "../../../../../test/source-knowledge-database";
import { testUser } from "../../../../../test/users";
import { KnowledgeSyncRepository } from "../../infrastructure/KnowledgeSyncRepository";
import { runKnowledgeSync } from "../knowledge-sync-run";

const mocks = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn() }));

vi.mock("~/modules/workspaces/application/access", async (original) => ({
  ...(await original<typeof import("~/modules/workspaces/application/access")>()),
  requireProjectCapabilityAccess: mocks.access,
}));
vi.mock("~/modules/apps/application/connectors/operations", () => ({
  executeRecipeConnectorOperation: mocks.read,
}));

let runtime: Miniflare;
let repository: KnowledgeSyncRepository;

beforeEach(async () => {
  runtime = new Miniflare(sourceKnowledgeRuntimeOptions);
  const DB = await runtime.getD1Database("DB");

  await initialiseSourceKnowledgeDatabase(DB);
  repository = new KnowledgeSyncRepository({ DB });
});
afterEach(() => runtime.dispose());

it("rechecks authority after the upstream read and pauses without publishing a revoked result", async () => {
  const DB = await runtime.getD1Database("DB");

  await repository.create({
    id: "worker",
    userId: 1,
    projectId: "project",
    connectionId: "connection",
    recipeId: "confluence-project-knowledge",
    integrationId: "confluence",
    title: "Worker runbooks",
    resources: [{ resourceId: "3", readParameters: {} }],
    intervalMinutes: 60,
  });
  const user = vi.spyOn(UserRepository.prototype, "getUserById").mockResolvedValue(testUser(1));

  mocks.access
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(
      new AssistantError("Access revoked", ErrorType.AUTHORISATION_ERROR, 403),
    );
  mocks.read.mockResolvedValue({
    data: {
      id: "3",
      title: "Private runbook",
      status: "current",
      version: { number: 1 },
      body: { storage: { value: "<p>Private instructions</p>" } },
    },
  });
  try {
    const env = databaseTestEnvironment(DB);

    await expect(runKnowledgeSync(env, "worker", 1, 1)).rejects.toMatchObject({ statusCode: 502 });
    expect(await repository.get("worker")).toMatchObject({
      status: "paused",
      cursor: 0,
      last_successful_at: null,
      generation: 2,
    });
    expect(
      await DB.prepare(
        "SELECT count(*) AS count FROM source WHERE title = 'Private runbook'",
      ).first(),
    ).toEqual({ count: 0 });
    await runKnowledgeSync(env, "worker", 1, 1);
    expect(mocks.read).toHaveBeenCalledOnce();
  } finally {
    user.mockRestore();
  }
});
