import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";

import { run_prediction } from "../run_prediction";

const hasUserProviderApiKey = vi.hoisted(() => vi.fn(async () => true));
const executeReplicateModel = vi.hoisted(() =>
  vi.fn(async () => ({ content: "Generation started", data: { id: "output-1" } })),
);
const requireOptionalProjectCapabilityAccess = vi.hoisted(() => vi.fn(async () => undefined));
const getProviderModels = vi.hoisted(() =>
  vi.fn(() => ({
    "replicate-google-nano-banana-pro": { name: "Nano Banana Pro" },
    "replicate-sora-2": { name: "Sora 2" },
  })),
);

vi.mock("~/lib/providers/utils/apiKeys", () => ({ hasUserProviderApiKey }));
vi.mock("~/services/apps/replicate/execute", () => ({ executeReplicateModel }));
vi.mock("~/services/workspaces/access", () => ({ requireOptionalProjectCapabilityAccess }));
vi.mock("~/lib/providers/models/catalogue", () => ({ getProviderModels }));

const input = {
  model_id: "replicate-google-nano-banana-pro",
  input: { prompt: "a parrot on a perch" },
};

function createToolContext(projectId?: string) {
  const user = { id: 7, plan_id: "pro" };

  return {
    request: {
      env: {},
      user,
      context: { env: {}, user, requireUser: () => user },
      request: { metadata: projectId ? { project_id: projectId } : {} },
    },
  } as never;
}

describe("run_prediction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasUserProviderApiKey.mockResolvedValue(true);
  });

  it("refuses without the caller's own Replicate key rather than spending platform credit", async () => {
    hasUserProviderApiKey.mockResolvedValue(false);

    await expect(run_prediction.execute(input, createToolContext())).rejects.toBeInstanceOf(
      AssistantError,
    );
    expect(executeReplicateModel).not.toHaveBeenCalled();
  });

  it("refuses a model that is not in the catalogue and names ones that are", async () => {
    await expect(
      run_prediction.execute({ ...input, model_id: "replicate-sora" }, createToolContext()),
    ).rejects.toThrow(/replicate-sora-2/);
    expect(executeReplicateModel).not.toHaveBeenCalled();
  });

  it("runs in the project the conversation belongs to, after checking access", async () => {
    const result = await run_prediction.execute(input, createToolContext("project-1"));

    expect(requireOptionalProjectCapabilityAccess).toHaveBeenCalledWith(
      expect.anything(),
      "project-1",
      "app",
      "featured-replicate",
    );
    expect(executeReplicateModel).toHaveBeenCalledWith(
      expect.objectContaining({ storage: { projectId: "project-1" } }),
    );
    expect(result.data).toEqual({
      outputId: "output-1",
      modelId: "replicate-google-nano-banana-pro",
    });
  });

  it("runs personally when the conversation belongs to no project", async () => {
    await run_prediction.execute(input, createToolContext());

    expect(executeReplicateModel).toHaveBeenCalledWith(expect.objectContaining({ storage: {} }));
  });
});
