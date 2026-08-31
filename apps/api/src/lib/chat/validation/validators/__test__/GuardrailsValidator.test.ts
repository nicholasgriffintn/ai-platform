import { beforeEach, describe, expect, it, vi } from "vitest";

import { GuardrailsValidator } from "../GuardrailsValidator";

const { validateInput } = vi.hoisted(() => ({ validateInput: vi.fn() }));

vi.mock("~/lib/providers/capabilities/guardrails", () => ({
  Guardrails: class {
    validateInput = validateInput;
  },
}));

vi.mock("~/utils/logger", () => ({
  getLogger: () => ({ error: vi.fn() }),
}));

describe("GuardrailsValidator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInput.mockResolvedValue({ isValid: true });
  });

  it("passes image attachments to multimodal guardrail providers", async () => {
    const validator = new GuardrailsValidator();
    const getUserSettings = vi.fn().mockResolvedValue({
      guardrails_enabled: true,
      guardrails_provider: "shieldstral",
    });

    const result = await validator.validate(
      {
        env: {} as never,
        completion_id: "completion-1",
        messages: [],
        context: {
          user: { id: 42 },
          getUserSettings,
        },
      } as never,
      {
        messageWithContext: "Describe this image",
        lastMessage: {
          role: "user",
          content: [
            { type: "text", text: "Describe this image" },
            {
              type: "image_url",
              image_url: { url: "data:image/png;base64,AAAA", detail: "high" },
            },
          ],
        },
      },
    );

    expect(result.validation.isValid).toBe(true);
    expect(validateInput).toHaveBeenCalledWith(
      {
        text: "Describe this image",
        images: [{ url: "data:image/png;base64,AAAA", detail: "high" }],
      },
      42,
      "completion-1",
    );
  });
});
