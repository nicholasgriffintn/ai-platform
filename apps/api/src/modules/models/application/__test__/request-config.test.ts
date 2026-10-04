import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { IEnv } from "~/types";

import { databaseTestEnvironment } from "../../../../../test/environment";
import { resolveRequestModelConfig } from "../request-config";
import { findModelConfig } from "../resolve";

vi.mock("../resolve", () => ({ findModelConfig: vi.fn() }));

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response('test'); } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
});
let env: IEnv;

beforeAll(async () => {
  env = databaseTestEnvironment(await runtime.getD1Database("DB"));
});
afterAll(() => runtime.dispose());

describe("request model resolution", () => {
  it("pins an alias during a request and sees promotion changes on the next request", async () => {
    const primary = {
      id: "deployment:primary",
      matchingModel: "deployment:primary",
      provider: "polychat-deployment",
    };
    const canary = {
      id: "deployment:canary",
      matchingModel: "deployment:canary",
      provider: "polychat-deployment",
    };

    vi.mocked(findModelConfig).mockResolvedValueOnce(primary).mockResolvedValueOnce(canary);
    const first = { env, context: createServiceContext({ env }) };
    const second = { env, context: createServiceContext({ env }) };

    const [checked, executed] = await Promise.all([
      resolveRequestModelConfig(first, "alias:production"),
      resolveRequestModelConfig(first, "alias:production"),
    ]);

    expect(checked).toBe(primary);
    expect(executed).toBe(primary);
    expect(await resolveRequestModelConfig(second, "alias:production")).toBe(canary);
    expect(findModelConfig).toHaveBeenCalledTimes(2);
  });
});
