import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, IUser } from "~/types";

const image = vi.hoisted(() => vi.fn(async () => ({ url: "https://example.com/image.png" })));

vi.mock("~/infrastructure/ai", () => ({
  ai: {
    image,
    resolveMediaProvider: async () => ({ providerName: "workers-ai" }),
  },
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

    expect(image).toHaveBeenCalledWith(expect.objectContaining({ seed: 123 }), expect.anything());
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
