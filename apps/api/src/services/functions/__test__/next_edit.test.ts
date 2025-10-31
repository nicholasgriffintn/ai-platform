import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockHandleNextEdit } = vi.hoisted(() => ({
  mockHandleNextEdit: vi.fn(),
}));

vi.mock("~/services/completions/createNextEditCompletions", () => ({
  handleCreateNextEditCompletions: mockHandleNextEdit,
}));

import { next_edit_completion } from "../next_edit";
import type { IRequest } from "~/types";

const baseRequest: IRequest = {
  env: {} as any,
  user: { id: 1 } as any,
};

describe("next_edit_completion function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when prompt missing", async () => {
    const result = await next_edit_completion.function("id", {}, baseRequest);

    expect(result.status).toBe("error");
    expect(mockHandleNextEdit).not.toHaveBeenCalled();
  });

  it("calls service with prompt and returns success content", async () => {
    mockHandleNextEdit.mockResolvedValue({
      choices: [
        {
          message: { content: "next edit" },
        },
      ],
    });

    const result = await next_edit_completion.function(
      "id",
      { prompt: "<ctx>" },
      baseRequest,
    );

    expect(mockHandleNextEdit).toHaveBeenCalledWith({
      env: baseRequest.env,
      user: baseRequest.user,
      model: undefined,
      messages: [{ role: "user", content: "<ctx>" }],
    });
    expect(result.status).toBe("success");
    expect(result.content).toBe("next edit");
  });

  it("falls back to choices text field", async () => {
    mockHandleNextEdit.mockResolvedValue({
      choices: [{ text: "fallback" }],
    });

    const result = await next_edit_completion.function(
      "id",
      { prompt: "content", model: "mercury-coder" },
      baseRequest,
    );

    expect(result.content).toBe("fallback");
    expect(mockHandleNextEdit).toHaveBeenCalledWith(
      expect.objectContaining({ model: "mercury-coder" }),
    );
  });
});
