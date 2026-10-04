import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";

import { browserTestUser } from "../../../../../test/computer-use";
import { databaseTestEnvironment } from "../../../../../test/environment";
import { testSite, testSiteOutput } from "../../../../../test/sites/fixtures";

const mocks = vi.hoisted(() => ({ access: vi.fn(), data: vi.fn(), generate: vi.fn() }));

vi.mock("../integration-access", () => ({ requireSiteIntegrationAccess: mocks.access }));
vi.mock("../runtime", () => ({ readSiteData: mocks.data }));
vi.mock("../generate", () => ({ runSiteGeneration: mocks.generate }));

import { verifyAndRepairSite } from "../browser-verification";

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
  kvNamespaces: ["CACHE"],
});
let context: ServiceContext;
const capture = vi.fn<typeof fetch>();

beforeAll(async () => {
  const env = databaseTestEnvironment(await runtime.getD1Database("DB"));

  Object.defineProperty(env, "CACHE", { value: await runtime.getKVNamespace("CACHE") });
  env.APP_BASE_URL = "https://app.example";
  env.COMPUTER_WORKER = {
    fetch: capture,
  };
  context = createServiceContext({
    env,
    user: browserTestUser,
  });
  vi.spyOn(context.repositories.outputs, "createOutput").mockResolvedValue(testSiteOutput);
});

afterAll(() => runtime.dispose());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue(testSite);
  mocks.data.mockResolvedValue({
    revision: 1,
    bindings: {},
    runtime: { enabled: false, revision: null },
  });
  mocks.generate.mockResolvedValue({ site: { ...testSite, revision: 2 } });
  capture.mockImplementation(async () => Response.json({ status: "passed", diagnostics: [] }));
});

describe("browser verification", () => {
  it("captures two viewports, stores sanitised evidence and does not repair a passing page", async () => {
    const result = await verifyAndRepairSite(context, "site", {
      expectedRevision: 1,
      repair: true,
      interactions: [],
    });

    expect(result.status).toBe("passed");
    expect(result.checks.map((check) => check.viewport)).toEqual(["desktop", "mobile"]);
    expect(context.repositories.outputs.createOutput).toHaveBeenCalledTimes(1);
    expect(mocks.generate).not.toHaveBeenCalled();
    const body = JSON.parse(String(capture.mock.calls[0][1]?.body));

    expect(body.resourceId).toMatch(/^site-probe-/);
    expect(body.allowedOrigins).toEqual([
      "https://app.example",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ]);
  });

  it("permits exactly one repair and rechecks its revision", async () => {
    capture.mockImplementation(async () =>
      Response.json({
        status: "failed",
        diagnostics: [{ kind: "console", message: "token=secret-value" }],
      }),
    );
    mocks.access
      .mockResolvedValueOnce(testSite)
      .mockResolvedValueOnce(testSite)
      .mockResolvedValueOnce(testSite)
      .mockResolvedValue({ ...testSite, revision: 2 });
    const result = await verifyAndRepairSite(context, "site", {
      expectedRevision: 1,
      repair: true,
      interactions: [],
    });

    expect(result.status).toBe("failed");
    expect(result.repairedFromRevision).toBe(1);
    expect(result.revision).toBe(2);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(result)).not.toContain("secret-value");
  });

  it("stops cancelled checks before publishing or repairing", async () => {
    const controller = new AbortController();

    capture.mockImplementation(async () => {
      controller.abort();

      return Response.json({ status: "failed", diagnostics: [] });
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
    expect(context.repositories.outputs.createOutput).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("does not repair unavailable infrastructure or publish stale evidence", async () => {
    capture.mockResolvedValue(new Response(null, { status: 503 }));
    const result = await verifyAndRepairSite(context, "site", {
      expectedRevision: 1,
      repair: true,
      interactions: [],
    });

    expect(result.status).toBe("unavailable");
    expect(mocks.generate).not.toHaveBeenCalled();
    vi.clearAllMocks();
    mocks.access
      .mockResolvedValueOnce(testSite)
      .mockRejectedValueOnce(new Error("The site changed"));
    await expect(
      verifyAndRepairSite(context, "site", { expectedRevision: 1, repair: true, interactions: [] }),
    ).rejects.toThrow("changed");
    expect(context.repositories.outputs.createOutput).not.toHaveBeenCalled();
  });
});
