import { beforeEach, describe, expect, it, vi } from "vitest";

const handleResearchTask = vi.hoisted(() =>
  vi.fn(async (_request: { options: unknown }) => ({
    status: "success",
    content: "Report",
    data: {},
  })),
);

vi.mock("~/modules/research/application/task", () => ({
  handleResearchTask,
  startResearchTask: vi.fn(),
}));

import { research } from "../research";

const context = {
  completionId: "completion-1",
  request: { env: {}, user: { id: 1 }, request: { platform: "web" } },
} as unknown as Parameters<typeof research.execute>[1];

describe("research tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to a standard Parallel report rather than the ultra processor", async () => {
    await research.execute({ input: "EV charging market in the UK" }, context);

    expect(handleResearchTask).toHaveBeenCalledWith(
      expect.objectContaining({
        input: "EV charging market in the UK",
        provider: "parallel",
        options: { processor: "pro", task_spec: { output_schema: { type: "text" } } },
      }),
    );
  });

  it("maps depth and format onto each provider's own settings", async () => {
    await research.execute(
      {
        input: "Competitors",
        depth: "quick",
        format: "data",
        output_description: "Name and price per competitor",
      },
      context,
    );
    await research.execute({ input: "Due diligence", depth: "deep", provider: "exa" }, context);

    expect(handleResearchTask.mock.calls.map(([call]) => call.options)).toEqual([
      {
        processor: "base",
        task_spec: {
          output_schema: { type: "auto", description: "Name and price per competitor" },
        },
      },
      { model: "exa-research-pro" },
    ]);
  });

  it("refuses an empty brief before spending anything", async () => {
    await expect(research.execute({ input: "  " }, context)).rejects.toThrow(
      "Provide a research brief in input",
    );
    expect(handleResearchTask).not.toHaveBeenCalled();
  });
});
