import { Miniflare, type Request as WorkerRequest, Response as WorkerResponse } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { IEnv } from "~/types";

import {
  createSitesTestContext,
  resetSitesTestData,
  saveTestSite,
} from "../../../../../test/sites/database";
import { testSite } from "../../../../../test/sites/fixtures";

const model = vi.hoisted(() => ({ generate: vi.fn() }));

vi.mock("../generate", () => ({ runSiteGeneration: model.generate }));

import { verifyAndRepairSite } from "../browser-verification";
import { updateSite } from "../records";

const capture = vi.fn<(request: WorkerRequest) => Promise<WorkerResponse>>();
const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
  kvNamespaces: ["CACHE"],
  serviceBindings: { COMPUTER_WORKER: (request) => capture(request) },
});
let context: ServiceContext;

beforeAll(async () => {
  context = await createSitesTestContext(runtime);
  context.env.APP_BASE_URL = "https://app.example";
  const bindings = await runtime.getBindings<Pick<IEnv, "COMPUTER_WORKER">>();

  context.env.COMPUTER_WORKER = bindings.COMPUTER_WORKER;
});
afterAll(() => runtime.dispose());
beforeEach(async () => {
  vi.clearAllMocks();
  await resetSitesTestData(context);
  await saveTestSite(context);
  capture.mockImplementation(async () =>
    WorkerResponse.json({ status: "passed", diagnostics: [] }),
  );
  model.generate.mockImplementation(async () => ({
    site: await updateSite({ context, userId: 1 }, "site", {
      expectedRevision: 1,
      brief: testSite.brief,
      plan: testSite.plan,
      project: testSite.project,
      issues: [],
      turn: { id: "repair", role: "edit", prompt: "Repair", createdAt: testSite.createdAt },
    }),
  }));
});

async function storedEvidence() {
  return context.repositories.outputs.listPersonalOutputs(1, "featured-sites", {
    kind: "site_browser_evidence",
  });
}

describe("browser verification", () => {
  it("stores passing desktop and mobile evidence without invoking repair", async () => {
    const result = await verifyAndRepairSite(context, "site", {
      expectedRevision: 1,
      repair: true,
      interactions: [],
    });
    const records = await storedEvidence();

    expect(result.status).toBe("passed");
    expect(result.checks.map((check) => check.viewport)).toEqual(["desktop", "mobile"]);
    expect(records).toHaveLength(1);
    expect(JSON.parse(records[0].content)).toEqual(result);
    expect(records[0].sensitivity).toBe("confidential");
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("rechecks the saved repair revision exactly once and sanitises persisted diagnostics", async () => {
    capture.mockImplementation(async () =>
      WorkerResponse.json({
        status: "failed",
        diagnostics: [{ kind: "console", message: "token=secret-value" }],
      }),
    );
    const result = await verifyAndRepairSite(context, "site", {
      expectedRevision: 1,
      repair: true,
      interactions: [],
    });
    const records = await storedEvidence();

    expect(result).toMatchObject({ status: "failed", repairedFromRevision: 1, revision: 2 });
    expect(model.generate).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(4);
    expect(
      records
        .map((record) => JSON.parse(record.content).revision)
        .sort((left, right) => left - right),
    ).toEqual([1, 2]);
    expect(JSON.stringify(records)).not.toContain("secret-value");
  });

  it("stops cancelled checks before publishing evidence or repairing", async () => {
    const controller = new AbortController();

    capture.mockImplementation(async () => {
      controller.abort();

      return WorkerResponse.json({ status: "failed", diagnostics: [] });
    });
    await expect(
      verifyAndRepairSite(
        context,
        "site",
        { expectedRevision: 1, repair: true, interactions: [] },
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(await storedEvidence()).toEqual([]);
    expect(model.generate).not.toHaveBeenCalled();
  });

  it("does not repair unavailable infrastructure or publish evidence after a concurrent edit", async () => {
    capture.mockImplementation(async () => new WorkerResponse(null, { status: 503 }));
    expect(
      (
        await verifyAndRepairSite(context, "site", {
          expectedRevision: 1,
          repair: true,
          interactions: [],
        })
      ).status,
    ).toBe("unavailable");
    expect(model.generate).not.toHaveBeenCalled();
    await resetSitesTestData(context);
    await saveTestSite(context);
    capture.mockImplementationOnce(async () => {
      await updateSite({ context, userId: 1 }, "site", {
        expectedRevision: 1,
        brief: testSite.brief,
        plan: testSite.plan,
        project: testSite.project,
        issues: [],
        turn: {
          id: "edit",
          role: "edit",
          prompt: "Concurrent edit",
          createdAt: testSite.createdAt,
        },
      });

      return WorkerResponse.json({ status: "passed", diagnostics: [] });
    });
    await expect(
      verifyAndRepairSite(context, "site", { expectedRevision: 1, repair: true, interactions: [] }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await storedEvidence()).toEqual([]);
  });
});
