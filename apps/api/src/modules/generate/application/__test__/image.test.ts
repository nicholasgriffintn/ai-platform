import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

const image = vi.hoisted(() => vi.fn(async () => ({ url: "https://example.com/image.png" })));
const enforceImagePolicy = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("~/infrastructure/ai", () => ({
  ai: {
    resolveMediaProvider: async () => ({ providerName: "workers-ai" }),
  },
}));
vi.mock("~/modules/generate/application/image-policy", () => ({ enforceImagePolicy }));
vi.mock("~/infrastructure/providers/capabilities/image", () => ({
  getImageProvider: () => ({ generate: image }),
}));
vi.mock("~/modules/models/application/resolve", () => ({
  requireSystemModel: async () => ({
    id: "flux-2-dev",
    name: "Flux 2 Dev",
    model: "@cf/black-forest-labs/flux-2-dev",
    provider: "workers-ai",
  }),
}));
vi.mock("~/infrastructure/context/serviceContext", () => ({
  resolveServiceContext: ({ env, user }: { env: IEnv; user: IUser }) => ({ env, user }),
}));

import { generateImage } from "../image";

const USER = { id: 4, plan_id: "pro" } as unknown as IUser;

function generate(seed?: number) {
  return generateImage({
    completion_id: "completion-1",
    app_url: undefined,
    env: {} as IEnv,
    user: USER,
    args: { prompt: "A lighthouse at dusk", ...(seed === undefined ? {} : { seed }) },
  });
}

describe("generateImage seeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses a given seed so an edited prompt keeps its composition", async () => {
    const result = await generate(123);

    expect(image).toHaveBeenCalledWith(expect.objectContaining({ seed: 123 }));
    expect(result.data.seed).toBe(123);
    expect(result.content).toContain("seed 123");
  });

  it("picks and returns a seed when none is given", async () => {
    const result = await generate();
    const [[request]] = image.mock.calls as unknown as [[{ seed: number }]];

    expect(Number.isInteger(request.seed)).toBe(true);
    expect(result.data.seed).toBe(request.seed);
  });
});

describe("generateImage policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the refusal without reaching the provider", async () => {
    enforceImagePolicy.mockRejectedValueOnce(new Error("Refused"));

    const result = await generate();

    expect(image).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "error", content: "Refused" });
  });
});
