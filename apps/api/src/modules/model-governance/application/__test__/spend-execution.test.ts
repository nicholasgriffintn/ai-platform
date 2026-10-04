import { readFile } from "node:fs/promises";

import type { D1Database } from "@cloudflare/workers-types";
import type { ModelPlatformAction } from "@ngriffin_uk/polychat-schemas";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireModelAction } from "~/modules/model-registry/application/access";
import { startApprovedDeployment } from "~/modules/model-serving/application/deployments";
import { toModelDeployment } from "~/modules/model-serving/application/mappers";

import { testModelDeployment } from "../../../../../test/fixtures/model-platform";
import { databaseTestEnvironment } from "../../../../../test/helpers/environment";
import { resolveSpendRequest } from "../spend-execution";

vi.mock("~/modules/model-registry/application/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/modules/model-registry/application/access")>()),
  requireModelAction: vi.fn(),
}));
vi.mock("~/modules/model-serving/application/deployments", () => ({
  startApprovedDeployment: vi.fn(),
}));
vi.mock("~/modules/model-training/application/runs", () => ({ startApprovedRun: vi.fn() }));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let database: D1Database;
let context: ServiceContext;

beforeAll(async () => {
  database = await runtime.getD1Database("DB");
  await database.batch([
    database.prepare("CREATE TABLE user (id INTEGER PRIMARY KEY)"),
    database.prepare("CREATE TABLE workspace (id TEXT PRIMARY KEY)"),
    database.prepare("CREATE TABLE project (id TEXT PRIMARY KEY)"),
    database.prepare("INSERT INTO user VALUES (1), (2)"),
    database.prepare("INSERT INTO workspace VALUES ('workspace')"),
  ]);
  const migration = await readFile(
    new URL("../../../../../migrations/0054_model_platform.sql", import.meta.url),
    "utf8",
  );

  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.includes("CREATE TABLE `model_spend_request`")) {
      await database.prepare(statement).run();
    }
  }

  context = createServiceContext({ env: databaseTestEnvironment(database) });
});
afterAll(() => runtime.dispose());
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  await database.prepare("DELETE FROM model_spend_request").run();
  vi.mocked(requireModelAction).mockResolvedValue({
    userId: 2,
    role: "admin",
    actions: new Set<ModelPlatformAction>(["approve"]),
    separationOfDuties: true,
    workspace: {
      id: "workspace",
      name: "Workspace",
      description: "",
      colour: "#000000",
      created_by: 1,
      created_at: "2026-09-26T00:00:00Z",
      updated_at: null,
    },
  });
  vi.mocked(startApprovedDeployment).mockResolvedValue(toModelDeployment(testModelDeployment));
  vi.spyOn(context.repositories.audit, "createRecord").mockResolvedValue(undefined);
});

async function pendingRequest() {
  return context.repositories.modelSpend.createSpendRequest({
    workspaceId: "workspace",
    projectId: null,
    subjectType: "deployment",
    payload: { name: "test" },
    estimateUsd: 100,
    reason: "Needs approval",
    requestedBy: 1,
  });
}

describe("spend execution", () => {
  it("starts a deployment only once when approvals race", async () => {
    const request = await pendingRequest();
    const results = await Promise.allSettled([
      resolveSpendRequest(context, "workspace", request.id, { state: "approved" }),
      resolveSpendRequest(context, "workspace", request.id, { state: "approved" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(startApprovedDeployment).toHaveBeenCalledOnce();
    expect(
      await context.repositories.modelSpend.getSpendRequest("workspace", request.id),
    ).toMatchObject({ state: "approved", subject_id: testModelDeployment.id, decided_by: 2 });
  });

  it("persists failure and refuses an unsafe retry after execution throws", async () => {
    const request = await pendingRequest();

    vi.mocked(startApprovedDeployment).mockRejectedValue(
      new Error("Provider failed after resource creation"),
    );

    await expect(
      resolveSpendRequest(context, "workspace", request.id, { state: "approved" }),
    ).rejects.toThrow("Provider failed");
    expect(
      await context.repositories.modelSpend.getSpendRequest("workspace", request.id),
    ).toMatchObject({ state: "failed", subject_id: null });
    await expect(
      resolveSpendRequest(context, "workspace", request.id, { state: "approved" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(startApprovedDeployment).toHaveBeenCalledOnce();
  });

  it("rejects a request without starting work and cannot claim another workspace's request", async () => {
    const request = await pendingRequest();

    expect(
      await context.repositories.modelSpend.claimSpendRequest({
        id: request.id,
        workspaceId: "other",
        state: "executing",
        decidedBy: 2,
      }),
    ).toBeNull();
    expect(
      await resolveSpendRequest(context, "workspace", request.id, { state: "rejected" }),
    ).toMatchObject({ state: "rejected" });
    expect(startApprovedDeployment).not.toHaveBeenCalled();
  });
});
