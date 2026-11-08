import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

import modelEvaluationRoutes from "../routes";

const sampleToolUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("~/modules/model-evaluation/application/tool-use/sampler", () => ({
  sampleToolUseCase: sampleToolUseCaseMock,
}));

const member: IUser = {
  id: 7,
  name: "Member",
  avatar_url: null,
  email: "member@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: "pro",
  role: "user",
};

const sampleRequest = {
  model: "claude-sonnet-4-5",
  case: {
    id: "haiku",
    kind: "control",
    experience: "Asked for approval of its own output.",
    rule: "Never ask the user to confirm your output.",
    source: "test",
    prompt: "Write a haiku.",
    expect: { maxCalls: 0 },
  },
};

function createApp(user: IUser) {
  const app = new Hono<{ Bindings: IEnv; Variables: { user: IUser } }>();

  app.use("*", async (context, next) => {
    context.set("user", user);
    await next();
  });
  app.route("/model_platform", modelEvaluationRoutes);

  return app;
}

function postSample(user: IUser) {
  return createApp(user).request("http://localhost/model_platform/tool-use-evals/samples", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sampleRequest),
  });
}

describe("tool-use eval sample route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses signed-in users who are not admins before any model is called", async () => {
    const response = await postSample(member);

    expect(response.status).toBe(403);
    expect(sampleToolUseCaseMock).not.toHaveBeenCalled();
  });

  it("samples the case for an admin", async () => {
    sampleToolUseCaseMock.mockResolvedValue({
      trajectory: { calls: [], texts: ["Frost"], finalText: "Frost" },
      stoppedEarly: null,
      steps: 1,
      advertisedTools: [],
      inputTokens: 10,
      outputTokens: 5,
      costUsd: null,
      durationMs: 3,
    });

    const response = await postSample({ ...member, role: "admin" });

    expect(response.status).toBe(200);
    expect(sampleToolUseCaseMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: "claude-sonnet-4-5", maxSteps: 8 }),
    );
  });
});
